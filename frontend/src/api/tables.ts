import { request } from './apiClient';
import { Table } from './types';

export interface AvailableTablesParams {
  slotId: number;
  date: string;
  partySize: number;
}

export function fetchAvailableTables(params: AvailableTablesParams): Promise<Table[]> {
  const query = new URLSearchParams({
    slotId: String(params.slotId),
    date: params.date,
    partySize: String(params.partySize),
  });
  return request<Table[]>(`/tables/available?${query.toString()}`);
}
