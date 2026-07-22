import { parseEnv, EnvValidationError } from '../../../src/config/env';

describe('parseEnv', () => {
  const validEnv = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    JWT_SECRET: 'super-secret',
  };

  it('parses valid env with defaults applied', () => {
    const result = parseEnv(validEnv);
    expect(result.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(result.JWT_SECRET).toBe(validEnv.JWT_SECRET);
    expect(result.NODE_ENV).toBe('development');
    expect(result.PORT).toBe(3000);
    expect(result.JWT_ACCESS_EXPIRES_IN).toBe('15m');
    expect(result.JWT_REFRESH_EXPIRES_IN_DAYS).toBe(7);
  });

  it('throws EnvValidationError when DATABASE_URL is missing', () => {
    const { DATABASE_URL, ...rest } = validEnv;
    expect(() => parseEnv(rest)).toThrow(EnvValidationError);
  });

  it('throws EnvValidationError when JWT_SECRET is missing', () => {
    const { JWT_SECRET, ...rest } = validEnv;
    expect(() => parseEnv(rest)).toThrow(EnvValidationError);
  });

  it('coerces PORT from string to number', () => {
    const result = parseEnv({ ...validEnv, PORT: '4000' });
    expect(result.PORT).toBe(4000);
  });
});
