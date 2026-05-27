/**
 * ComboPicker — small autocomplete text/select hybrid.
 *
 * Used wherever the user picks a field-name (or other constrained
 * string) from a known set but may also need free-text — Transition
 * Router's conditions, Triggered Context's Switch rule header,
 * future addons that pick from a list.
 *
 * - `allowFreeText: true` (default) — user can type anything; the
 *   options act as autocomplete suggestions. Picking from the list
 *   commits the value. Typing + blur or Enter commits the typed value.
 *
 * - `allowFreeText: false` — read-only input; the chevron is the only
 *   way to open the list and the value can only be one of `options`.
 *
 * Pass `className` to widen / style the outer wrapper from a parent
 * (e.g. when the picker is the dominant control in a row vs. one of
 * several inline controls in a tight conditions list).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './ComboPicker.module.css';

export interface ComboPickerProps {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  /** When false, the input is read-only — user can only pick from `options`. */
  allowFreeText?: boolean;
  /** Optional extra class on the outer wrapper. Lets callers control
   *  layout (e.g. flex: 1 in a header row). */
  className?: string;
}

export function ComboPicker({
  value, options, onChange, placeholder,
  allowFreeText = true,
  className,
}: ComboPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        if (allowFreeText && draft !== value) onChange(draft);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, allowFreeText, draft, value, onChange]);

  const filtered = useMemo(() => {
    const q = draft.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.toLowerCase().includes(q));
  }, [options, draft]);

  const pick = (v: string) => {
    setDraft(v);
    onChange(v);
    setOpen(false);
  };

  return (
    <div className={`${styles.combo} ${className ?? ''}`} ref={ref}>
      <input
        className={styles.comboInput}
        value={draft}
        readOnly={!allowFreeText}
        onChange={e => {
          setDraft(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'Enter' && allowFreeText) {
            onChange(draft);
            setOpen(false);
          } else if (e.key === 'Escape') {
            setDraft(value);
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
      />
      {/* Caret only when the picker is options-only (enum / bool).
        * Free-text combos (field name) get autocomplete via focus +
        * typing and don't need a chevron implying a closed menu. */}
      {!allowFreeText && (
        <button
          type="button"
          className={`${styles.comboCaret} ${open ? styles.comboCaretOpen : ''}`}
          onClick={() => setOpen(o => !o)}
          tabIndex={-1}
          aria-label="Toggle options"
        >
          ▾
        </button>
      )}
      {open && filtered.length > 0 && (
        <div className={styles.comboMenu} role="listbox">
          {filtered.map(o => (
            <button
              key={o}
              type="button"
              role="option"
              aria-selected={o === value}
              className={`${styles.comboItem} ${o === value ? styles.comboItemActive : ''}`}
              onMouseDown={e => e.preventDefault()}
              onClick={() => pick(o)}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
