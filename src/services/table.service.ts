import { TableRepository } from '../repositories/table.repository';
import { NotFoundError, ConflictError } from '../errors/AppError';
import { Table } from '@prisma/client';

export const TableService = {
  listAll(): Promise<Table[]> {
    return TableRepository.findAll();
  },

  create(input: { name: string; capacity: number; description?: string }): Promise<Table> {
    return TableRepository.create(input);
  },

  async update(id: number, input: { name?: string; capacity?: number; description?: string }): Promise<Table> {
    const existing = await TableRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Table ${id} not found`);
    }
    return TableRepository.update(id, input);
  },

  async remove(id: number): Promise<void> {
    const existing = await TableRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Table ${id} not found`);
    }

    const futureBookings = await TableRepository.countFutureConfirmedBookings(id);
    if (futureBookings > 0) {
      throw new ConflictError('Cannot delete a table with future confirmed bookings');
    }

    await TableRepository.delete(id);
  },
};
