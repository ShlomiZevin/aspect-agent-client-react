/** Files on a LYBI board task (task #954). */

export interface TaskAttachment {
  id: number;
  taskId: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string | null;
  createdAt: string;
}

const getBaseURL = (): string => {
  if (import.meta.env.DEV) return 'http://localhost:3000';
  return import.meta.env.VITE_API_URL || 'https://aspect-server-138665194481.us-central1.run.app';
};

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API Error: ${res.status}`);
  }
  return res.json();
}

export async function listAttachments(taskId: number): Promise<TaskAttachment[]> {
  const data = await readJson<{ attachments: TaskAttachment[] }>(await fetch(`${getBaseURL()}/api/tasks/${taskId}/attachments`));
  return data.attachments;
}

export async function uploadAttachment(taskId: number, file: File, uploadedBy: string | null): Promise<TaskAttachment> {
  const form = new FormData();
  form.append('file', file);
  if (uploadedBy) form.append('uploadedBy', uploadedBy);
  const data = await readJson<{ attachment: TaskAttachment }>(
    await fetch(`${getBaseURL()}/api/tasks/${taskId}/attachments`, { method: 'POST', body: form }));
  return data.attachment;
}

export async function deleteAttachment(taskId: number, id: number): Promise<void> {
  await readJson(await fetch(`${getBaseURL()}/api/tasks/${taskId}/attachments/${id}`, { method: 'DELETE' }));
}

/** Opens in a new tab when the browser can show it (images, PDF, text); downloads otherwise. */
export function attachmentUrl(taskId: number, id: number): string {
  return `${getBaseURL()}/api/tasks/${taskId}/attachments/${id}`;
}
