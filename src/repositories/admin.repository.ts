import { prisma } from '../lib/prisma';
import { Admin } from '@prisma/client';

export const AdminRepository = {
  findByEmail(email: string): Promise<Admin | null> {
    return prisma.admin.findUnique({ where: { email } });
  },
  findById(id: number): Promise<Admin | null> {
    return prisma.admin.findUnique({ where: { id } });
  },
  create(data: { email: string; passwordHash: string }): Promise<Admin> {
    return prisma.admin.create({ data });
  },
};
