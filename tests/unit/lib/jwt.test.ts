import jwt from 'jsonwebtoken';
import {
  signAccessToken,
  verifyAccessToken,
  generateRefreshTokenValue,
  verifyRefreshTokenSignature,
} from '../../../src/lib/jwt';

describe('jwt lib', () => {
  it('signs and verifies an access token round-trip', () => {
    const token = signAccessToken({ adminId: 1, email: 'a@b.com' });
    const payload = verifyAccessToken(token);
    expect(payload.adminId).toBe(1);
    expect(payload.email).toBe('a@b.com');
  });

  it('throws when verifying a token signed with a different secret', () => {
    const bogus = jwt.sign({ adminId: 1, email: 'a@b.com' }, 'wrong-secret');
    expect(() => verifyAccessToken(bogus)).toThrow();
  });

  it('generates unique refresh token values with a jti', () => {
    const a = generateRefreshTokenValue();
    const b = generateRefreshTokenValue();
    expect(a).not.toBe(b);
    const { jti, type } = verifyRefreshTokenSignature(a);
    expect(type).toBe('refresh');
    expect(jti).toEqual(expect.any(String));
  });
});
