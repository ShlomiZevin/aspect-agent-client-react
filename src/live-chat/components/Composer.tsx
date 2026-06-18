import { useRef } from 'react';
import type { Dict } from '../i18n';
import { IconSend } from '../icons';

interface Props {
  t: Dict;
  value: string;
  busy: boolean;
  /** UI direction — drives placeholder alignment when the field is empty. */
  uiDir: 'rtl' | 'ltr';
  /** When true: Enter = newline, Ctrl/Cmd+Enter = send. */
  ctrlEnter: boolean;
  onChange: (v: string) => void;
  onSend: () => void;
  onToggleCtrlEnter: () => void;
}

export function Composer({ t, value, busy, uiDir, ctrlEnter, onChange, onSend, onToggleCtrlEnter }: Props) {
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
        <button className="send-btn" onClick={onSend} disabled={busy || !value.trim()} title="send" type="button">
          <IconSend />
        </button>
      </div>
      <div className="composer-foot">
        <label className="ctrl-enter">
          <input type="checkbox" checked={ctrlEnter} onChange={onToggleCtrlEnter} />
          <span>{t.sendCtrlEnter}</span>
        </label>
        <span className="hint">{t.hint}</span>
      </div>
    </div>
  );
}
