/**
 * The Aspect demo's financial statements (task #116).
 *
 * Read-only, demo-only: the server route is hardcoded to the demo's own books,
 * so there is no dataset to pass and nothing here can reach a real client.
 */
import { apiRequest } from './api';
import type { StatementBlock } from '../components/finance/StatementTable';
import type { Localized } from '../types/apps';

export interface FinanceCatalogEntry {
  id: string;
  name: Localized;
}

export interface FinanceCatalog {
  reports: FinanceCatalogEntry[];
  periods: FinanceCatalogEntry[];
}

export interface FinanceStatement {
  success: boolean;
  title: string;
  periods?: { a?: string; b?: string; data_closed_through?: string };
  notice?: string | null;
  columns: string[];
  blocks: StatementBlock[];
  highlights?: Record<string, unknown>;
}

export const financeService = {
  catalog: (baseURL?: string) =>
    apiRequest<FinanceCatalog>('/api/aspect-finance/catalog', {}, baseURL),

  report: (params: { report: string; preset?: string; branch?: string; line?: string }, baseURL?: string) => {
    const qs = new URLSearchParams();
    qs.set('report', params.report);
    if (params.preset) qs.set('preset', params.preset);
    if (params.branch) qs.set('branch', params.branch);
    if (params.line) qs.set('line', params.line);
    return apiRequest<FinanceStatement>(`/api/aspect-finance/report?${qs.toString()}`, {}, baseURL);
  },
};
