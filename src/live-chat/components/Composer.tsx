import { useRef } from 'react';
import type { Dict } from '../i18n';

interface Props {
  t: Dict;
  value: string;
  busy: boolean;
  /** UI direction — drives placeholder alignment when the field is empty. */
  uiDir: 'rtl' | 'ltr';
  /** When true: Enter = newline, Ctrl/Cmd+Enter = send. */
  ctrlEnter: boolean;
  /** 'bottom' (default): the docked pill. 'card': Noa's centered welcome
   *  card — bordered, large prompt, a text Send pill and inline Ctrl+Enter. */
  variant?: 'bottom' | 'card';
  onChange: (v: string) => void;
  onSend: () => void;
  onToggleCtrlEnter: () => void;
}

export function Composer({ t, value, busy, uiDir, ctrlEnter, variant = 'bottom', onChange, onSend, onToggleCtrlEnter }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return;
    if (ctrlEnter) {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); onSend(); }
      // plain Enter → newline (default behaviour)
    } else {
      if (!e.shiftKey) { e.preventDefault(); onSend(); }
    }
  };

  // When empty, follow the UI direction so the placeholder aligns to the
  // reading side; once the user types, follow the typed content (`auto`).
  const fieldDir = value.trim() ? 'auto' : uiDir;

  // Noa's welcome card: a bordered box with a large prompt, an inline
  // Ctrl+Enter toggle and a text "Send" pill — the composer pulled up to
  // centre-stage while there's no conversation yet.
  if (variant === 'card') {
    return (
      <div className="composer-card">
        <textarea
          ref={ref}
          rows={1}
          dir={fieldDir}
          className="composer-card-input"
          placeholder={t.welcomePlaceholder}
          value={value}
          disabled={busy}
          onChange={e => { onChange(e.target.value); autoGrow(e.target); }}
          onKeyDown={onKey}
        />
        <div className="composer-card-foot">
          <label className="ctrl-enter">
            <input type="checkbox" checked={ctrlEnter} onChange={onToggleCtrlEnter} />
            <span>{t.sendCtrlEnter}</span>
          </label>
          <span className="spacer" />
          <button className="send-pill" onClick={onSend} disabled={busy || !value.trim()} type="button">
            {t.send}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="composer">
      <div className="composer-inner">
        <textarea
          ref={ref}
          rows={1}
          dir={fieldDir}
          placeholder={t.placeholder}
          value={value}
          disabled={busy}
          onChange={e => { onChange(e.target.value); autoGrow(e.target); }}
          onKeyDown={onKey}
        />
        <button className="send-pill" onClick={onSend} disabled={busy || !value.trim()} type="button">
          {t.send}
        </button>
      </div>
      <div className="composer-foot">
        <label className="ctrl-enter">
          <input type="checkbox" checked={ctrlEnter} onChange={onToggleCtrlEnter} />
          <span>{t.sendCtrlEnter}</span>
        </label>
      </div>
    </div>
  );
}
