import { apiRequest } from './api';

export interface PageComment {
  id: number;
  pageId: string;
  itemId: string;
  parentId: number | null;
  author: string;
  body: string;
  resolved: boolean;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

const base = (pageId: string) => `/api/doc-comments/${encodeURIComponent(pageId)}`;

export const pageCommentsService = {
  list: (pageId: string) =>
    apiRequest<{ comments: PageComment[] }>(base(pageId)).then(r => r.comments),

  add: (pageId: string, itemId: string, author: string, body: string, parentId?: number) =>
    apiRequest<{ comment: PageComment }>(base(pageId), {
      method: 'POST',
      body: JSON.stringify({ itemId, author, body, parentId: parentId ?? null }),
    }).then(r => r.comment),

  setResolved: (pageId: string, id: number, resolved: boolean, by: string) =>
    apiRequest<{ comment: PageComment }>(`${base(pageId)}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ resolved, by }),
    }).then(r => r.comment),

  remove: (pageId: string, id: number) =>
    apiRequest<{ ok: boolean }>(`${base(pageId)}/${id}`, { method: 'DELETE' }),

  getSettings: (pageId: string) =>
    apiRequest<{ hiddenSections: string[] }>(`${base(pageId)}/settings`).then(r => r.hiddenSections || []),

  saveSettings: (pageId: string, hiddenSections: string[], by: string) =>
    apiRequest<{ hiddenSections: string[] }>(`${base(pageId)}/settings`, {
      method: 'PUT',
      body: JSON.stringify({ hiddenSections, by }),
    }).then(r => r.hiddenSections || []),
};
