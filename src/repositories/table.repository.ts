import { prisma } from '../lib/prisma';
import { Table, PrismaClient, Prisma } from '@prisma/client';
import { todayUtcMidnight } from '../lib/dateUtils';

type DbClient = PrismaClient | Prisma.TransactionClient;

export const TableRepository = {
  findAll(): Promise<Table[]> {
    return prisma.table.findMany({ orderBy: { id: 'asc' } });
  },

  findById(id: number, db: DbClient = prisma): Promise<Table | null> {
    return db.table.findUnique({ where: { id } });
  },

  create(data: { name: string; capacity: number; description?: string }): Promise<Table> {
    return prisma.table.create({ data });
  },

  update(
    id: number,
    data: { name?: string; capacity?: number; description?: string },
  ): Promise<Table> {
    return prisma.table.update({ where: { id }, data });
  },

  delete(id: number): Promise<Table> {
    return prisma.table.delete({ where: { id } });
  },

  countFutureConfirmedBookings(tableId: number): Promise<number> {
    return prisma.booking.count({
      where: {
        tableId,
        status: 'confirmed',
        date: { gte: todayUtcMidnight() },
      },
    });
  },

  async existsWithCapacityAtLeast(partySize: number, db: DbClient = prisma): Promise<boolean> {
    const count = await db.table.count({ where: { capacity: { gte: partySize } } });
    return count > 0;
  },

  findAvailable(
    slotId: number,
    date: Date,
    partySize: number,
    db: DbClient = prisma,
  ): Promise<Table[]> {
    return db.table.findMany({
      where: {
        capacity: { gte: partySize },
        bookings: { none: { slotId, date, status: 'confirmed' } },
      },
      orderBy: { capacity: 'asc' },
    });
  },

  findAvailableWithSpecificTable(
    tableId: number,
    slotId: number,
    date: Date,
    partySize: number,
    db: DbClient = prisma,
  ): Promise<Table | null> {
    return db.table.findFirst({
      where: {
        id: tableId,
        capacity: { gte: partySize },
        bookings: { none: { slotId, date, status: 'confirmed' } },
      },
    });
  },
};
