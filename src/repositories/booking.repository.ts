import { prisma } from '../lib/prisma';
import { Booking, Prisma, PrismaClient } from '@prisma/client';

type DbClient = PrismaClient | Prisma.TransactionClient;

export interface BookingListFilters {
  date?: string;
  status?: 'confirmed' | 'cancelled';
  slotId?: number;
  page: number;
  pageSize: number;
}

export interface CreateBookingData {
  date: Date;
  partySize: number;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  notes?: string;
  tableId: number;
  slotId: number;
}

export const BookingRepository = {
  findById(id: string, db: DbClient = prisma): Promise<Booking | null> {
    return db.booking.findUnique({ where: { id } });
  },

  findConflicting(
    tableId: number,
    slotId: number,
    date: Date,
    db: DbClient = prisma,
  ): Promise<Booking | null> {
    return db.booking.findFirst({ where: { tableId, slotId, date, status: 'confirmed' } });
  },

  create(data: CreateBookingData, db: DbClient = prisma): Promise<Booking> {
    return db.booking.create({ data });
  },

  updateStatus(
    id: string,
    status: 'confirmed' | 'cancelled',
    db: DbClient = prisma,
  ): Promise<Booking> {
    return db.booking.update({ where: { id }, data: { status } });
  },

  updateTable(id: string, tableId: number, db: DbClient = prisma): Promise<Booking> {
    return db.booking.update({ where: { id }, data: { tableId } });
  },

  async list(filters: BookingListFilters): Promise<{ bookings: Booking[]; total: number }> {
    const where: Prisma.BookingWhereInput = {};
    if (filters.date) where.date = new Date(filters.date);
    if (filters.status) where.status = filters.status;
    if (filters.slotId) where.slotId = filters.slotId;

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.booking.count({ where }),
    ]);

    return { bookings, total };
  },

  runInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  },
};
