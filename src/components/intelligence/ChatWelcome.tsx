/**
 * Bespoke "Data Chat" welcome/empty state — built fresh to match the design
 * exactly (turn 2b), not reused from the real chat's WelcomeSection (whose
 * CSS/markup we don't control pixel-for-pixel and must not modify). Content
 * (quick-question labels + the question each one sends) is still sourced
 * from hypertoyConfig.quickQuestions + the real i18n strings, so it can't
 * drift out of sync with the actual chat agent's configured questions.
 */
import { useState, type ReactElement } from 'react';
import { hypertoyConfig } from '../../agents';
import { translations } from '../../i18n/translations';
import styles from './ChatWelcome.module.css';

const ICONS: Record<string, ReactElement> = {
  revenue: <path d="M3 17l6-6 4 4 8-8M21 7v6h-6" />,
  topProducts: <path d="M8 21h8M12 17v4M7 4h10l-1 8a4 4 0 0 1-8 0L7 4zM5 4h2v3a3 3 0 0 1-2-3zM19 4h-2v3a3 3 0 0 0 2-3z" />,
  topStores: <path d="M3 9l1-5h16l1 5M4 9v10h16V9M4 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" />,
  margin: <path d="M19 5L5 19M7.5 7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM16.5 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />,
  targets: <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />,
  cashiers: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
  inventory: <path d="M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8" />,
  crossBrand: <path d="M8 12a4 4 0 1 1 4 4M16 12a4 4 0 1 0-4-4" />,
};

const KEY_TO_ICON = ['revenue', 'topProducts', 'topStores', 'margin', 'targets', 'cashiers', 'inventory', 'crossBrand'];

// The real chat's tile labels are Title Case; the design's tiles are sentence
// case ("Revenue this month"). Transformed only for display here, not in the
// shared i18n strings, so the real chat (which we never touch) is unaffected.
function toSentenceCase(label: string): string {
  const lower = label.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

interface Props {
  onSend: (question: string) => void;
}

export function ChatWelcome({ onSend }: Props) {
  const [text, setText] = useState('');

  const submit = () => {
    const q = text.trim();
    if (!q) return;
    onSend(q);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.hero}>
        <span className={styles.mark}>✦</span>
        <div className={styles.title}>Welcome to Hyper Toy BI</div>
        <div className={styles.subtitle}>Ask me about sales, profit, products, stores, and inventory.</div>
      </div>

      <div className={styles.questionsLabel}>QUICK QUESTIONS</div>
      <div className={styles.grid}>
        {hypertoyConfig.quickQuestions.map((q, i) => {
          const label = q.textKey ? translations.en[q.textKey] : q.text || '';
          const question = q.questionKey ? translations.en[q.questionKey] : q.question || '';
          const iconKey = KEY_TO_ICON[i] || 'revenue';
          return (
            <button key={i} className={styles.tile} onClick={() => onSend(question)}>
              <svg className={styles.tileIcon} width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {ICONS[iconKey]}
              </svg>
              <span className={styles.tileLabel}>{toSentenceCase(label)}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.spacer} />

      <div className={styles.inputRow}>
        <input
          className={styles.input}
          placeholder="Ask about your business…"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) submit(); }}
        />
        <svg className={styles.micIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 19v3" />
        </svg>
        <button className={styles.sendBtn} disabled={!text.trim()} onClick={submit} aria-label="Send">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
        </button>
      </div>
      <div className={styles.hint}>Send with Ctrl+Enter</div>
    </div>
  );
}
