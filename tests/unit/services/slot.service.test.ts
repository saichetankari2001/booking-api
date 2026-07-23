import { SlotService } from '../../../src/services/slot.service';
import { SlotRepository } from '../../../src/repositories/slot.repository';
import { NotFoundError, ConflictError } from '../../../src/errors/AppError';

jest.mock('../../../src/repositories/slot.repository');
const mockedRepo = SlotRepository as jest.Mocked<typeof SlotRepository>;

const slot = {
  id: 1,
  label: 'Lunch',
  startTime: '12:00',
  durationMinutes: 90,
  isActive: true,
  createdAt: new Date(),
};

describe('SlotService.listActive', () => {
  it('returns active slots from the repository', async () => {
    mockedRepo.findAllActive.mockResolvedValue([slot]);
    const result = await SlotService.listActive();
    expect(result).toEqual([slot]);
    expect(mockedRepo.findAllActive).toHaveBeenCalled();
  });
});

describe('SlotService.listAll', () => {
  it('returns all slots from the repository', async () => {
    mockedRepo.findAll.mockResolvedValue([slot]);
    const result = await SlotService.listAll();
    expect(result).toEqual([slot]);
    expect(mockedRepo.findAll).toHaveBeenCalled();
  });
});

describe('SlotService.create', () => {
  it('creates a slot via the repository', async () => {
    const input = { label: 'Lunch', startTime: '12:00' };
    mockedRepo.create.mockResolvedValue(slot);
    const result = await SlotService.create(input);
    expect(mockedRepo.create).toHaveBeenCalledWith(input);
    expect(result).toEqual(slot);
  });
});

describe('SlotService.update', () => {
  it('throws NotFoundError when slot does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    await expect(SlotService.update(99, { label: 'X' })).rejects.toThrow(NotFoundError);
  });

  it('updates an existing slot', async () => {
    mockedRepo.findById.mockResolvedValue(slot);
    mockedRepo.update.mockResolvedValue({ ...slot, label: 'Updated' });
    const result = await SlotService.update(1, { label: 'Updated' });
    expect(result.label).toBe('Updated');
  });
});

describe('SlotService.remove', () => {
  it('throws NotFoundError when slot does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    await expect(SlotService.remove(99)).rejects.toThrow(NotFoundError);
  });

  it('throws ConflictError when slot has future confirmed bookings', async () => {
    mockedRepo.findById.mockResolvedValue(slot);
    mockedRepo.countFutureConfirmedBookings.mockResolvedValue(1);
    await expect(SlotService.remove(1)).rejects.toThrow(ConflictError);
  });

  it('deletes the slot when there are no future confirmed bookings', async () => {
    mockedRepo.findById.mockResolvedValue(slot);
    mockedRepo.countFutureConfirmedBookings.mockResolvedValue(0);
    mockedRepo.delete.mockResolvedValue(slot);
    await SlotService.remove(1);
    expect(mockedRepo.delete).toHaveBeenCalledWith(1);
  });
});
