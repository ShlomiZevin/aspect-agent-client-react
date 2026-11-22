/**
 * Line icons for the management center (task #985) — stroke = currentColor,
 * thin and rounded.
 */

import type { ReactNode, SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: P & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {children}
    </svg>
  );
}

/** A warning triangle — the customer-problems page. */
export const IconAlert = (p: P) => (
  <Svg {...p}><path d="M10.3 4.2L2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z" /><path d="M12 9.5v4.2" /><path d="M12 17h.01" strokeWidth={2.4} /></Svg>
);
export const IconCheckCircle = (p: P) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8 12.3l2.7 2.7L16.2 9.4" /></Svg>
);
export const IconChat = (p: P) => (
  <Svg {...p}><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4A8 8 0 1 1 20 12z" /></Svg>
);
export const IconClock = (p: P) => (<Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>);
export const IconFlask = (p: P) => (
  <Svg {...p}><path d="M9.5 3.5h5M10.5 3.5v5.2L5.2 18a1.7 1.7 0 0 0 1.5 2.5h10.6a1.7 1.7 0 0 0 1.5-2.5l-5.3-9.3V3.5" /><path d="M7.6 14h8.8" /></Svg>
);
export const IconCheck = (p: P) => (<Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>);
export const IconChevronDown = (p: P) => (<Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>);
export const IconRefresh = (p: P) => (
  <Svg {...p}><path d="M20 11a8 8 0 0 0-14.3-4.5L4 8.5" /><path d="M4 4v4.5h4.5" /><path d="M4 13a8 8 0 0 0 14.3 4.5l1.7-2" /><path d="M20 20v-4.5h-4.5" /></Svg>
);
export const IconExternal = (p: P) => (
  <Svg {...p}><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" /></Svg>
);
export const IconClose = (p: P) => (<Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>);
/** Sign out, drawn for RTL: the door on the right, the arrow leaving to the left (the way Hebrew reads on). */
export const IconSignOut = (p: P) => (
  <Svg {...p}><path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15" /><path d="M10 16l-4-4 4-4" /><path d="M6 12h10" /></Svg>
);
export const IconAgent = (p: P) => (
  <Svg {...p}><rect x="4.5" y="7" width="15" height="11" rx="3" /><path d="M12 7V4.5" /><circle cx="9.3" cy="12.5" r="1" fill="currentColor" /><circle cx="14.7" cy="12.5" r="1" fill="currentColor" /></Svg>
);
/** Two people — the users page. */
export const IconUsers = (p: P) => (
  <Svg {...p}><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" /><path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8" /><path d="M17.5 14.3a5.5 5.5 0 0 1 3 5.2" /></Svg>
);
export const IconPause = (p: P) => (<Svg {...p}><path d="M9 5.5v13M15 5.5v13" /></Svg>);
export const IconPlay = (p: P) => (<Svg {...p}><path d="M8 5.5l10.5 6.5L8 18.5z" /></Svg>);
export const IconTrash = (p: P) => (
  <Svg {...p}><path d="M4.5 7h15" /><path d="M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2" /><path d="M6.5 7l.8 11.6A2 2 0 0 0 9.3 20.5h5.4a2 2 0 0 0 2-1.9L17.5 7" /><path d="M10.2 11v5.5M13.8 11v5.5" /></Svg>
);
export const IconGrid = (p: P) => (
  <Svg {...p}><rect x="4" y="4" width="6.5" height="6.5" rx="1.4" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4" /></Svg>
);
/** A calendar — the period toggle's from–to (#1001). */
export const IconCalendar = (p: P) => (
  <Svg {...p}><rect x="4" y="5.5" width="16" height="14.5" rx="2" /><path d="M4 10h16" /><path d="M8.5 3.5v4M15.5 3.5v4" /></Svg>
);
