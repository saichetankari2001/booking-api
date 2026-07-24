import bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { AdminRepository } from '../repositories/admin.repository';
import { RefreshTokenRepository } from '../repositories/refreshToken.repository';
import {
  signAccessToken,
  generateRefreshTokenValue,
  verifyRefreshTokenSignature,
} from '../lib/jwt';
import { UnauthorizedError } from '../errors/AppError';
import { env } from '../config/env';

function hashTokenLookup(jti: string): string {
  return createHash('sha256').update(jti).digest('hex');
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
}

export const AuthService = {
  async login(email: string, password: string): Promise<LoginResult> {
    const admin = await AdminRepository.findByEmail(email);
    if (!admin) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const accessToken = signAccessToken({ adminId: admin.id, email: admin.email });
    const refreshToken = generateRefreshTokenValue();
    const { jti } = verifyRefreshTokenSignature(refreshToken);

    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);
    await RefreshTokenRepository.create({
      tokenHash: hashTokenLookup(jti),
      adminId: admin.id,
      expiresAt,
    });

    return { accessToken, refreshToken };
  },

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    let jti: string;
    try {
      ({ jti } = verifyRefreshTokenSignature(refreshToken));
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const stored = await RefreshTokenRepository.findByTokenHash(hashTokenLookup(jti));
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const admin = await AdminRepository.findById(stored.adminId);
    if (!admin) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const accessToken = signAccessToken({ adminId: admin.id, email: admin.email });
    return { accessToken };
  },

  async logout(refreshToken: string): Promise<void> {
    let jti: string;
    try {
      ({ jti } = verifyRefreshTokenSignature(refreshToken));
    } catch {
      return;
    }

    const stored = await RefreshTokenRepository.findByTokenHash(hashTokenLookup(jti));
    if (stored && !stored.revoked) {
      await RefreshTokenRepository.revoke(stored.id);
    }
  },
};
