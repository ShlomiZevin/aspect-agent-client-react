import type { KeyboardEvent } from 'react';

/**
 * Props that make a row container (not a <button>, so links can sit inside
 * it) open its task on click, Enter or Space. Keys pressed on a child — a
 * link — are left alone.
 */
export function openProps(open: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: open,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    },
  };
}
