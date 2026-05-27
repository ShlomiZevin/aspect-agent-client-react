/**
 * SSE consumer for the builder runtime endpoint.
 *
 * Posts a user message to `/api/agents/:slug/conversations/:convId/messages`
 * and reads the streamed events, dispatching each parsed event to
 * the supplied handler.
 */

import { runtimeMessageStream } from './builderApi';

export type RuntimeEvent =
  | { type: 'conversation'; conversationId: number; messageId: number; currentCrewId?: string | null }
  | { type: 'addon.start'; instanceId: string; pluginId: string; lane: string; label?: string;
      model?: unknown;
      modelLabel?: { providerName: string; modelName: string } | null }
  | { type: 'addon.prompt'; instanceId: string; prompt: string; historyCount: number }
  | { type: 'addon.token'; instanceId: string; token: string }
  | { type: 'addon.output';
      instanceId: string;
      label?: string;
      modelLabel?: { providerName: string; modelName: string } | null;
      rawOutput: string;
      parsedOutput?: unknown;
      memoryWrites?: Array<{
        /** Brain section the write goes into. `'memory'` (default),
         *  `'thinking'`, or `'triggered'`. Set by the plugin (Thinker
         *  emits 'thinking', Triggered Context emits 'triggered',
         *  Field/Vibe Extractor leave undefined which is treated as
         *  'memory'). */
        kind?: 'memory' | 'thinking' | 'triggered';
        domain: string | null;
        field: string;
        value: unknown;
      }>;
      tokens: { input: number; output: number; total: number };
      durationMs: number;
      /** Time-to-first-token (Talker only). Perceived latency. */
      firstTokenMs?: number;
      parseError?: string;
      transition?: { to: string; reason?: string };
      broke?: boolean;
    }
  | { type: 'addon.error'; instanceId: string | null; error: { code: string; message: string } }
  | { type: 'assistant.message'; messageId: number; text: string }
  | { type: 'done'; totalMs: number };

export interface SendArgs {
  agentSlug: string;
  conversationId: number;
  ownerUserId: string;
  userMessage: string;
  version?: 'viewing' | 'active';
  onEvent: (event: RuntimeEvent) => void;
  signal?: AbortSignal;
}

/**
 * Send a message and stream events back. Resolves when the
 * server closes the stream (after `done`) or when the signal aborts.
 */
export async function sendRuntimeMessage(args: SendArgs): Promise<void> {
  const res = await runtimeMessageStream(args);
  if (!res.ok || !res.body) {
    throw new Error(`runtime stream failed: ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    if (args.signal?.aborted) break;
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are delimited by a blank line. Each frame may
    // span multiple lines; lines starting with `data:` carry the
    // payload. We accept JSON-only payloads (what the server sends).
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const lines = frame.split('\n');
      const dataLines = lines
        .filter(l => l.startsWith('data:'))
        .map(l => l.slice(5).trimStart());
      if (dataLines.length === 0) continue; // comments like `:ok`
      try {
        const parsed = JSON.parse(dataLines.join('\n')) as RuntimeEvent;
        args.onEvent(parsed);
      } catch (err) {
        console.warn('[builder] failed to parse SSE frame:', err, dataLines);
      }
    }
  }
}
