import { Router } from 'express';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import { createBookingSchema, bookingIdParamSchema, availableTablesQuerySchema } from '../schemas/booking.schema';
import { createBooking, getBooking, cancelBooking, getAvailableTables } from '../controllers/booking.controller';

export const bookingRouter = Router();

bookingRouter.get('/tables/available', validateQuery(availableTablesQuerySchema), getAvailableTables);
bookingRouter.post('/bookings', validateBody(createBookingSchema), createBooking);
bookingRouter.get('/bookings/:id', validateParams(bookingIdParamSchema), getBooking);
bookingRouter.delete('/bookings/:id', validateParams(bookingIdParamSchema), cancelBooking);
