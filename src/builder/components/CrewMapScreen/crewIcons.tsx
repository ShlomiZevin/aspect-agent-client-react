/**
 * Crew map icons — small inline line icons (24×24, stroke = currentColor),
 * so the map needs no icon package. `crewIconFor` picks one from the
 * crew's name; anything unknown gets a neutral glyph.
 */

import type { ReactNode } from 'react';

export type IconName =
  | 'chat' | 'search' | 'compass' | 'star' | 'box' | 'check' | 'person' | 'building' | 'people'
  | 'scales' | 'anchor' | 'lock' | 'flag' | 'sparkle' | 'play' | 'bolt' | 'clock' | 'pencil'
  | 'warning' | 'chevron' | 'back' | 'fit' | 'bulb' | 'layers' | 'doc' | 'heart' | 'globe' | 'arrowIn' | 'arrowOut';

const PATHS: Record<IconName, ReactNode> = {
  chat: <path d="M20.5 11.5a8 8 0 0 1-11.7 7.1L4 19.8l1.2-4.4A8 8 0 1 1 20.5 11.5z" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>,
  compass: <><circle cx="12" cy="12" r="8.5" /><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z" /></>,
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  box: <><path d="M20.5 7.8L12 3.3 3.5 7.8v8.4l8.5 4.5 8.5-4.5z" /><path d="M3.5 7.8L12 12.3l8.5-4.5M12 12.3v8.4" /></>,
  check: <><circle cx="12" cy="12" r="8.5" /><path d="M8.2 12.3l2.6 2.6 5-5.2" /></>,
  person: <><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20.5c.6-3.9 3.7-6.3 7.5-6.3s6.9 2.4 7.5 6.3" /></>,
  building: <><path d="M4.5 20.5V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v15.5M14.5 9.5h4a1 1 0 0 1 1 1v10M3 20.5h18" /><path d="M8 8h3M8 11.5h3M8 15h3" /></>,
  people: <><circle cx="9" cy="8.5" r="3.3" /><path d="M2.8 19.5c.5-3.3 3-5.4 6.2-5.4s5.7 2.1 6.2 5.4M15.8 5.4a3.3 3.3 0 0 1 0 6.3M17.6 14.4c2 .6 3.3 2.4 3.6 5.1" /></>,
  scales: <><path d="M12 4v16M8 20h8M5.5 7.5h13M12 4.5l-6.5 3M12 4.5l6.5 3" /><path d="M5.5 7.5L3 13a2.7 2.7 0 0 0 5 0zM18.5 7.5L16 13a2.7 2.7 0 0 0 5 0z" /></>,
  anchor: <><circle cx="12" cy="5.5" r="2" /><path d="M12 7.5v13M8.5 11h7M4.8 13.5a7.2 7.2 0 0 0 14.4 0" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2.2" /><path d="M8.3 10.5V8a3.7 3.7 0 0 1 7.4 0v2.5" /></>,
  flag: <path d="M5.5 21V4.5M5.5 4.5h11l-2.2 4 2.2 4h-11" />,
  sparkle: <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z" />,
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" />,
  bolt: <path d="M13 2.5L4.5 13.5h6.5l-1 8 8.5-11h-6.5z" fill="currentColor" stroke="none" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  pencil: <path d="M4.5 19.5h3.8L19 8.8 15.2 5 4.5 15.7zM13.6 6.6l3.8 3.8" />,
  warning: <><path d="M12 3.8L2.5 20h19z" /><path d="M12 10v4.5M12 17.2v.1" /></>,
  chevron: <path d="M9.5 6l6 6-6 6" />,
  back: <path d="M14.5 6l-6 6 6 6" />,
  fit: <path d="M4.5 9V4.5H9M19.5 9V4.5H15M4.5 15v4.5H9M19.5 15v4.5H15" />,
  bulb: <path d="M9.5 18h5M10.3 21h3.4M12 3a6 6 0 0 0-3.8 10.6c.8.7 1.3 1.5 1.3 2.4h5c0-.9.5-1.7 1.3-2.4A6 6 0 0 0 12 3z" />,
  layers: <path d="M12 3.5l8.5 4.5L12 12.5 3.5 8zM3.5 12l8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5" />,
  doc: <><path d="M6.5 3.5h7.5l4 4v13h-11.5z" /><path d="M13.5 3.5v4.5h4.5M9.5 12.5h5M9.5 16h5" /></>,
  heart: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5S9.7 5.9 12 3.5z" /></>,
  arrowIn: <path d="M19 12H5.5M11 6l-6 6 6 6" />,
  arrowOut: <path d="M5 12h13.5M13 6l6 6-6 6" />,
};

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

const BY_WORD: [RegExp, IconName][] = [
  [/welcome|greet|rout|intro|hello|start|onboard/, 'chat'],
  [/path|journey|direction/, 'compass'],
  [/motive|discover|why|need|explor|interview/, 'search'],
  [/product/, 'box'],
  [/recommend|suggest|offer|match/, 'star'],
  [/clos|finish|done|complet|wrap|end|confirm|summary/, 'check'],
  [/young|minor|child|kid|teen|under|age|student/, 'person'],
  [/business|company|corporate|enterprise|firm/, 'building'],
  [/partner|joint|family|couple|team|group/, 'people'],
  [/decision|decide|choice|compare|objection/, 'scales'],
  [/anchor|reinforc|nudge|value/, 'anchor'],
  [/document|form|detail|kyc|verify|identity/, 'doc'],
  [/support|care|wellness|feel|symptom|health/, 'heart'],
  [/language|global|country|international/, 'globe'],
];

const FALLBACK: IconName[] = ['sparkle', 'layers', 'compass', 'star'];

export function crewIconFor(name: string, index: number): IconName {
  const n = name.toLowerCase();
  for (const [re, icon] of BY_WORD) if (re.test(n)) return icon;
  return FALLBACK[index % FALLBACK.length];
}
