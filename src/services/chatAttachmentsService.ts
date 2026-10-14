/**
 * Files attached in chat (task #100) — talks to /api/chat-attachments on the
 * agent server (chat-attachments/ there).
 *
 * A message that carries files is saved with each file's digest between
 * markers, right after the user's own text:
 *   <<<ATTACHED_FILE id="att_…" name="report.xlsx" kind="spreadsheet">>> … <<<END_ATTACHED_FILE>>>
 * The model reads the digest; the UI never shows it — splitAttachments()
 * turns the blocks back into file chips.
 */
import { getBaseURL } from './api';

export type AttachmentKind = 'spreadsheet' | 'pdf' | 'document' | 'text' | 'image';

export interface ChatAttachmentRef {
  id: string;
  filename: string;
  kind: AttachmentKind;
  sizeBytes?: number;
  /** One line from the server, e.g. "99 rows × 33 columns". */
  summary?: string;
}

/** A query_attached_file result, as a data_table step carries it — re-run to show or export the full table. */
export interface FileQueryRef {
  attachmentId: string;
  spec: Record<string, unknown>;
}

/** Re-run a file query: the full rows, or (format "xlsx") an Excel download. */
export async function runFileQuery(ref: FileQueryRef, baseURL?: string): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> {
  const res = await fetch(`${baseURL || getBaseURL()}/api/chat-attachments/${ref.attachmentId}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spec: ref.spec }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Query failed (${res.status})`);
  return data;
}

export async function exportFileQuery(ref: FileQueryRef, displayColumns: unknown, title: string | undefined, baseURL?: string): Promise<Blob> {
  const res = await fetch(`${baseURL || getBaseURL()}/api/chat-attachments/${ref.attachmentId}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spec: ref.spec, format: 'xlsx', displayColumns, title }),
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  return res.blob();
}

/** What the file picker accepts — the server rejects anything it can't read either way. */
export const ATTACHMENT_ACCEPT = '.xlsx,.xlsm,.xls,.ods,.csv,.tsv,.pdf,.docx,.txt,.md,.json,.xml,.html,.png,.jpg,.jpeg,.gif,.webp';

const BLOCK_RE = /<<<ATTACHED_FILE id="([^"]*)" name="([^"]*)" kind="([^"]*)">>>[\s\S]*?<<<END_ATTACHED_FILE>>>/g;

/** A message's own text, and the files it carried. */
export function splitAttachments(content: string): { text: string; files: ChatAttachmentRef[] } {
  if (!content || !content.includes('<<<ATTACHED_FILE')) return { text: content, files: [] };
  const files: ChatAttachmentRef[] = [];
  const text = content.replace(BLOCK_RE, (_m, id: string, filename: string, kind: string) => {
    files.push({ id, filename, kind: kind as AttachmentKind });
    return '';
  }).trim();
  return { text, files };
}

/**
 * The block as the client adds it to its OWN copy of a just-sent message —
 * same shape the server saves (minus the digest), so a live message and one
 * reloaded from history render identically.
 */
export function attachmentMarker(ref: ChatAttachmentRef): string {
  return `<<<ATTACHED_FILE id="${ref.id}" name="${ref.filename.replace(/"/g, "'")}" kind="${ref.kind}">>>\n<<<END_ATTACHED_FILE>>>`;
}

export async function uploadAttachment(
  file: File,
  opts: { agentName: string; conversationId?: string | null; userId?: string | null; baseURL?: string },
): Promise<ChatAttachmentRef> {
  const form = new FormData();
  form.append('file', file, file.name);
  form.append('agentName', opts.agentName);
  if (opts.conversationId) form.append('conversationId', opts.conversationId);
  if (opts.userId) form.append('userId', opts.userId);
  const res = await fetch(`${opts.baseURL || getBaseURL()}/api/chat-attachments`, { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
  return data as ChatAttachmentRef;
}

/**
 * Download a data_table result written into the attached spreadsheet's own
 * structure (its headers, column order and formulas).
 */
export async function downloadFilledAttachment(
  attachmentId: string,
  source: { schema?: string; sql?: string; fileQuery?: FileQueryRef; columns?: string[]; rows?: Record<string, unknown>[] },
  baseURL?: string,
): Promise<void> {
  const res = await fetch(`${baseURL || getBaseURL()}/api/chat-attachments/${attachmentId}/fill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(source),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Download failed (${res.status})`);
  }
  const disposition = res.headers.get('Content-Disposition') || '';
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  const filename = utf8 ? decodeURIComponent(utf8[1]) : 'export.xlsx';
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
