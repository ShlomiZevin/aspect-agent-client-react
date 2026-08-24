/**
 * HQ icons — the same stroked line-icon language as the customer chat
 * (`live-chat/icons.tsx`): 24-box, currentColor, 1.8 stroke, round caps.
 */

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const IconAsk = () => (
  <svg {...base}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /><circle cx="12" cy="12" r="3.4" /></svg>
);

export const IconDrop = () => (
  <svg {...base}><path d="M12 3v12M8 11l4 4 4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
);

export const IconLibrary = () => (
  <svg {...base}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v16" /></svg>
);

export const IconSources = () => (
  <svg {...base}><path d="M9.5 14.5 14.5 9.5" /><path d="M7.8 11.2 6 13a3.9 3.9 0 0 0 5.5 5.5l1.8-1.8" /><path d="M16.2 12.8 18 11a3.9 3.9 0 0 0-5.5-5.5L10.7 7.3" /></svg>
);

export const IconSun = () => (
  <svg {...base}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
);

export const IconMoon = () => (
  <svg {...base}><path d="M20 14.5A8.2 8.2 0 0 1 9.5 4a8.3 8.3 0 1 0 10.5 10.5Z" /></svg>
);

export const IconSend = () => (
  <svg {...base}><path d="M12 19V5M6 11l6-6 6 6" /></svg>
);

export const IconBack = () => (
  <svg {...base}><path d="M15 18l-6-6 6-6" /></svg>
);

export const IconSearch = () => (
  <svg {...base}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
);

export const IconRefresh = () => (
  <svg {...base}><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v5h-5" /></svg>
);

export const IconEdit = () => (
  <svg {...base}><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="M15 6l3 3" /></svg>
);

export const IconTrash = () => (
  <svg {...base}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg>
);

export const IconExternal = () => (
  <svg {...base}><path d="M14 4h6v6M20 4l-8 8" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
);

export const IconCheck = () => (
  <svg {...base}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

export const IconDecision = () => (
  <svg {...base}><path d="M12 3l2.6 5.6L20.5 9.4l-4.3 4.1 1.1 5.9L12 16.6 6.7 19.4l1.1-5.9-4.3-4.1 5.9-.8Z" /></svg>
);

export const IconQuestion = () => (
  <svg {...base}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.2a2.6 2.6 0 1 1 3.4 2.5c-.6.2-.9.8-.9 1.4v.6" /><path d="M12 17h.01" /></svg>
);

export const IconPlug = () => (
  <svg {...base}><path d="M9 3v6M15 3v6" /><path d="M6 9h12v3a6 6 0 0 1-12 0V9Z" /><path d="M12 18v3" /></svg>
);

export const IconActivity = () => (
  <svg {...base}><path d="M3 12h4l2.5-6 4 13 2.5-7h5" /></svg>
);

export const IconTeam = () => (
  <svg {...base}><circle cx="9" cy="8" r="3.2" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.6a3.2 3.2 0 0 1 0 6.3" /><path d="M18.5 20a6 6 0 0 0-3-5.2" /></svg>
);

export const IconMedia = () => (
  <svg {...base}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.6" /><path d="M21 16l-5-5-6.5 6.5" /></svg>
);
