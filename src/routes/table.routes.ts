import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validateBody, validateParams } from '../middleware/validate';
import { createTableSchema, updateTableSchema, tableIdParamSchema } from '../schemas/table.schema';
import { listTables, createTable, updateTable, deleteTable } from '../controllers/table.controller';

export const tableRouter = Router();

tableRouter.get('/admin/tables', authenticate, listTables);
tableRouter.post('/admin/tables', authenticate, validateBody(createTableSchema), createTable);
tableRouter.patch(
  '/admin/tables/:id',
  authenticate,
  validateParams(tableIdParamSchema),
  validateBody(updateTableSchema),
  updateTable,
);
tableRouter.delete(
  '/admin/tables/:id',
  authenticate,
  validateParams(tableIdParamSchema),
  deleteTable,
);
