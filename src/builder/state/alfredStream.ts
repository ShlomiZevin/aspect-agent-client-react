/**
 * SSE consumer for the Alfred brainstorm endpoint.
 *
 * Mirrors `runtimeStream.ts` — posts a user message to
 * `/api/builder/alfred/chats/:chatId/messages` and dispatches each
 * parsed SSE event to the supplied handler.
 *
 * P5.1 event set is intentionally small (no proposals / tool calls
 * yet). P5.2 will add `alfred.proposal` etc.
 */

import { alfredMessageStream } from './builderApi';

export type AlfredEvent =
  | { type: 'conversation'; chatId: number; messageId: number }
  | { type: 'alfred.start' }
  | { type: 'alfred.token'; token: string }
  | { type: 'alfred.message'; messageId: number; text: string }
  | { type: 'alfred.error'; error: { code: string; message: string } }
  | { type: 'done'; totalMs: number };

export interface SendArgs {
  chatId: number;
  agentSlug: string;
  ownerUserId: string;
  userMessage: string;
  onEvent: (event: AlfredEvent) => void;
  signal?: AbortSignal;
}

export async function sendAlfredMessage(args: SendArgs): Promise<void> {
  const res = await alfredMessageStream(args);
  if (!res.ok || !res.body) {
    throw new Error(`alfred stream failed: ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    if (args.signal?.aborted) break;
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const lines = frame.split('\n');
      const dataLines = lines
        .filter(l => l.startsWith('data:'))
        .map(l => l.slice(5).trimStart());
      if (dataLines.length === 0) continue;
      try {
        const parsed = JSON.parse(dataLines.join('\n')) as AlfredEvent;
        args.onEvent(parsed);
      } catch (err) {
        console.warn('[alfred] failed to parse SSE frame:', err, dataLines);
      }
    }
  }
}
