import { prisma } from '../../../src/lib/prisma';

export async function resetDb() {
  await prisma.refreshToken.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.table.deleteMany();
  await prisma.timeSlot.deleteMany();
}
