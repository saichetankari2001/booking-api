import { AccessTokenPayload } from '../lib/jwt';

declare global {
  namespace Express {
    interface Request {
      admin?: AccessTokenPayload;
    }
  }
}

export {};
