import bcrypt from 'bcrypt';
import { AuthService } from '../../../src/services/auth.service';
import { AdminRepository } from '../../../src/repositories/admin.repository';
import { RefreshTokenRepository } from '../../../src/repositories/refreshToken.repository';
import { UnauthorizedError } from '../../../src/errors/AppError';

jest.mock('../../../src/repositories/admin.repository');
jest.mock('../../../src/repositories/refreshToken.repository');
jest.mock('bcrypt');

const mockedAdminRepo = AdminRepository as jest.Mocked<typeof AdminRepository>;
const mockedRefreshRepo = RefreshTokenRepository as jest.Mocked<typeof RefreshTokenRepository>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

const admin = {
  id: 1,
  email: 'admin@restaurant.com',
  passwordHash: 'hashed',
  createdAt: new Date(),
};

describe('AuthService.login', () => {
  it('returns access and refresh tokens for valid credentials', async () => {
    mockedAdminRepo.findByEmail.mockResolvedValue(admin);
    mockedBcrypt.compare.mockResolvedValue(true as never);
    mockedRefreshRepo.create.mockResolvedValue({
      id: 1,
      tokenHash: 'x',
      adminId: 1,
      expiresAt: new Date(),
      revoked: false,
      createdAt: new Date(),
    });

    const result = await AuthService.login('admin@restaurant.com', 'correct-password');

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(mockedRefreshRepo.create).toHaveBeenCalledTimes(1);
  });

  it('throws UnauthorizedError when admin does not exist', async () => {
    mockedAdminRepo.findByEmail.mockResolvedValue(null);
    await expect(AuthService.login('nope@restaurant.com', 'x')).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when password does not match', async () => {
    mockedAdminRepo.findByEmail.mockResolvedValue(admin);
    mockedBcrypt.compare.mockResolvedValue(false as never);
    await expect(AuthService.login('admin@restaurant.com', 'wrong')).rejects.toThrow(
      UnauthorizedError,
    );
  });
});

describe('AuthService.refresh', () => {
  it('throws UnauthorizedError for a malformed refresh token', async () => {
    await expect(AuthService.refresh('not-a-jwt')).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when stored token is revoked', async () => {
    const { generateRefreshTokenValue } = jest.requireActual('../../../src/lib/jwt');
    const token = generateRefreshTokenValue();
    mockedRefreshRepo.findByTokenHash.mockResolvedValue({
      id: 1,
      tokenHash: 'x',
      adminId: 1,
      expiresAt: new Date(Date.now() + 100000),
      revoked: true,
      createdAt: new Date(),
    });
    await expect(AuthService.refresh(token)).rejects.toThrow(UnauthorizedError);
  });

  it('issues a new access token for a valid, unrevoked refresh token', async () => {
    const { generateRefreshTokenValue } = jest.requireActual('../../../src/lib/jwt');
    const token = generateRefreshTokenValue();
    mockedRefreshRepo.findByTokenHash.mockResolvedValue({
      id: 1,
      tokenHash: 'x',
      adminId: 1,
      expiresAt: new Date(Date.now() + 100000),
      revoked: false,
      createdAt: new Date(),
    });
    mockedAdminRepo.findById.mockResolvedValue(admin);

    const result = await AuthService.refresh(token);
    expect(result.accessToken).toEqual(expect.any(String));
  });
});

describe('AuthService.logout', () => {
  it('revokes the stored refresh token', async () => {
    const { generateRefreshTokenValue } = jest.requireActual('../../../src/lib/jwt');
    const token = generateRefreshTokenValue();
    mockedRefreshRepo.findByTokenHash.mockResolvedValue({
      id: 5,
      tokenHash: 'x',
      adminId: 1,
      expiresAt: new Date(Date.now() + 100000),
      revoked: false,
      createdAt: new Date(),
    });

    await AuthService.logout(token);

    expect(mockedRefreshRepo.revoke).toHaveBeenCalledWith(5);
  });
});
