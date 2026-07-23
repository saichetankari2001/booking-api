import { Prisma, Booking } from '@prisma/client';
import { BookingRepository } from '../repositories/booking.repository';
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
  const table = await TableRepository.findAvailableWithSpecificTable(tableId, slotId, date, partySize, tx);
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
    const bookingDate = new Date(input.date);
    if (Number.isNaN(bookingDate.getTime()) || bookingDate < startOfToday()) {
      throw new ValidationError('date must be a valid, non-past date');
    }

    const slot = await SlotRepository.findById(input.slotId);
    if (!slot || !slot.isActive) {
      throw new NotFoundError('Time slot not found or inactive');
    }

    return BookingRepository.runInTransaction(async (tx) => {
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
  },
};
