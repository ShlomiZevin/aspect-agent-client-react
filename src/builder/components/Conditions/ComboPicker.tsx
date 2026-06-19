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
 *   commits the value. Typing + blur or Enter (with no highlighted
 *   suggestion) commits the typed value.
 *
 * - `allowFreeText: false` — read-only input; the chevron is the only
 *   way to open the list and the value can only be one of `options`.
 *
 * Keyboard:
 *   - ArrowDown / ArrowUp     → move highlight through filtered list
 *   - Enter                    → pick highlighted, or commit raw text
 *                                (free-text mode) when no highlight
 *   - Escape                   → close menu, revert to last committed
 *
 * The dropdown MENU renders through a portal directly into
 * `document.body` so an ancestor with `overflow: hidden` (every modal
 * in the builder) can't clip the lower options.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  /** Names that should render with a "SYS" badge in the dropdown.
   *  Used by the conditions editor to mark platform-defined fields
   *  (e.g. `move_on`) so authors can tell them apart at a glance. */
  systemNames?: Set<string>;
}

interface MenuRect {
  top: number;
  left: number;
  width: number;
}

export function ComboPicker({
  value, options, onChange, placeholder,
  allowFreeText = true,
  className,
  systemNames,
}: ComboPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [menuRect, setMenuRect] = useState<MenuRect | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => { setDraft(value); }, [value]);

  // Compute the menu's absolute position from the input rect. Re-runs
  // when the menu opens AND whenever the window scrolls/resizes —
  // covers modal-body scrolls and viewport changes.
  useLayoutEffect(() => {
    if (!open) {
      setMenuRect(null);
      return;
    }
    const calc = () => {
      const el = inputRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setMenuRect({ top: r.bottom + 2, left: r.left, width: r.width });
    };
    calc();
    window.addEventListener('scroll', calc, true); // capture-phase catches scrolls inside the modal body
    window.addEventListener('resize', calc);
    return () => {
      window.removeEventListener('scroll', calc, true);
      window.removeEventListener('resize', calc);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      // Inside the input wrapper OR inside the portalled menu → keep open.
      if (ref.current && ref.current.contains(t)) return;
      const menu = document.getElementById('combo-picker-menu-active');
      if (menu && menu.contains(t)) return;
      setOpen(false);
      if (allowFreeText && draft !== value) onChange(draft);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, allowFreeText, draft, value, onChange]);

  const filtered = useMemo(() => {
    // Read-only pickers (enum / boolean) NEVER filter — the displayed
    // input value is the current selection, not a query, so filtering
    // by it leaves the menu showing only the already-picked value and
    // the user can't switch. Free-text pickers (field-name) DO filter
    // as the user types — `draft` is genuinely a query then.
    if (!allowFreeText) return options;
    const q = draft.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.toLowerCase().includes(q));
  }, [options, draft, allowFreeText]);

  // Reset the highlighted index whenever the filtered list changes
  // (typing narrows the list). Without this, the active index can
  // point past the end of the filtered array and Enter would commit
  // an empty selection.
  useEffect(() => {
    setActiveIdx(0);
  }, [filtered.length, open]);

  // Scroll the highlighted row into view as the user arrow-keys
  // through a long list. Same `block: 'nearest'` trick the mention
  // picker uses — handles both up and down without overshoot.
  useEffect(() => {
    if (!open) return;
    const btn = itemRefs.current[activeIdx];
    if (btn) btn.scrollIntoView({ block: 'nearest' });
  }, [activeIdx, open]);

  const pick = (v: string) => {
    setDraft(v);
    onChange(v);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setDraft(value);
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      if (!open) { setOpen(true); return; }
      if (filtered.length === 0) return;
      e.preventDefault();
      setActiveIdx(i => (i + 1) % filtered.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      if (!open) return;
      if (filtered.length === 0) return;
      e.preventDefault();
      setActiveIdx(i => (i - 1 + filtered.length) % filtered.length);
      return;
    }
    if (e.key === 'Enter') {
      // If the menu is open AND there's a highlighted row, pick it.
      // Otherwise free-text commits the raw input value.
      if (open && filtered.length > 0) {
        e.preventDefault();
        pick(filtered[activeIdx]);
        return;
      }
      if (allowFreeText) {
        onChange(draft);
        setOpen(false);
      }
    }
  };

  return (
    <div className={`${styles.combo} ${className ?? ''}`} ref={ref}>
      <input
        ref={inputRef}
        className={styles.comboInput}
        value={draft}
        readOnly={!allowFreeText}
        onChange={e => {
          setDraft(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
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
      {open && filtered.length > 0 && menuRect && createPortal(
        <div
          id="combo-picker-menu-active"
          className={styles.comboMenu}
          role="listbox"
          style={{
            position: 'fixed',
            top:    menuRect.top,
            left:   menuRect.left,
            ['--combo-min-width' as string]: `${menuRect.width}px`,
          }}
        >
          {filtered.map((o, idx) => {
            const isSystem = !!systemNames && systemNames.has(o);
            const isActive = idx === activeIdx;
            return (
              <button
                key={o}
                ref={el => { itemRefs.current[idx] = el; }}
                type="button"
                role="option"
                aria-selected={isActive}
                title={isSystem ? `${o} — system field` : o}
                className={
                  `${styles.comboItem} ` +
                  `${o === value ? styles.comboItemActive : ''} ` +
                  `${isActive ? styles.comboItemFocus : ''} ` +
                  `${isSystem ? styles.comboItemSystem : ''}`
                }
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseDown={e => e.preventDefault()}
                onClick={() => pick(o)}
              >
                <span className={styles.comboItemLabel}>{o}</span>
                {isSystem && <span className={styles.comboItemSysBadge}>SYS</span>}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
