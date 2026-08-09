/**
 * HQ — the Ask conversation, rendered identically in the full tab and in the
 * floating panel. Both read the same thread from AskContext, so switching
 * between them is seamless.
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useAsk } from './AskContext';
import type { Citation } from '../types';
import styles from './Conversation.module.css';

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

interface Props {
  /** Tighter spacing for the side panel. */
  compact?: boolean;
  /** Called after a citation is opened — lets the panel keep or close itself. */
  onNavigate?: () => void;
}

export function Conversation({ compact = false, onNavigate }: Props) {
  const { turns } = useAsk();
  const endRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns]);

  function openCitation(c: Citation) {
    if (c.atomId) navigate(`/hq/library/${c.atomId}`);
    else if (c.url) window.open(c.url, '_blank', 'noopener');
    onNavigate?.();
  }

  return (
    <div className={`${styles.turns} ${compact ? styles.compact : ''}`}>
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
                <div className={`${styles.answer} ${styles.answerThinking}`}>
                  <span className={styles.thinking}>
                    Searching everything we know
                    <span className="hqDots"><i /><i /><i /></span>
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
      <div ref={endRef} />
    </div>
  );
}
