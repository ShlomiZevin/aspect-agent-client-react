/**
 * Customer release notes (task #102) — the client half of
 * taskboard/routes/release-notes.routes.js on the server.
 *
 * The server returns only the note itself: a Hebrew headline, an optional body
 * and when it was published. Nothing else from the task behind it.
 */
import { apiRequest } from './api';

export interface ReleaseNote {
  headline: string;
  body: string | null;
  publishedAt: string;
}

export const releaseNotesService = {
  /**
   * Notes published since this user last pressed "got it", newest first. A
   * user the server has never seen gets an empty list and starts from now.
   */
  unseen: (userId: string, baseURL?: string) =>
    apiRequest<{ notes: ReleaseNote[] }>(
      `/api/release-notes?userId=${encodeURIComponent(userId)}`, {}, baseURL,
    ).then(r => r.notes),

  /** Marks everything up to `until` (the newest note shown) as seen. */
  markSeen: (userId: string, until: string, baseURL?: string) =>
    apiRequest<{ success: boolean }>(
      '/api/release-notes/seen',
      { method: 'POST', body: JSON.stringify({ userId, until }) },
      baseURL,
    ),
};
