import bcrypt from 'bcrypt';
import { prisma } from '../../../src/lib/prisma';

export async function seedAdmin(email = 'admin@test.com', password = 'password123') {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.admin.create({ data: { email, passwordHash } });
}
