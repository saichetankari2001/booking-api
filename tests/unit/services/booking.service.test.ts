import { Booking, Prisma } from '@prisma/client';
import { BookingService } from '../../../src/services/booking.service';
import { BookingRepository } from '../../../src/repositories/booking.repository';
import { TableRepository } from '../../../src/repositories/table.repository';
import { SlotRepository } from '../../../src/repositories/slot.repository';
import { ValidationError, NotFoundError, ConflictError } from '../../../src/errors/AppError';

jest.mock('../../../src/repositories/booking.repository');
jest.mock('../../../src/repositories/table.repository');
jest.mock('../../../src/repositories/slot.repository');

const mockedBookingRepo = BookingRepository as jest.Mocked<typeof BookingRepository>;
const mockedTableRepo = TableRepository as jest.Mocked<typeof TableRepository>;
const mockedSlotRepo = SlotRepository as jest.Mocked<typeof SlotRepository>;

const activeSlot = {
  id: 1,
  label: 'Lunch',
  startTime: '12:00',
  durationMinutes: 90,
  isActive: true,
  createdAt: new Date(),
};

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowStr = tomorrow.toISOString().slice(0, 10);

const validInput = {
  date: tomorrowStr,
  slotId: 1,
  partySize: 2,
  guestName: 'Alice',
  guestEmail: 'alice@test.com',
};

beforeEach(() => {
  mockedBookingRepo.runInTransaction.mockImplementation((fn) => fn({} as Prisma.TransactionClient));
  mockedSlotRepo.findById.mockResolvedValue(activeSlot);
});

