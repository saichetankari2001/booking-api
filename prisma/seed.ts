import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.admin.upsert({
    where: { email: 'admin@restaurant.com' },
    update: {},
    create: { email: 'admin@restaurant.com', passwordHash },
  });

  await prisma.timeSlot.createMany({
    data: [
      { label: 'Lunch 12:00', startTime: '12:00', durationMinutes: 90, isActive: true },
      { label: 'Dinner 18:00', startTime: '18:00', durationMinutes: 90, isActive: true },
      { label: 'Dinner 20:00', startTime: '20:00', durationMinutes: 90, isActive: true },
    ],
    skipDuplicates: true,
  });

  await prisma.table.createMany({
    data: [
      { name: 'Table 1', capacity: 2 },
      { name: 'Table 2', capacity: 2 },
      { name: 'Table 3', capacity: 4 },
      { name: 'Table 4', capacity: 4 },
      { name: 'Table 5', capacity: 6 },
    ],
    skipDuplicates: true,
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
