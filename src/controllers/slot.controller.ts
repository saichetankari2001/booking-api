import { RequestHandler } from 'express';
import { SlotService } from '../services/slot.service';
import { CreateSlotInput, UpdateSlotInput } from '../schemas/slot.schema';

export const listSlots: RequestHandler = async (_req, res, next) => {
  try {
    const slots = await SlotService.listActive();
    res.status(200).json(slots);
  } catch (err) {
    next(err);
  }
};

export const adminListSlots: RequestHandler = async (_req, res, next) => {
  try {
    const slots = await SlotService.listAll();
    res.status(200).json(slots);
  } catch (err) {
    next(err);
  }
};

export const createSlot: RequestHandler = async (req, res, next) => {
  try {
    const slot = await SlotService.create(req.body as CreateSlotInput);
    res.status(201).json(slot);
  } catch (err) {
    next(err);
  }
};

export const updateSlot: RequestHandler = async (req, res, next) => {
  try {
    const id = Number((req.params as unknown as { id: number }).id);
    const slot = await SlotService.update(id, req.body as UpdateSlotInput);
    res.status(200).json(slot);
  } catch (err) {
    next(err);
  }
};

export const deleteSlot: RequestHandler = async (req, res, next) => {
  try {
    const id = Number((req.params as unknown as { id: number }).id);
    await SlotService.remove(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
