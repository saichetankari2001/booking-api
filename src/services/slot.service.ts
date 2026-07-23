import { SlotRepository } from '../repositories/slot.repository';
import { NotFoundError, ConflictError } from '../errors/AppError';
import { TimeSlot } from '@prisma/client';

export const SlotService = {
  listActive(): Promise<TimeSlot[]> {
    return SlotRepository.findAllActive();
  },

  listAll(): Promise<TimeSlot[]> {
    return SlotRepository.findAll();
  },

  create(input: {
    label: string;
    startTime: string;
    durationMinutes?: number;
    isActive?: boolean;
  }): Promise<TimeSlot> {
    return SlotRepository.create(input);
  },

  async update(
    id: number,
    input: { label?: string; startTime?: string; durationMinutes?: number; isActive?: boolean },
  ): Promise<TimeSlot> {
    const existing = await SlotRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Time slot ${id} not found`);
    }
    return SlotRepository.update(id, input);
  },

  async remove(id: number): Promise<void> {
    const existing = await SlotRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Time slot ${id} not found`);
    }

    const futureBookings = await SlotRepository.countFutureConfirmedBookings(id);
    if (futureBookings > 0) {
      throw new ConflictError('Cannot delete a time slot with future confirmed bookings');
    }

    await SlotRepository.delete(id);
  },
};
