/**
 * Line icons for the management center (task #985) — stroke = currentColor,
 * thin and rounded like the picked design (round3/D-*-sunburst.jpg).
 */

import type { ReactNode, SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...rest }: P & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {children}
    </svg>
  );
}

/** "All agents" — four tiles. */
export const IconGrid = (p: P) => (
  <Svg {...p}><rect x="3.5" y="3.5" width="7" height="7" rx="1.6" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.6" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.6" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.6" /></Svg>
);
/** One agent. */
export const IconBuilding = (p: P) => (
  <Svg {...p}><path d="M3 9.5l9-5.5 9 5.5" /><path d="M5 10v8.5M9.7 10v8.5M14.3 10v8.5M19 10v8.5" /><path d="M3 20.5h18" /></Svg>
);
/** A page of the menu. */
export const IconPage = (p: P) => (
  <Svg {...p}><rect x="3.5" y="4" width="17" height="16" rx="2" /><path d="M7 8.5h4M7 12h4M7 15.5h4" /><rect x="13.5" y="8" width="3.5" height="8" rx=".6" /></Svg>
);
export const IconAlertCircle = (p: P) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5" /><path d="M12 16.3h.01" strokeWidth={2.6} /></Svg>
);
export const IconCheckCircle = (p: P) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8 12.3l2.7 2.7L16.2 9.4" /></Svg>
);
export const IconCheckSolid = (p: P) => (
  <svg width={p.size ?? 20} height={p.size ?? 20} viewBox="0 0 24 24" aria-hidden>
    <circle cx="12" cy="12" r="10" fill="currentColor" />
    <path d="M7.5 12.3l3 3 6-6.3" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const IconChevronLeft = (p: P) => (<Svg {...p}><path d="M14.5 6l-6 6 6 6" /></Svg>);
export const IconChevronDown = (p: P) => (<Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>);
export const IconRefresh = (p: P) => (
  <Svg {...p}><path d="M20 11a8 8 0 0 0-14.3-4.5L4 8.5" /><path d="M4 4v4.5h4.5" /><path d="M4 13a8 8 0 0 0 14.3 4.5l1.7-2" /><path d="M20 20v-4.5h-4.5" /></Svg>
);
export const IconUnlock = (p: P) => (
  <Svg {...p}><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7" /></Svg>
);
export const IconClock = (p: P) => (<Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>);
export const IconPhone = (p: P) => (
  <Svg {...p}><path d="M6.6 3.5h2.6l1.4 4-2 1.3a11 11 0 0 0 6.6 6.6l1.3-2 4 1.4v2.6a1.6 1.6 0 0 1-1.7 1.6A16.5 16.5 0 0 1 5 5.2a1.6 1.6 0 0 1 1.6-1.7z" /></Svg>
);
export const IconPerson = (p: P) => (
  <Svg {...p}><circle cx="12" cy="8.5" r="3.6" /><path d="M5 20c.6-3.6 3.4-5.6 7-5.6s6.4 2 7 5.6" /></Svg>
);
