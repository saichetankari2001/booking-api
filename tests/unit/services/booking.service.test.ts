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

    await expect(BookingService.create({ ...validInput, tableId: 5 })).rejects.toThrow(ConflictError);
  });

  it('returns NotFoundError when the chosen tableId does not exist', async () => {
    mockedTableRepo.findAvailableWithSpecificTable.mockResolvedValue(null);
    mockedTableRepo.findById.mockResolvedValue(null);

    await expect(BookingService.create({ ...validInput, tableId: 999 })).rejects.toThrow(NotFoundError);
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
    mockedBookingRepo.create.mockResolvedValue({ id: 'uuid-today', tableId: 2 } as unknown as Booking);

    await expect(BookingService.create({ ...validInput, date: todayStr })).resolves.toEqual(
      expect.objectContaining({ tableId: 2 }),
    );
  });

  it('returns ValidationError for a malformed date string (e.g. invalid month/day)', async () => {
    await expect(BookingService.create({ ...validInput, date: '2026-13-45' })).rejects.toThrow(ValidationError);
  });

  it('returns ValidationError when partySize exceeds all table capacities', async () => {
    mockedTableRepo.existsWithCapacityAtLeast.mockResolvedValue(false);

    await expect(BookingService.create({ ...validInput, partySize: 50 })).rejects.toThrow(ValidationError);
  });

  it('returns NotFoundError when slotId does not exist', async () => {
    mockedSlotRepo.findById.mockResolvedValue(null);

    await expect(BookingService.create(validInput)).rejects.toThrow(NotFoundError);
  });

  it('returns NotFoundError when slot is inactive', async () => {
    mockedSlotRepo.findById.mockResolvedValue({ ...activeSlot, isActive: false });

    await expect(BookingService.create(validInput)).rejects.toThrow(NotFoundError);
  });
});
