import { Request, Response } from 'express';
import { authenticate } from '../../../src/middleware/authenticate';
import { signAccessToken } from '../../../src/lib/jwt';
import { UnauthorizedError } from '../../../src/errors/AppError';

function mockRes(): Response {
  return {} as Response;
}

describe('authenticate middleware', () => {
  it('calls next with UnauthorizedError when header is missing', () => {
    const req = { headers: {} } as Request;
    const next = jest.fn();
    authenticate(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('calls next with UnauthorizedError for a malformed token', () => {
    const req = { headers: { authorization: 'Bearer garbage' } } as Request;
    const next = jest.fn();
    authenticate(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('attaches admin payload and calls next() with no error for a valid token', () => {
    const token = signAccessToken({ adminId: 1, email: 'a@b.com' });
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const next = jest.fn();
    authenticate(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
    expect(req.admin?.adminId).toBe(1);
    expect(req.admin?.email).toBe('a@b.com');
  });
});
