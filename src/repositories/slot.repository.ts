import { prisma } from '../lib/prisma';
import { TimeSlot } from '@prisma/client';

export const SlotRepository = {
  findAllActive(): Promise<TimeSlot[]> {
    return prisma.timeSlot.findMany({ where: { isActive: true }, orderBy: { startTime: 'asc' } });
  },

  findAll(): Promise<TimeSlot[]> {
    return prisma.timeSlot.findMany({ orderBy: { startTime: 'asc' } });
  },

  findById(id: number): Promise<TimeSlot | null> {
    return prisma.timeSlot.findUnique({ where: { id } });
  },

  create(data: {
    label: string;
    startTime: string;
    durationMinutes?: number;
    isActive?: boolean;
  }): Promise<TimeSlot> {
    return prisma.timeSlot.create({ data });
  },

  update(
    id: number,
    data: { label?: string; startTime?: string; durationMinutes?: number; isActive?: boolean },
  ): Promise<TimeSlot> {
    return prisma.timeSlot.update({ where: { id }, data });
  },

  delete(id: number): Promise<TimeSlot> {
    return prisma.timeSlot.delete({ where: { id } });
  },

  countFutureConfirmedBookings(slotId: number): Promise<number> {
    return prisma.booking.count({
      where: {
        slotId,
        status: 'confirmed',
        date: { gte: new Date(new Date().toDateString()) },
      },
    });
  },
};
