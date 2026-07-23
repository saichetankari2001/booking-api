import jwt, { SignOptions } from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { randomBytes } from 'crypto';
import { env } from '../config/env';

export interface AccessTokenPayload {
  adminId: number;
  email: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = { expiresIn: env.JWT_ACCESS_EXPIRES_IN as StringValue };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}

export interface RefreshTokenPayload {
  type: 'refresh';
  jti: string;
}

export function generateRefreshTokenValue(): string {
  const jti = randomBytes(16).toString('hex');
  const options: SignOptions = { expiresIn: `${env.JWT_REFRESH_EXPIRES_IN_DAYS}d` as StringValue };
  return jwt.sign({ type: 'refresh', jti }, env.JWT_SECRET, options);
}

export function verifyRefreshTokenSignature(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as RefreshTokenPayload;
}
