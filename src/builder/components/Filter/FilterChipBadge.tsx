/**
 * FilterChipBadge — the small ▽ icon shown in the top-right corner
 * of an addon's chain chip when a run filter is configured, plus the
 * instant-show hover card that previews the filter's conditions.
 *
 * Browser-native `title` tooltips have a long delay (~500–800 ms),
 * are unstyleable, and render newlines as ugly text. We replace it
 * with our own popup so the author gets immediate feedback when
 * scanning the chain — pivotal for "what's gating each step?" reads.
 *
 * Click also opens an explicit FilterModal (passed in via `onOpen`)
 * so authors who'd rather click than peek get there directly.
 */

import { useRef, useState } from 'react';
import { conditionLine, filterHeadline } from './filterFormat';
import type { AddonFilter } from '../../types';
import styles from './FilterChipBadge.module.css';

interface Props {
  /** Active filter on the addon. `undefined` (or empty conditions) →
   *  the badge renders in a silent / muted state so the affordance
   *  to ADD a filter is still discoverable without growing the chip
   *  layout. The hover popup adapts: "No filter — click to add". */
  filter?: AddonFilter;
  /** True while the parent chip is being hovered. Used by the
   *  muted (no-filter) state to stay invisible until the author is
   *  already looking at this chip — so unfiltered chips don't shout
   *  the affordance on the entire chain row at once. Active /
   *  configured filters ignore this and always render. */
  chipHovered: boolean;
  onOpen: () => void;
}

/** How long to keep the popup open after the cursor leaves the
 *  badge — gives the eye a beat to read a longer condition before
 *  it disappears, without lingering after the user moves on. */
const CLOSE_DELAY_MS = 80;

export function FilterChipBadge({ filter, chipHovered, onOpen }: Props) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  const hasFilter = !!filter
    && Array.isArray(filter.conditions)
    && filter.conditions.length > 0;
  const isExclude = hasFilter && filter!.mode === 'exclude';

  // Visual state. Active filter → always visible in its mode colour.
  // No filter → muted, AND hidden entirely until the parent chip is
  // being hovered (so the chain row at rest doesn't show a funnel on
  // every card). The popup `open` state also keeps it visible —
  // otherwise the popup would briefly orphan itself when the cursor
  // moves into it.
  const visible = hasFilter || chipHovered || open;
  const stateClass = hasFilter
    ? (isExclude ? styles.badgeExclude : styles.badgeActive)
    : styles.badgeMuted;
  const visibilityClass = visible ? '' : styles.badgeHidden;

  return (
    <span
      role="button"
      tabIndex={0}
      className={`${styles.badge} ${stateClass} ${visibilityClass}`}
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
      onFocus={() => { cancelClose(); setOpen(true); }}
      onBlur={scheduleClose}
      onClick={e => {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        onOpen();
      }}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
          onOpen();
        }
      }}
      aria-label={hasFilter
        ? `Run filter (${filter!.conditions.length} condition${filter!.conditions.length === 1 ? '' : 's'}) — click to edit`
        : 'No run filter — click to add one'}
    >
      ▽
      {open && (
        <span
          className={styles.popup}
          // Block the popup mouse events from bubbling to the chip
          // (which would otherwise read them as drag attempts).
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          onClick={e => e.stopPropagation()}
        >
          <span className={styles.popupHeader}>
            {filterHeadline(filter)}
          </span>
          {hasFilter && (
            <span className={styles.popupList}>
              {filter!.conditions.map((c, i) => (
                <span key={i} className={styles.popupRow}>
                  <span className={styles.popupBullet} aria-hidden>•</span>
                  <span className={styles.popupCond}>{conditionLine(c)}</span>
                </span>
              ))}
            </span>
          )}
          <span className={styles.popupHint}>
            {hasFilter ? 'click to edit' : 'click to add a filter'}
          </span>
        </span>
      )}
    </span>
  );
}
