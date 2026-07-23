import {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
} from '../../../src/errors/AppError';

describe('AppError subclasses', () => {
  it.each([
    [ValidationError, 422],
    [NotFoundError, 404],
    [ConflictError, 409],
    [UnauthorizedError, 401],
  ])('%p sets statusCode %i', (ErrorClass, statusCode) => {
    const err = new (ErrorClass as new (msg: string) => AppError)('boom');
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(statusCode);
    expect(err.message).toBe('boom');
  });
});
