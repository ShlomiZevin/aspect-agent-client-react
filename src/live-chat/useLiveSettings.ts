/**
 * Live-chat UI settings, persisted to localStorage. Independent of the
 * app-wide ThemeContext/LanguageContext — this surface owns its own
 * language/theme/branding/mode so it never mutates document.documentElement.
 */

import { useCallback, useState } from 'react';
import type { Lang } from './i18n';
import { SCENARIOS } from './liveConfig';

export interface LiveSettings {
  lang: Lang;
  theme: 'light' | 'dark';
  client: string;
  scenario: string;
  mode: 'normal' | 'debug';
  /** When true, Enter inserts a newline and Ctrl/Cmd+Enter sends. */
  ctrlEnter: boolean;
}

const KEY = 'lybi-live:settings';

const DEFAULTS: LiveSettings = {
  lang: 'he',
  theme: 'light',
  client: 'lybi',
  scenario: SCENARIOS[0]?.id ?? 'account',
  mode: 'normal',
  ctrlEnter: false,
};

function load(): LiveSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<LiveSettings>) };
  } catch {
    return DEFAULTS;
  }
}

export function useLiveSettings(): [LiveSettings, (patch: Partial<LiveSettings>) => void] {
  const [settings, setSettings] = useState<LiveSettings>(load);

  const update = useCallback((patch: Partial<LiveSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // ignore storage failures
      }
      return next;
    });
  }, []);

  return [settings, update];
}
