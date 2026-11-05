/**
 * HTTP client for /api/management/*. Same shape as the task board's: one
 * `request` helper, one place that knows the base URL. The server's error
 * messages are Hebrew and are shown as they are.
 */
import { getBaseURL } from '../services/api';
import type {
  Client, ClientCard, ClientDraft, Morning, Person, PersonDraft, PersonReports, PersonWithHours,
  Project, ProjectDraft, Quote, QuoteDraft, QuotesView, Report, ReportDraft,
} from './types';

const ROOT = () => `${import.meta.env.DEV ? 'http://localhost:3000' : getBaseURL()}/api/management`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${ROOT()}${path}`, {
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    });
  } catch {
    throw new Error('אין חיבור לשרת. נסו שוב.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || 'משהו השתבש. נסו שוב.');
  }
  return res.json();
}

const send = <T>(method: string, path: string, body: unknown) =>
  request<T>(path, { method, body: JSON.stringify(body) });

const query = (params: Record<string, string | number>) =>
  new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();

export const api = {
  me: (email: string, name: string) =>
    request<{ person: Person | null }>(`/me?${query({ email, name })}`).then(r => r.person),
  morning: () => request<Morning>('/morning'),

  people: () => request<{ people: PersonWithHours[] }>('/people').then(r => r.people),
  createPerson: (draft: PersonDraft) => send<Person>('POST', '/people', draft),
  updatePerson: (id: number, draft: PersonDraft) => send<Person>('PATCH', `/people/${id}`, draft),
  personReports: (id: number) => request<PersonReports>(`/people/${id}/reports`),

  clients: () => request<{ clients: Client[] }>('/clients').then(r => r.clients),
  client: (id: number) => request<ClientCard>(`/clients/${id}`),
  createClient: (draft: ClientDraft) => send<{ id: number }>('POST', '/clients', draft),
  updateClient: (id: number, draft: ClientDraft) => send<{ id: number }>('PATCH', `/clients/${id}`, draft),
  addClientNote: (id: number, body: string, personId: number) =>
    send<{ id: number }>('POST', `/clients/${id}/notes`, { body, personId }),

  projects: () => request<{ projects: Project[] }>('/projects').then(r => r.projects),
  createProject: (draft: ProjectDraft) => send<{ id: number }>('POST', '/projects', draft),
  updateProject: (id: number, draft: ProjectDraft) => send<{ id: number }>('PATCH', `/projects/${id}`, draft),

  report: (personId: number, date: string) => request<Report>(`/report?${query({ personId, date })}`),
  saveReport: (draft: ReportDraft) => send<{ saved: number }>('PUT', '/report', draft),

  quotes: () => request<QuotesView>('/quotes'),
  createQuote: (draft: QuoteDraft) => send<Quote>('POST', '/quotes', draft),
  updateQuote: (id: number, draft: QuoteDraft) => send<Quote>('PATCH', `/quotes/${id}`, draft),

  ask: (question: string) => send<{ answer: string }>('POST', '/ask', { question }).then(r => r.answer),
};
