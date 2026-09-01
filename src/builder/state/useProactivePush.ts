/**
 * useProactivePush — makes a proactive message appear in an open chat
 * without a refresh.
 *
 * Used by BOTH chats: the customer chat and the builder's User Chat.
 * It lived under live-chat/ at first and the builder chat silently had
 * no subscription at all — you could watch a trigger fire in the log and
 * see nothing in the chat you were staring at.
 *
 * See aspect-agent-server/docs/guides/BUILDER_V2_TRIGGERS.md.
 *
 * The stream carries no message text, only "something arrived". This
 * hook's whole job is to notice that and call `onArrived`, which reloads
 * the conversation through the SAME path used for history — so a pushed
 * message renders identically to one that was there when the page
 * loaded, and the two can never drift apart visually.
 *
 * Nothing here is load-bearing. The message is written to the database
 * before any push happens, so a closed tab, a dropped stream, or a
 * browser that never connects costs the customer a refresh and never the
 * message. That is why every failure path here is quiet: reconnect and
 * carry on, don't shout at someone whose chat is working fine.
 */

import { useEffect, useRef } from 'react';

const BASE_URL =
  (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ||
  'https://aspect-agent-server-1018338671074.europe-west1.run.app';

interface Options {
  agentSlug: string | undefined;
  conversationId: number | null;
  /** Called when a proactive message lands. Reload and render normally. */
  onArrived: (info: { messageId: number; reason?: string | null }) => void;
  /** Skip while the user's own turn is streaming — that path already
   *  renders the reply, and reloading mid-stream would fight it. */
  paused?: boolean;
}

export function useProactivePush({ agentSlug, conversationId, onArrived, paused }: Options) {
  // Keep the callback in a ref so re-renders don't tear down the stream.
  // Without this, any parent re-render would reconnect, and a chat that
  // reconnects constantly receives nothing reliably.
  const cb = useRef(onArrived);
  useEffect(() => { cb.current = onArrived; }, [onArrived]);

  useEffect(() => {
    if (!agentSlug || conversationId === null || paused) return;

    let closed = false;
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let backoffMs = 2000;

    const connect = () => {
      if (closed) return;
      es = new EventSource(
        `${BASE_URL}/api/agents/${agentSlug}/conversations/${conversationId}/live`);

      es.onmessage = (ev) => {
        let data: { type?: string; messageId?: number; reason?: string | null };
        try { data = JSON.parse(ev.data); } catch { return; }
        if (data.type === 'subscribed') {
          backoffMs = 2000;   // a good connection resets the backoff
          return;
        }
        if (data.type === 'proactive.message' && typeof data.messageId === 'number') {
          cb.current({ messageId: data.messageId, reason: data.reason ?? null });
        }
      };

      es.onerror = () => {
        // EventSource retries on its own, but not after the server ends
        // the stream deliberately (which it does when subscribing
        // fails). Close and back off so a server without a database
        // doesn't get hammered by every open tab.
        es?.close();
        es = null;
        if (closed) return;
        retry = setTimeout(connect, backoffMs);
        backoffMs = Math.min(backoffMs * 2, 60000);
      };
    };

    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      es?.close();
    };
  }, [agentSlug, conversationId, paused]);
}
