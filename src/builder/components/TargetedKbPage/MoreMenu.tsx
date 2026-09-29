/**
 * Small "⋯" menu + an on/off switch — the Targeted KB page keeps rarely
 * used actions (rename, move, delete) out of sight instead of scattering
 * link-looking buttons across the screen.
 *
 * The popover floats (absolute), so opening it never moves anything.
 */

import { useEffect, useRef, useState } from 'react';
import styles from './TargetedKbPage.module.css';

export interface MenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  /** Draw a separator above this item. */
  divider?: boolean;
}

export function MoreMenu({ items, title = 'More actions' }: { items: MenuItem[]; title?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className={styles.menuWrap} ref={ref}>
      <button type="button" className={`${styles.iconBtn} ${open ? styles.iconBtnOn : ''}`}
        aria-haspopup="menu" aria-expanded={open} title={title} onClick={() => setOpen(o => !o)}>
        ⋯
      </button>
      {open && (
        <div role="menu" className={styles.menu}>
          {items.map(it => (
            <div key={it.label}>
              {it.divider && <div className={styles.menuDivider} />}
              <button type="button" role="menuitem"
                className={`${styles.menuItem} ${it.danger ? styles.menuDanger : ''}`}
                onClick={() => { setOpen(false); it.onClick(); }}>
                {it.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** On/off pill. Fixed width, so "On" ↔ "Off" never nudges its neighbours. */
export function Switch({ on, onToggle, title }: { on: boolean; onToggle: () => void; title?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} title={title}
      className={`${styles.switch} ${on ? styles.switchOn : ''}`} onClick={onToggle}>
      <span className={styles.switchKnob} />
      <span className={styles.switchText}>{on ? 'On' : 'Off'}</span>
    </button>
  );
}
