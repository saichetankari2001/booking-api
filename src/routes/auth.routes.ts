import { Router } from 'express';
import { validateBody } from '../middleware/validate';
import { loginSchema, refreshSchema } from '../schemas/auth.schema';
import { login, refresh, logout } from '../controllers/auth.controller';

export const authRouter = Router();

authRouter.post('/auth/login', validateBody(loginSchema), login);
authRouter.post('/auth/refresh', validateBody(refreshSchema), refresh);
authRouter.post('/auth/logout', validateBody(refreshSchema), logout);
