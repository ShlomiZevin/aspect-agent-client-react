// Transport for FreedaNext — the customer-facing web chat that talks to the
// Freeda 1.0 flow engine via the synchronous `freedaChat` Cloud Function.
//
// The engine runs the SAME flows as the WhatsApp bot; it returns the bot's
// outgoing messages (text / image / buttons) as JSON. Conversation state is
// kept server-side in Firestore keyed by a synthetic `sessionId` we generate
// here and persist in localStorage.

const FREEDA_CHAT_URL =
  (import.meta.env.VITE_FREEDA_CHAT_URL as string | undefined) ||
  'https://us-central1-menopause-bot.cloudfunctions.net/freedaChat';

const SESSION_KEY = 'freedanext:sessionId';

export interface FreedaButton {
  id: string;
  title: string;
}

export interface FreedaMessage {
  id: string;
  type: 'text' | 'image' | 'audio' | 'buttons' | 'template';
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  buttons?: FreedaButton[];
}

export interface FreedaChatResponse {
  sessionId: string;
  messages: FreedaMessage[];
}

export interface SendParams {
  sessionId: string;
  text?: string;
  buttonId?: string;
  buttonTitle?: string;
}

export async function sendFreedaMessage(params: SendParams): Promise<FreedaChatResponse> {
  const res = await fetch(FREEDA_CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json())?.detail ?? '';
    } catch {
      /* ignore */
    }
    throw new Error(`freedaChat ${res.status}${detail ? `: ${detail}` : ''}`);
  }
  return res.json();
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = 'web_' + newId();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function resetSession(): string {
  const id = 'web_' + newId();
  localStorage.setItem(SESSION_KEY, id);
  return id;
}
