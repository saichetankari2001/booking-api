import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validateBody, validateParams } from '../middleware/validate';
import { createSlotSchema, updateSlotSchema, slotIdParamSchema } from '../schemas/slot.schema';
import { listSlots, adminListSlots, createSlot, updateSlot, deleteSlot } from '../controllers/slot.controller';

export const slotRouter = Router();

slotRouter.get('/slots', listSlots);
slotRouter.get('/admin/slots', authenticate, adminListSlots);
slotRouter.post('/admin/slots', authenticate, validateBody(createSlotSchema), createSlot);
slotRouter.patch(
  '/admin/slots/:id',
  authenticate,
  validateParams(slotIdParamSchema),
  validateBody(updateSlotSchema),
  updateSlot,
);
slotRouter.delete('/admin/slots/:id', authenticate, validateParams(slotIdParamSchema), deleteSlot);
