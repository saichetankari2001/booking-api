import express, { Express } from 'express';
import { healthRouter } from './routes/health.routes';
import { authRouter } from './routes/auth.routes';
import { tableRouter } from './routes/table.routes';
import { slotRouter } from './routes/slot.routes';
import { bookingRouter } from './routes/booking.routes';
import { adminBookingRouter } from './routes/adminBooking.routes';
import { errorHandler } from './middleware/errorHandler';
import './types/express.d.ts';

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(healthRouter);
  app.use(authRouter);
  app.use(tableRouter);
  app.use(slotRouter);
  app.use(bookingRouter);
  app.use(adminBookingRouter);
  app.use(errorHandler);
  return app;
}
