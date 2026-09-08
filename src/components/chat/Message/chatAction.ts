/**
 * The generic chat-action envelope a module tool attaches to its result
 * (`_chatAction` server-side; a persisted `chat_action` thinking step by the
 * time it reaches the client). Separate from ChatActionCard.tsx so that file
 * exports only components (react-refresh constraint).
 */
export interface ChatActionEnvelope {
  kind: string;
  module: string;
  datasetId: string;
  payload: Record<string, unknown>;
}

export function isChatActionEnvelope(v: unknown): v is ChatActionEnvelope {
  const a = v as ChatActionEnvelope | null;
  return Boolean(a && typeof a.kind === 'string' && typeof a.datasetId === 'string');
}
