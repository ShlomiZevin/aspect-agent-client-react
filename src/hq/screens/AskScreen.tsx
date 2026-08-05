/**
 * HQ — Ask.
 *
 * The primary surface, and deliberately shaped like the customer chat: the
 * question sits right, HQ answers left behind Lybi's magenta rail. Every answer
 * cites the atoms it leaned on and each citation clicks through to its source —
 * an uncited brain is a liability.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { ask } from '../services/hqApi';
import type { AskResult, Citation } from '../types';
import styles from './AskScreen.module.css';

interface Turn {
  question: string;
  result?: AskResult;
  error?: string;
  loading: boolean;
}

const SUGGESTIONS = [
  'What did we decide about pricing?',
  'What are our brand colours?',
  "What's still open from last week?",
  'מה החלטנו בפגישה האחרונה?',
];

/** Render `[1]` markers as brand chips so provenance reads inline. */
function AnswerBody({ text }: { text: string }) {
  const withChips = text.replace(/\[(\d+)\]/g, '`⟦$1⟧`');

  return (
    <div className="hqProse">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ children, ...props }) {
            const raw = String(children);
            const marker = raw.match(/^⟦(\d+)⟧$/);
            if (marker) return <sup className={styles.citeRef}>{marker[1]}</sup>;
            return <code {...props}>{children}</code>;
          },
        }}
      >
        {withChips}
      </ReactMarkdown>
    </div>
  );
}

function SourceCard({ citation, onOpen }: { citation: Citation; onOpen: (c: Citation) => void }) {
  return (
    <button className={styles.source} onClick={() => onOpen(citation)}>
      <span className={styles.sourceNum}>{citation.n}</span>
      <span className={styles.sourceBody}>
        <span className={styles.sourceTitle}>{citation.title}</span>
        <span className={styles.sourceMeta}>
          <span>{citation.kind}</span>
          {citation.date && <span>· {citation.date}</span>}
          <span>· {Math.round(citation.score * 100)}% match</span>
        </span>
        <span className={styles.sourceSnippet}>{citation.snippet}</span>
      </span>
    </button>
  );
}

export function AskScreen() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  async function submit(question: string) {
    const q = question.trim();
    if (!q) return;

    setInput('');
    const index = turns.length;
    setTurns(prev => [...prev, { question: q, loading: true }]);

    try {
      const result = await ask(q);
      setTurns(prev => prev.map((t, i) => (i === index ? { ...t, result, loading: false } : t)));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setTurns(prev => prev.map((t, i) => (i === index ? { ...t, error: message, loading: false } : t)));
    }
  }

  function openCitation(c: Citation) {
    if (c.atomId) navigate(`../library/${c.atomId}`);
    else if (c.url) window.open(c.url, '_blank', 'noopener');
  }

  return (
    <div className={styles.screen}>
      <div className={styles.scroll} ref={scrollRef}>
        <div className={styles.inner}>
          {turns.length === 0 ? (
            <div className={styles.hero}>
              <div className={styles.heroIntro}>
                <span className={styles.heroMark}>
                  <img src="/img/lybi-spiral.png" alt="" />
                </span>
                <span className={styles.heroTitle}>Ask HQ anything</span>
              </div>
              <p className={styles.heroSub}>
                Everything we've put in — meetings, docs, decisions. Answers come with their source.
              </p>
              <div className={styles.pills}>
                {SUGGESTIONS.map(s => (
                  <button key={s} className="hqGhostPill" onClick={() => submit(s)} dir="auto">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.turns}>
              {turns.map((turn, i) => (
                <div key={i} className={styles.turn}>
                  <div className={styles.qRow}>
                    <div className={styles.qWrap}>
                      <span className={`hqEyebrow ${styles.qLabel}`}>You</span>
                      <div className={styles.question} dir="auto">{turn.question}</div>
                    </div>
                  </div>

                  <div className={styles.aRow}>
                    <div className={styles.aWrap}>
                      <span className={`hqEyebrow ${styles.aLabel}`}>HQ</span>

                      {turn.loading && (
                        <div className={styles.answer}>
                          <span className={styles.thinking}>
                            <span className="hqDots"><i /><i /><i /></span>
                            Searching everything we know…
                          </span>
                        </div>
                      )}

                      {turn.error && <div className={styles.errorBox}>{turn.error}</div>}

                      {turn.result && (
                        <>
                          <div className={styles.answer} dir="auto">
                            <AnswerBody text={turn.result.answer} />
                          </div>

                          {turn.result.citations.length > 0 && (
                            <div className={styles.sources}>
                              <div className={`hqEyebrow ${styles.sourcesLabel}`}>
                                {turn.result.citations.length} source
                                {turn.result.citations.length === 1 ? '' : 's'}
                              </div>
                              <div className={styles.sourceList}>
                                {turn.result.citations.map(c => (
                                  <SourceCard key={c.n} citation={c} onOpen={openCitation} />
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.composerWrap}>
        <div className={`${styles.composer} ${focused ? styles.composerFocused : ''}`}>
          <textarea
            ref={inputRef}
            className={styles.input}
            rows={1}
            dir="auto"
            value={input}
            placeholder="Ask about a meeting, a decision, anything…"
            onChange={e => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(input); }
            }}
          />
          <div className={styles.composerFoot}>
            <span className={styles.footHint}>Enter to send · Shift+Enter for a new line</span>
            <button className="hqPill" onClick={() => submit(input)} disabled={!input.trim()}>
              Ask
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
