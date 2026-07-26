import { request } from './apiClient';
import { Table } from './types';
import { CreateTableFormInput, UpdateTableFormInput } from '../lib/schemas/table.schema';

export function fetchAdminTables(): Promise<Table[]> {
  return request<Table[]>('/admin/tables', { authenticated: true });
}

export function createAdminTable(payload: CreateTableFormInput): Promise<Table> {
  return request<Table>('/admin/tables', {
    method: 'POST',
    body: JSON.stringify(payload),
    authenticated: true,
  });
}

export function updateAdminTable(id: number, payload: UpdateTableFormInput): Promise<Table> {
  return request<Table>(`/admin/tables/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    authenticated: true,
  });
}

export function deleteAdminTable(id: number): Promise<void> {
  return request<void>(`/admin/tables/${id}`, { method: 'DELETE', authenticated: true });
}
