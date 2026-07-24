import { Prisma, Booking, Table } from '@prisma/client';
import { BookingRepository, BookingListFilters } from '../repositories/booking.repository';
import { TableRepository } from '../repositories/table.repository';
import { SlotRepository } from '../repositories/slot.repository';
import { ValidationError, NotFoundError, ConflictError } from '../errors/AppError';

export interface CreateBookingInput {
  date: string;
  slotId: number;
  partySize: number;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  notes?: string;
  tableId?: number;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

async function assignSpecificTable(
  tableId: number,
  slotId: number,
  date: Date,
  partySize: number,
  tx: Prisma.TransactionClient,
): Promise<number> {
  const table = await TableRepository.findAvailableWithSpecificTable(
    tableId,
    slotId,
    date,
    partySize,
    tx,
  );
  if (table) return table.id;

  const exists = await TableRepository.findById(tableId, tx);
  if (!exists) {
    throw new NotFoundError(`Table ${tableId} not found`);
  }
  throw new ConflictError('Requested table is not available for this slot and date');
}

async function assignBestFitTable(
  slotId: number,
  date: Date,
  partySize: number,
  tx: Prisma.TransactionClient,
): Promise<number> {
  const capacityExists = await TableRepository.existsWithCapacityAtLeast(partySize, tx);
  if (!capacityExists) {
    throw new ValidationError('No table exists with enough capacity for this party size');
  }

  const candidates = await TableRepository.findAvailable(slotId, date, partySize, tx);
  if (candidates.length === 0) {
    throw new ConflictError('No tables available for the requested party size, slot, and date');
  }
  return candidates[0].id;
}

export const BookingService = {
  async create(input: CreateBookingInput): Promise<Booking> {
    // `bookingDate` is intentionally parsed via the ISO-string Date constructor, which
    // per spec treats a "YYYY-MM-DD" input as UTC midnight. This is kept as-is (rather
    // than switched to local time) because it's the representation used for persistence
    // and for repository queries elsewhere in this codebase (see
    // BookingRepository.list's `new Date(filters.date)` and
    // TableRepository/SlotRepository's `countFutureConfirmedBookings` UTC-midnight
    // thresholds) — using local time here instead would make a newly created booking's
    // `date` column fail to match same-date queries made elsewhere on servers running
    // ahead of UTC. The ISO parse is also strict about calendar validity (e.g.
    // "2026-13-45" becomes Invalid Date), so it doubles as our shape/range check.
    const bookingDate = new Date(input.date);
    if (Number.isNaN(bookingDate.getTime())) {
      throw new ValidationError('date must be a valid, non-past date');
    }

    // For the "is this date in the past" check, compare against `startOfToday()` using
    // the SAME time base: startOfToday() is built with the local-time
    // `Date(year, month, day)` constructor, so we derive a local-time equivalent of the
    // requested date here too. Comparing local-vs-UTC midnight directly is the bug this
    // fixes (same-day bookings were rejected on servers behind UTC).
    const [year, month, day] = input.date.split('-').map(Number);
    const bookingDateLocal = new Date(year, month - 1, day);
    if (bookingDateLocal < startOfToday()) {
      throw new ValidationError('date must be a valid, non-past date');
    }

    const slot = await SlotRepository.findById(input.slotId);
    if (!slot || !slot.isActive) {
      throw new NotFoundError('Time slot not found or inactive');
    }

    try {
      return await BookingRepository.runInTransaction(async (tx) => {
        const assignedTableId = input.tableId
          ? await assignSpecificTable(input.tableId, input.slotId, bookingDate, input.partySize, tx)
          : await assignBestFitTable(input.slotId, bookingDate, input.partySize, tx);

        return BookingRepository.create(
          {
            date: bookingDate,
            partySize: input.partySize,
            guestName: input.guestName,
            guestEmail: input.guestEmail,
            guestPhone: input.guestPhone,
            notes: input.notes,
            tableId: assignedTableId,
            slotId: input.slotId,
          },
          tx,
        );
      });
    } catch (error) {
      // The availability check above and the insert are not atomic under PostgreSQL's
      // default Read Committed isolation, so two concurrent requests for the same
      // table+slot+date can both pass the check. The `bookings_confirmed_table_slot_date_key`
      // partial unique index (see prisma/migrations) is the actual guard against a real
      // double-booking; this catches its violation and turns it into the same ConflictError
      // API consumers already see from the pre-check, instead of leaking a raw 500.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('Table was just booked for this slot and date');
      }
      throw error;
    }
  },

  async getById(id: string): Promise<Booking> {
    const booking = await BookingRepository.findById(id);
    if (!booking) {
      throw new NotFoundError(`Booking ${id} not found`);
    }
    return booking;
  },

  async cancel(id: string): Promise<Booking> {
    const booking = await BookingRepository.findById(id);
    if (!booking) {
      throw new NotFoundError(`Booking ${id} not found`);
    }
    return BookingRepository.updateStatus(id, 'cancelled');
  },

  async adminUpdate(
    id: string,
    input: { status?: 'cancelled'; tableId?: number },
  ): Promise<Booking> {
    const booking = await BookingRepository.findById(id);
    if (!booking) {
      throw new NotFoundError(`Booking ${id} not found`);
    }

    if (input.status === 'cancelled') {
      return BookingRepository.updateStatus(id, 'cancelled');
    }

    if (input.tableId !== undefined) {
      if (input.tableId === booking.tableId) {
        return booking;
      }
      const available = await TableRepository.findAvailableWithSpecificTable(
        input.tableId,
        booking.slotId,
        booking.date,
        booking.partySize,
      );
      if (!available) {
        throw new ConflictError('Requested table is not available for this slot and date');
      }
      try {
        return await BookingRepository.updateTable(id, input.tableId);
      } catch (error) {
        // Same check-then-update TOCTOU shape as BookingService.create: the availability
        // check above and this update aren't atomic, so a concurrent request can slip in
        // between them and trip the `bookings_confirmed_table_slot_date_key` partial
        // unique index. Surface it as the same ConflictError instead of a raw 500.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictError('Table was just booked for this slot and date');
        }
        throw error;
      }
    }

    return booking;
  },

  async list(filters: BookingListFilters): Promise<{ bookings: Booking[]; total: number }> {
    return BookingRepository.list(filters);
  },

  async availableTables(slotId: number, date: string, partySize: number): Promise<Table[]> {
    const slot = await SlotRepository.findById(slotId);
    if (!slot || !slot.isActive) {
      throw new NotFoundError('Time slot not found or inactive');
    }
    return TableRepository.findAvailable(slotId, new Date(date), partySize);
  },
};
