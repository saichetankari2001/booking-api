import { request } from './apiClient';
import { Table } from './types';

export function fetchAdminTables(): Promise<Table[]> {
  return request<Table[]>('/admin/tables', { authenticated: true });
}
