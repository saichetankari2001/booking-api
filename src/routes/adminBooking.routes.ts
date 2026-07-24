import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validateParams, validateQuery, validateBody } from '../middleware/validate';
import {
  bookingIdParamSchema,
  adminListBookingsQuerySchema,
  adminUpdateBookingSchema,
} from '../schemas/booking.schema';
import {
  adminListBookings,
  adminGetBooking,
  adminUpdateBooking,
} from '../controllers/booking.controller';

export const adminBookingRouter = Router();

adminBookingRouter.get(
  '/admin/bookings',
  authenticate,
  validateQuery(adminListBookingsQuerySchema),
  adminListBookings,
);
adminBookingRouter.get(
  '/admin/bookings/:id',
  authenticate,
  validateParams(bookingIdParamSchema),
  adminGetBooking,
);
adminBookingRouter.patch(
  '/admin/bookings/:id',
  authenticate,
  validateParams(bookingIdParamSchema),
  validateBody(adminUpdateBookingSchema),
  adminUpdateBooking,
);
