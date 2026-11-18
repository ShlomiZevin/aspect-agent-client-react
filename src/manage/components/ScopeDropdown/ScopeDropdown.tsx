/**
 * The scope control at the top of the side panel (task #985, round 6):
 * which agents the page shows. A light field that stands out on the dark
 * panel, with a visible chevron; its list opens as a white popover with the
 * current item marked (tick + highlight). Keyboard: Enter / Space / ↓ opens,
 * ↑ ↓ move, Enter picks, Esc closes. One option (a one-agent person) = just
 * the name, no list.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { IconAgent, IconCheck, IconChevronDown, IconGrid } from '../../icons';
import { COPY } from '../../copy';
import s from './ScopeDropdown.module.css';

export interface ScopeOption {
  value: string;
  label: string;
}

interface Props {
  options: ScopeOption[];
  value: string;
  onChange: (value: string) => void;
  /** The phone bar's smaller size. */
  compact?: boolean;
}

const iconOf = (value: string) => (value === 'all' ? <IconGrid size={15} /> : <IconAgent size={15} />);

export function ScopeDropdown({ options, value, onChange, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const current = options.find(o => o.value === value) || { value, label: value };

  // A click anywhere else closes the list.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Keyboard focus follows the active item while the list is open.
  useEffect(() => {
    if (open) list.current?.querySelectorAll<HTMLLIElement>('[role="option"]')[active]?.focus();
  }, [open, active]);

  const openList = () => {
    setActive(Math.max(options.findIndex(o => o.value === value), 0));
    setOpen(true);
  };
  const pick = (v: string) => {
    setOpen(false);
    button.current?.focus();
    if (v !== value) onChange(v);
  };

  if (options.length <= 1) {
    return (
      <div className={`${s.root} ${compact ? s.compact : ''}`}>
        <div className={`${s.field} ${s.fieldStatic}`}>
          <span className={s.fieldIcon}>{iconOf(current.value)}</span>
          <span className={s.fieldLabel} dir="auto">{current.label}</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={root} className={`${s.root} ${compact ? s.compact : ''}`}>
      <button
        ref={button}
        type="button"
        className={`${s.field} ${open ? s.fieldOpen : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${COPY.scopeLabel}: ${current.label}`}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={e => {
          if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key) && !open) { e.preventDefault(); openList(); }
        }}
      >
        <span className={s.fieldIcon}>{iconOf(current.value)}</span>
        <span className={s.fieldLabel} dir="auto">{current.label}</span>
        <IconChevronDown size={16} className={`${s.chevron} ${open ? s.chevronOpen : ''}`} />
      </button>

      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          className={s.list}
          aria-label={COPY.scopeLabel}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, options.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
            else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
            else if (e.key === 'End') { e.preventDefault(); setActive(options.length - 1); }
            else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(options[active].value); }
            else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); button.current?.focus(); }
            else if (e.key === 'Tab') setOpen(false);
          }}
        >
          {options.map((o, i) => {
            const selected = o.value === value;
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={selected}
                tabIndex={-1}
                className={`${s.option} ${selected ? s.optionSelected : ''} ${o.value === 'all' ? s.optionAll : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o.value)}
              >
                <span className={s.optionIcon}>{iconOf(o.value)}</span>
                <span className={s.optionLabel} dir="auto">{o.label}</span>
                {selected && <IconCheck size={15} className={s.tick} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
