/**
 * HQ — one dropdown for every "which model does this" choice.
 *
 * There are three of these decisions (who thinks, who writes, who draws) and
 * they were three rows of pills competing with the conversation title for the
 * width of the header. A row of pills also cannot say what an option is FOR,
 * which is the only thing that helps you choose between models whose prices
 * differ five-fold.
 *
 * So: a compact trigger showing the current choice, and a menu with the reason
 * to pick each one. Same component in the header (this conversation) and in the
 * job-description modal (her defaults) — identical mechanics, different scope.
 */

import { useEffect, useRef, useState } from 'react';

import styles from './Picker.module.css';

export interface PickerOption {
  id: string;
  label: string;
  /** Why you would choose this one. Shown under the name. */
  about?: string;
  /** Right-hand note — a price, a speed. */
  meta?: string;
}

interface Props {
  /** The emoji that says which decision this is. */
  icon: string;
  /** What the choice is called, e.g. "Thinks with". Shown in the menu header. */
  title: string;
  options: PickerOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  /**
   * When set, a first option meaning "no explicit choice" — her default in the
   * header, absent in the modal where the default IS what you are setting.
   */
  fallback?: { label: string; about?: string } | null;
  disabled?: boolean;
}

export function Picker({ icon, title, options, value, onChange, fallback = null, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  // Close on anything that isn't this menu. Pointerdown rather than click so it
  // closes on the way down, before a click elsewhere has to be swallowed.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const chosen = options.find(o => o.id === value);
  const showing = chosen?.label || fallback?.label || 'Choose';

  function pick(id: string | null) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div className={styles.wrap} ref={wrap}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''} ${chosen ? styles.triggerSet : ''}`}
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
        title={`${title} — ${showing}`}
      >
        <span className={styles.icon}>{icon}</span>
        <span className={styles.current}>{showing}</span>
        <span className={styles.caret}>▾</span>
      </button>

      {open && (
        <div className={styles.menu} role="listbox">
          <div className={styles.menuHead}>{title}</div>

          {fallback && (
            <button
              type="button"
              className={`${styles.option} ${!value ? styles.optionOn : ''}`}
              onClick={() => pick(null)}
              role="option"
              aria-selected={!value}
            >
              <span className={styles.tick}>{!value ? '✓' : ''}</span>
              <span className={styles.optionBody}>
                <span className={styles.optionLabel}>{fallback.label}</span>
                {fallback.about && <span className={styles.optionAbout}>{fallback.about}</span>}
              </span>
            </button>
          )}

          {options.map(o => (
            <button
              key={o.id}
              type="button"
              className={`${styles.option} ${value === o.id ? styles.optionOn : ''}`}
              onClick={() => pick(o.id)}
              role="option"
              aria-selected={value === o.id}
            >
              <span className={styles.tick}>{value === o.id ? '✓' : ''}</span>
              <span className={styles.optionBody}>
                <span className={styles.optionLabel}>
                  {o.label}
                  {o.meta && <span className={styles.optionMeta}>{o.meta}</span>}
                </span>
                {o.about && <span className={styles.optionAbout}>{o.about}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
