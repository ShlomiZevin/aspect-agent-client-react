import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  sendFreedaMessage,
  getOrCreateSessionId,
  resetSession,
  type FreedaButton,
} from '../services/freedaNextService';
import { useDocumentMeta } from '../hooks';
import { freedaConfig } from '../agents';
import s from './FreedaNextPage.module.css';

type Role = 'user' | 'bot';

interface ChatMessage {
  id: string;
  role: Role;
  kind: 'text' | 'image' | 'buttons';
  text?: string;
  imageUrl?: string;
  buttons?: FreedaButton[];
}

// First real letter decides direction (Hebrew/Arabic/Syriac -> RTL).
function isRTL(text: string): boolean {
  const rtlChar = /[֐-׿؀-ۿ܀-ݏ]/;
  const firstLetter = text.match(/\p{L}/u);
  return firstLetter ? rtlChar.test(firstLetter[0]) : false;
}

let msgCounter = 0;
const localId = () => `m${Date.now()}_${msgCounter++}`;

export function FreedaNextPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<string>(getOrCreateSessionId());
  const startedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useDocumentMeta({
    title: freedaConfig.pageTitle,
    favicon: freedaConfig.favicon,
    description: freedaConfig.metaDescription,
  });

  const appendBotMessages = useCallback(
    (msgs: { type: string; text?: string; imageUrl?: string; buttons?: FreedaButton[] }[]) => {
      const mapped: ChatMessage[] = [];
      for (const m of msgs) {
        if (m.type === 'image' && m.imageUrl) {
          mapped.push({ id: localId(), role: 'bot', kind: 'image', imageUrl: m.imageUrl });
        } else if (m.type === 'buttons') {
          mapped.push({
            id: localId(),
            role: 'bot',
            kind: 'buttons',
            text: m.text,
            buttons: m.buttons,
          });
        } else if (m.type === 'text' && m.text) {
          mapped.push({ id: localId(), role: 'bot', kind: 'text', text: m.text });
        }
        // 'audio' / 'template' are not surfaced in this UI
      }
      if (mapped.length) setMessages((prev) => [...prev, ...mapped]);
    },
    []
  );

  const send = useCallback(
    async (opts: { text?: string; buttonId?: string; buttonTitle?: string; showUser?: string }) => {
      if (busy) return;
      setError(null);
      if (opts.showUser) {
        setMessages((prev) => [
          ...prev,
          { id: localId(), role: 'user', kind: 'text', text: opts.showUser },
        ]);
      }
      setBusy(true);
      try {
        const res = await sendFreedaMessage({
          sessionId: sessionRef.current,
          text: opts.text,
          buttonId: opts.buttonId,
          buttonTitle: opts.buttonTitle,
        });
        appendBotMessages(res.messages);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      } finally {
        setBusy(false);
      }
    },
    [busy, appendBotMessages]
  );

  // Kick off the conversation on mount (silent trigger -> opening messages).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void send({ text: 'hi' });
  }, [send]);

  // Auto-scroll to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const handleSubmit = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    void send({ text, showUser: text });
  };

  const handleButton = (btn: FreedaButton) => {
    if (busy) return;
    void send({ buttonId: btn.id, buttonTitle: btn.title, showUser: btn.title });
  };

  const handleNewChat = () => {
    sessionRef.current = resetSession();
    setMessages([]);
    setError(null);
    startedRef.current = true;
    void send({ text: 'hi' });
  };

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.brand}>
          <img className={s.logo} src={freedaConfig.logo.src} alt={freedaConfig.logo.alt} />
          <div className={s.brandText}>
            <span className={s.brandName}>Freeda</span>
            <span className={s.brandSub}>Your supportive menopause companion</span>
          </div>
        </div>
        <button className={s.newChatBtn} onClick={handleNewChat} type="button" title="New chat">
          New chat
        </button>
      </header>

      <div className={s.messages} ref={scrollRef}>
        {messages.map((m) => {
          const dir = m.text && isRTL(m.text) ? 'rtl' : undefined;
          if (m.role === 'user') {
            return (
              <div key={m.id} className={`${s.row} ${s.rowUser}`}>
                <div className={`${s.bubble} ${s.bubbleUser}`} dir={dir}>
                  {m.text}
                </div>
              </div>
            );
          }
          if (m.kind === 'image') {
            return (
              <div key={m.id} className={`${s.row} ${s.rowBot}`}>
                <div className={`${s.bubble} ${s.bubbleBot} ${s.bubbleImage}`}>
                  <img className={s.botImage} src={m.imageUrl} alt="" loading="lazy" />
                </div>
              </div>
            );
          }
          return (
            <div key={m.id} className={`${s.row} ${s.rowBot}`}>
              <div className={`${s.bubble} ${s.bubbleBot}`} dir={dir}>
                {m.text && (
                  <div className={s.markdown}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer">
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {m.text}
                    </ReactMarkdown>
                  </div>
                )}
                {m.buttons && m.buttons.length > 0 && (
                  <div className={s.buttonRow}>
                    {m.buttons.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        className={s.quickBtn}
                        disabled={busy}
                        onClick={() => handleButton(b)}
                      >
                        {b.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {busy && (
          <div className={`${s.row} ${s.rowBot}`}>
            <div className={`${s.bubble} ${s.bubbleBot} ${s.typing}`}>
              <span className={s.dot} />
              <span className={s.dot} />
              <span className={s.dot} />
            </div>
          </div>
        )}

        {error && <div className={s.error}>{error}</div>}
      </div>

      <div className={s.composer}>
        <textarea
          className={s.input}
          placeholder="Type your message..."
          value={input}
          dir="auto"
          rows={1}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <button
          className={s.sendBtn}
          type="button"
          onClick={handleSubmit}
          disabled={busy || !input.trim()}
          title="Send"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
