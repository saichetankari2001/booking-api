import { prisma } from '../lib/prisma';
import { RefreshToken } from '@prisma/client';

export const RefreshTokenRepository = {
  create(data: { tokenHash: string; adminId: number; expiresAt: Date }): Promise<RefreshToken> {
    return prisma.refreshToken.create({ data });
  },
  findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    return prisma.refreshToken.findFirst({ where: { tokenHash, revoked: false } });
  },
  revoke(id: number): Promise<RefreshToken> {
    return prisma.refreshToken.update({ where: { id }, data: { revoked: true } });
  },
};
