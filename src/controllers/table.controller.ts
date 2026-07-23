import { RequestHandler } from 'express';
import { TableService } from '../services/table.service';
import { CreateTableInput, UpdateTableInput } from '../schemas/table.schema';

export const listTables: RequestHandler = async (_req, res, next) => {
  try {
    const tables = await TableService.listAll();
    res.status(200).json(tables);
  } catch (err) {
    next(err);
  }
};

export const createTable: RequestHandler = async (req, res, next) => {
  try {
    const table = await TableService.create(req.body as CreateTableInput);
    res.status(201).json(table);
  } catch (err) {
    next(err);
  }
};

export const updateTable: RequestHandler = async (req, res, next) => {
  try {
    const id = Number((req.params as unknown as { id: number }).id);
    const table = await TableService.update(id, req.body as UpdateTableInput);
    res.status(200).json(table);
  } catch (err) {
    next(err);
  }
};

export const deleteTable: RequestHandler = async (req, res, next) => {
  try {
    const id = Number((req.params as unknown as { id: number }).id);
    await TableService.remove(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
