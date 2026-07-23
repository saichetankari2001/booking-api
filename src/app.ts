import express, { Express } from 'express';
import { healthRouter } from './routes/health.routes';
import { authRouter } from './routes/auth.routes';
import { tableRouter } from './routes/table.routes';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(healthRouter);
  app.use(authRouter);
  app.use(tableRouter);
  app.use(errorHandler);
  return app;
}
