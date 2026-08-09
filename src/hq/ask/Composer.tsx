/** HQ — the Ask input. Shared by the full tab and the side panel. */

import { useEffect, useRef, useState } from 'react';

import { useAsk } from './AskContext';
import styles from './Composer.module.css';

interface Props {
  compact?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}

export function Composer({ compact = false, autoFocus = false, placeholder }: Props) {
  const { turns, submit, clear } = useAsk();
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Grow with content, up to the CSS max-height.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  function send() {
    const q = input.trim();
    if (!q) return;
    setInput('');
    submit(q);
  }

  return (
    <div className={`${styles.composer} ${compact ? styles.compact : ''} ${focused ? styles.focused : ''}`}>
      <textarea
        ref={ref}
        className={styles.input}
        rows={1}
        dir="auto"
        value={input}
        placeholder={placeholder ?? 'Ask about a meeting, a decision, anything…'}
        onChange={e => setInput(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
        }}
      />
      <div className={styles.foot}>
        {!compact && <span className={styles.hint}>Enter to send · Shift+Enter for a new line</span>}
        {compact && <span className={styles.spacer} />}
        {turns.length > 0 && <button className="hqMini" onClick={clear}>Clear</button>}
        <button className="hqPill" onClick={send} disabled={!input.trim()}>Ask</button>
      </div>
    </div>
  );
}
