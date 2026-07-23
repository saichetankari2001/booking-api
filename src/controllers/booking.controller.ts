import { RequestHandler } from 'express';
import { BookingService } from '../services/booking.service';
import { CreateBookingInput } from '../schemas/booking.schema';

export const createBooking: RequestHandler = async (req, res, next) => {
  try {
    const booking = await BookingService.create(req.body as CreateBookingInput);
    res.status(201).json(booking);
  } catch (err) {
    next(err);
  }
};

export const getBooking: RequestHandler = async (req, res, next) => {
  try {
    const booking = await BookingService.getById((req.params as unknown as { id: string }).id);
    res.status(200).json(booking);
  } catch (err) {
    next(err);
  }
};

export const cancelBooking: RequestHandler = async (req, res, next) => {
  try {
    await BookingService.cancel((req.params as unknown as { id: string }).id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

export const getAvailableTables: RequestHandler = async (req, res, next) => {
  try {
    const { slotId, date, partySize } = req.query as unknown as {
      slotId: number;
      date: string;
      partySize: number;
    };
    const tables = await BookingService.availableTables(slotId, date, partySize);
    res.status(200).json(tables);
  } catch (err) {
    next(err);
  }
};
