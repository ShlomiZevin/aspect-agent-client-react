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
  | { type: 'addon.prompt';
      instanceId: string;
      prompt: string;
      historyCount: number;
      /** Resolution record from `historyService.loadHistory`. Tells
       *  the client which mode was requested vs. what actually
       *  applied (e.g. `since_summarizer` fell back to `all` because
       *  the watermark didn't exist yet). Surfaced in the card's
       *  expanded body. Optional on the wire for compat — older
       *  servers omit it. */
      historyMode?: {
        requestedMode: string;
        effectiveMode: string;
        fallbackReason?: string;
        count: number;
      };
    }
  | { type: 'addon.token'; instanceId: string; token: string }
  | { type: 'addon.output';
      instanceId: string;
      label?: string;
      modelLabel?: { providerName: string; modelName: string } | null;
      rawOutput: string;
      parsedOutput?: unknown;
      memoryWrites?: Array<
        | {
            /** Brain section the write goes into. `'memory'` (default),
             *  `'thinking'`, or `'summary'`. Field/Vibe Extractor leave
             *  it undefined which is treated as `'memory'`. */
            kind?: 'memory' | 'thinking';
            domain: string | null;
            field: string;
            value: unknown;
          }
        | {
            /** Domain-replace marker — wipes the `(section, domain)`
             *  bucket before subsequent value writes land. Thinker /
             *  Field Interviewer emit this first so rolling-replace
             *  semantics work on the optimistic client cache just
             *  like they do on the server's `applyWrites`. */
            kind: 'memory' | 'thinking';
            domain: string | null;
            replace: true;
          }
        | {
            /** Summarizer writes — flat slot per summarizer name, no
             *  domain layer. The slot carries the synthesis text, the
             *  highest message id consumed (`watermark`), and the
             *  completion timestamp. */
            kind: 'summary';
            name: string;
            entry: { text: string; watermark: number; ranAt: number };
          }
      >;
      tokens: { input: number; output: number; total: number };
      durationMs: number;
      /** Time-to-first-token (Talker only). Perceived latency. */
      firstTokenMs?: number;
      parseError?: string;
      transition?: { to: string; reason?: string };
      broke?: boolean;
      /** Which lane this addon ran in. Surfaced on addon.output so a
       *  reloaded conversation can colour offline runs without
       *  replaying the earlier addon.start event. */
      lane?: string;
      /** Mirrors what addon.prompt carried — present here too so a
       *  reloaded conversation can show the history info without
       *  replaying the per-event stream. */
      historyMode?: {
        requestedMode: string;
        effectiveMode: string;
        fallbackReason?: string;
        count: number;
      };
      historyCount?: number;
    }
  | { type: 'addon.error'; instanceId: string | null; error: { code: string; message: string } }
  | { type: 'assistant.message'; messageId: number; text: string }
  /**
   * Dynamic Context resolution surfaced for the live chat trail.
   * Emitted once per dynamic-context token that the assembler actually
   * resolved this turn — including the no-match case (where `matched`
   * is null and `text` is the umbrella fallback or '').
   *
   * `section` distinguishes the three token forms:
   *   - `null`   for `{{dynamic:FIELD}}`        (umbrella)
   *   - section  for `{{dynamic:FIELD:SECTION}}` (single section)
   *   - `'*'`    for `{{dynamic:FIELD:*}}`      (all sections joined)
   */
  | { type: 'dynamic.resolved';
      instanceId: string;
      fieldName: string;
      section: string | null;
      matched: string | null;
      text: string;
    }
  | { type: 'done'; totalMs: number };

export interface SendArgs {
  agentSlug: string;
  conversationId: number;
  ownerUserId: string;
  userMessage: string;
  version?: 'viewing' | 'active';
  /** Optional crew override (e.g. picked by the user in the chat header
   *  dropdown). When set, the server routes this turn to that crew and
   *  persists it as the new conversation pointer. */
  overrideCrewId?: string | null;
  /** Working-copy agent body. Sent so the runtime can execute against
   *  unsaved edits — the in-builder chat reflects dirty state. */
  overrideAgentBody?: unknown;
  /** Working-copy crew body (matched with overrideAgentBody). */
  overrideCrewBody?: unknown;
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
