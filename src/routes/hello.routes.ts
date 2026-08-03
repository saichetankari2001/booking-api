import { Router } from 'express';

export const helloRouter = Router();

helloRouter.get('/hello', (_req, res) => {
  res.status(200).json({ message: 'Hello World' });
});
