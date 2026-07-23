import { TableService } from '../../../src/services/table.service';
import { TableRepository } from '../../../src/repositories/table.repository';
import { NotFoundError, ConflictError } from '../../../src/errors/AppError';

jest.mock('../../../src/repositories/table.repository');
const mockedRepo = TableRepository as jest.Mocked<typeof TableRepository>;

const table = { id: 1, name: 'Table 1', capacity: 4, description: null, createdAt: new Date() };

describe('TableService.listAll', () => {
  it('returns all tables from the repository', async () => {
    mockedRepo.findAll.mockResolvedValue([table]);
    const result = await TableService.listAll();
    expect(result).toEqual([table]);
    expect(mockedRepo.findAll).toHaveBeenCalled();
  });
});

describe('TableService.create', () => {
  it('creates a table via the repository', async () => {
    const input = { name: 'Table 1', capacity: 4 };
    mockedRepo.create.mockResolvedValue(table);
    const result = await TableService.create(input);
    expect(mockedRepo.create).toHaveBeenCalledWith(input);
    expect(result).toEqual(table);
  });
});

describe('TableService.update', () => {
  it('throws NotFoundError when table does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    await expect(TableService.update(99, { name: 'X' })).rejects.toThrow(NotFoundError);
  });

  it('updates an existing table', async () => {
    mockedRepo.findById.mockResolvedValue(table);
    mockedRepo.update.mockResolvedValue({ ...table, name: 'Updated' });
    const result = await TableService.update(1, { name: 'Updated' });
    expect(result.name).toBe('Updated');
  });
});

describe('TableService.remove', () => {
  it('throws NotFoundError when table does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    await expect(TableService.remove(99)).rejects.toThrow(NotFoundError);
  });

  it('throws ConflictError when table has future confirmed bookings', async () => {
    mockedRepo.findById.mockResolvedValue(table);
    mockedRepo.countFutureConfirmedBookings.mockResolvedValue(2);
    await expect(TableService.remove(1)).rejects.toThrow(ConflictError);
  });

  it('deletes the table when there are no future confirmed bookings', async () => {
    mockedRepo.findById.mockResolvedValue(table);
    mockedRepo.countFutureConfirmedBookings.mockResolvedValue(0);
    mockedRepo.delete.mockResolvedValue(table);
    await TableService.remove(1);
    expect(mockedRepo.delete).toHaveBeenCalledWith(1);
  });
});