describe('BookingService.create', () => {
  it('auto-assigns the smallest fitting table when tableId is omitted', async () => {
    mockedTableRepo.existsWithCapacityAtLeast.mockResolvedValue(true);
    mockedTableRepo.findAvailable.mockResolvedValue([
      { id: 2, name: 'Table 2', capacity: 2, description: null, createdAt: new Date() },
      { id: 3, name: 'Table 3', capacity: 4, description: null, createdAt: new Date() },
    ]);
    mockedBookingRepo.create.mockResolvedValue({ id: 'uuid-1', tableId: 2 } as unknown as Booking);

    const result = await BookingService.create(validInput);

    expect(mockedBookingRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tableId: 2 }),
      expect.anything(),
    );
    expect(result.tableId).toBe(2);
  });

  it('creates a booking with a specific tableId when provided and available', async () => {
    mockedTableRepo.findAvailableWithSpecificTable.mockResolvedValue({
      id: 5,
      name: 'Table 5',
      capacity: 4,
      description: null,
      createdAt: new Date(),
    });
    mockedBookingRepo.create.mockResolvedValue({ id: 'uuid-2', tableId: 5 } as unknown as Booking);

    const result = await BookingService.create({ ...validInput, tableId: 5 });

    expect(result.tableId).toBe(5);
  });

  it('returns ConflictError when the chosen table is already booked at that slot+date', async () => {
    mockedTableRepo.findAvailableWithSpecificTable.mockResolvedValue(null);
    mockedTableRepo.findById.mockResolvedValue({
      id: 5,
      name: 'Table 5',
      capacity: 4,
      description: null,
      createdAt: new Date(),
    });

    await expect(BookingService.create({ ...validInput, tableId: 5 })).rejects.toThrow(
      ConflictError,
    );
  });

  it('returns NotFoundError when the chosen tableId does not exist', async () => {
    mockedTableRepo.findAvailableWithSpecificTable.mockResolvedValue(null);
    mockedTableRepo.findById.mockResolvedValue(null);

    await expect(BookingService.create({ ...validInput, tableId: 999 })).rejects.toThrow(
      NotFoundError,
    );
  });

  it('returns ConflictError when no tables are available for auto-assign', async () => {
    mockedTableRepo.existsWithCapacityAtLeast.mockResolvedValue(true);
    mockedTableRepo.findAvailable.mockResolvedValue([]);

    await expect(BookingService.create(validInput)).rejects.toThrow(ConflictError);
  });

  it('returns ValidationError when date is in the past', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await expect(
      BookingService.create({ ...validInput, date: yesterday.toISOString().slice(0, 10) }),
    ).rejects.toThrow(ValidationError);
  });

  it('does not reject a same-day booking (regression: UTC vs local midnight comparison)', async () => {
    // Regression test for the bug where `bookingDate` (parsed as UTC midnight from
    // "YYYY-MM-DD") was compared against `startOfToday()` (local midnight). On any
    // server running behind UTC, that made today's date look like it was in the past.
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate(),
    ).padStart(2, '0')}`;

    mockedTableRepo.existsWithCapacityAtLeast.mockResolvedValue(true);
    mockedTableRepo.findAvailable.mockResolvedValue([
      { id: 2, name: 'Table 2', capacity: 2, description: null, createdAt: new Date() },
    ]);
    mockedBookingRepo.create.mockResolvedValue({
      id: 'uuid-today',
      tableId: 2,
    } as unknown as Booking);

    await expect(BookingService.create({ ...validInput, date: todayStr })).resolves.toEqual(
      expect.objectContaining({ tableId: 2 }),
    );
  });

  it('returns ValidationError for a malformed date string (e.g. invalid month/day)', async () => {
    await expect(BookingService.create({ ...validInput, date: '2026-13-45' })).rejects.toThrow(
      ValidationError,
    );
  });

  it('returns ValidationError when partySize exceeds all table capacities', async () => {
    mockedTableRepo.existsWithCapacityAtLeast.mockResolvedValue(false);

    await expect(BookingService.create({ ...validInput, partySize: 50 })).rejects.toThrow(
      ValidationError,
    );
  });

  it('returns NotFoundError when slotId does not exist', async () => {
    mockedSlotRepo.findById.mockResolvedValue(null);

    await expect(BookingService.create(validInput)).rejects.toThrow(NotFoundError);
  });

  it('returns NotFoundError when slot is inactive', async () => {
    mockedSlotRepo.findById.mockResolvedValue({ ...activeSlot, isActive: false });

    await expect(BookingService.create(validInput)).rejects.toThrow(NotFoundError);
  });

  it('returns ConflictError (not the raw Prisma error) when BookingRepository.create hits the unique index race', async () => {
    // Regression test for the double-booking TOCTOU: two concurrent requests can both
    // pass the availability check and both reach BookingRepository.create, but only one
    // insert can win against the `bookings_confirmed_table_slot_date_key` partial unique
    // index. The loser's insert throws a P2002 PrismaClientKnownRequestError, which must
    // be translated into a ConflictError rather than leaking as an unhandled 500.
    mockedTableRepo.existsWithCapacityAtLeast.mockResolvedValue(true);
    mockedTableRepo.findAvailable.mockResolvedValue([
      { id: 2, name: 'Table 2', capacity: 2, description: null, createdAt: new Date() },
    ]);
    const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.19.1',
    });
    mockedBookingRepo.create.mockRejectedValue(p2002Error);

    await expect(BookingService.create(validInput)).rejects.toThrow(ConflictError);
  });

  it('re-throws non-P2002 errors from BookingRepository.create unchanged', async () => {
    mockedTableRepo.existsWithCapacityAtLeast.mockResolvedValue(true);
    mockedTableRepo.findAvailable.mockResolvedValue([
      { id: 2, name: 'Table 2', capacity: 2, description: null, createdAt: new Date() },
    ]);
    const otherError = new Error('connection lost');
    mockedBookingRepo.create.mockRejectedValue(otherError);

    await expect(BookingService.create(validInput)).rejects.toThrow('connection lost');
  });
});

describe('BookingService.getById', () => {
  it('returns the booking when found', async () => {
    mockedBookingRepo.findById.mockResolvedValue({ id: 'uuid-1' } as unknown as Booking);
    const result = await BookingService.getById('uuid-1');
    expect(result.id).toBe('uuid-1');
  });

  it('throws NotFoundError when not found', async () => {
    mockedBookingRepo.findById.mockResolvedValue(null);
    await expect(BookingService.getById('missing')).rejects.toThrow(NotFoundError);
  });
});

describe('BookingService.cancel', () => {
  it('sets status to cancelled', async () => {
    mockedBookingRepo.findById.mockResolvedValue({
      id: 'uuid-1',
      status: 'confirmed',
    } as unknown as Booking);
    mockedBookingRepo.updateStatus.mockResolvedValue({
      id: 'uuid-1',
      status: 'cancelled',
    } as unknown as Booking);
    const result = await BookingService.cancel('uuid-1');
    expect(result.status).toBe('cancelled');
  });

  it('throws NotFoundError when booking does not exist', async () => {
    mockedBookingRepo.findById.mockResolvedValue(null);
    await expect(BookingService.cancel('missing')).rejects.toThrow(NotFoundError);
  });
});

describe('BookingService.adminUpdate', () => {
  const existingBooking = {
    id: 'uuid-1',
    tableId: 2,
    slotId: 1,
    date: new Date(),
    partySize: 2,
    status: 'confirmed',
  } as unknown as Booking;

  it('cancels the booking when status is cancelled', async () => {
    mockedBookingRepo.findById.mockResolvedValue(existingBooking);
    mockedBookingRepo.updateStatus.mockResolvedValue({ ...existingBooking, status: 'cancelled' });
    const result = await BookingService.adminUpdate('uuid-1', { status: 'cancelled' });
    expect(result.status).toBe('cancelled');
  });

  it('returns the booking as-is when tableId equals its current table (no-op reassignment)', async () => {
    mockedBookingRepo.findById.mockResolvedValue(existingBooking);
    const result = await BookingService.adminUpdate('uuid-1', { tableId: existingBooking.tableId });
    expect(result).toBe(existingBooking);
    expect(mockedTableRepo.findAvailableWithSpecificTable).not.toHaveBeenCalled();
    expect(mockedBookingRepo.updateTable).not.toHaveBeenCalled();
  });

  it('reassigns the table when tableId is provided and available', async () => {
    mockedBookingRepo.findById.mockResolvedValue(existingBooking);
    mockedTableRepo.findAvailableWithSpecificTable.mockResolvedValue({
      id: 7,
      name: 'Table 7',
      capacity: 4,
      description: null,
      createdAt: new Date(),
    });
    mockedBookingRepo.updateTable.mockResolvedValue({ ...existingBooking, tableId: 7 });
    const result = await BookingService.adminUpdate('uuid-1', { tableId: 7 });
    expect(result.tableId).toBe(7);
  });

  it('throws ConflictError when the new table is unavailable', async () => {
    mockedBookingRepo.findById.mockResolvedValue(existingBooking);
    mockedTableRepo.findAvailableWithSpecificTable.mockResolvedValue(null);
    await expect(BookingService.adminUpdate('uuid-1', { tableId: 9 })).rejects.toThrow(
      ConflictError,
    );
  });

  it('returns ConflictError (not the raw Prisma error) when BookingRepository.updateTable hits the unique index race', async () => {
    // Same TOCTOU shape as BookingService.create: the availability check and
    // BookingRepository.updateTable aren't atomic, so a concurrent request can slip in
    // between them and trip the `bookings_confirmed_table_slot_date_key` partial unique
    // index. The P2002 error must be translated into a ConflictError, not leaked raw.
    mockedBookingRepo.findById.mockResolvedValue(existingBooking);
    mockedTableRepo.findAvailableWithSpecificTable.mockResolvedValue({
      id: 7,
      name: 'Table 7',
      capacity: 4,
      description: null,
      createdAt: new Date(),
    });
    const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.19.1',
    });
    mockedBookingRepo.updateTable.mockRejectedValue(p2002Error);

    await expect(BookingService.adminUpdate('uuid-1', { tableId: 7 })).rejects.toThrow(
      ConflictError,
    );
  });

  it('re-throws non-P2002 errors from BookingRepository.updateTable unchanged', async () => {
    mockedBookingRepo.findById.mockResolvedValue(existingBooking);
    mockedTableRepo.findAvailableWithSpecificTable.mockResolvedValue({
      id: 7,
      name: 'Table 7',
      capacity: 4,
      description: null,
      createdAt: new Date(),
    });
    const otherError = new Error('connection lost');
    mockedBookingRepo.updateTable.mockRejectedValue(otherError);

    await expect(BookingService.adminUpdate('uuid-1', { tableId: 7 })).rejects.toThrow(
      'connection lost',
    );
  });

  it('treats tableId: 0 as a real reassignment request rather than a silent no-op', async () => {
    // Regression test for the `if (input.tableId)` truthy-check bug: a hypothetical
    // tableId of 0 must still trigger the reassignment path (even though Prisma serial
    // IDs start at 1 and 0 is currently unreachable in practice, the check should be
    // correct regardless).
    const bookingOnTableFive = { ...existingBooking, tableId: 5 };
    mockedBookingRepo.findById.mockResolvedValue(bookingOnTableFive);
    mockedTableRepo.findAvailableWithSpecificTable.mockResolvedValue(null);

    await expect(BookingService.adminUpdate('uuid-1', { tableId: 0 })).rejects.toThrow(
      ConflictError,
    );
    expect(mockedTableRepo.findAvailableWithSpecificTable).toHaveBeenCalledWith(
      0,
      1,
      expect.any(Date),
      2,
    );
  });

  it('throws NotFoundError when booking does not exist', async () => {
    mockedBookingRepo.findById.mockResolvedValue(null);
    await expect(BookingService.adminUpdate('missing', { status: 'cancelled' })).rejects.toThrow(
      NotFoundError,
    );
  });

  it('returns the booking as-is when neither status nor tableId is provided', async () => {
    mockedBookingRepo.findById.mockResolvedValue(existingBooking);
    const result = await BookingService.adminUpdate('uuid-1', {});
    expect(result).toBe(existingBooking);
  });
});

describe('BookingService.list', () => {
  it('delegates to BookingRepository.list with the given filters', async () => {
    const filters = { page: 1, pageSize: 10 };
    const listResult = { bookings: [{ id: 'uuid-1' }] as unknown as Booking[], total: 1 };
    mockedBookingRepo.list.mockResolvedValue(listResult);
    const result = await BookingService.list(filters);
    expect(mockedBookingRepo.list).toHaveBeenCalledWith(filters);
    expect(result).toBe(listResult);
  });
});

describe('BookingService.availableTables', () => {
  it('throws NotFoundError when slot is inactive', async () => {
    mockedSlotRepo.findById.mockResolvedValue({ ...activeSlot, isActive: false });
    await expect(BookingService.availableTables(1, tomorrowStr, 2)).rejects.toThrow(NotFoundError);
  });

  it('returns available tables for an active slot', async () => {
    mockedSlotRepo.findById.mockResolvedValue(activeSlot);
    mockedTableRepo.findAvailable.mockResolvedValue([
      { id: 2, name: 'Table 2', capacity: 2, description: null, createdAt: new Date() },
    ]);
    const result = await BookingService.availableTables(1, tomorrowStr, 2);
    expect(result).toHaveLength(1);
  });
});
