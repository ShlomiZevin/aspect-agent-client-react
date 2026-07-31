/**
 * Live-chat demo configuration.
 *
 * The agent itself comes from the URL slug (`/:agent/live`), so there
 * are NO agent slugs to maintain here. This file only carries:
 *   - white-label clients (swap the logo / brand name for demos)
 *   - "demo version" scenario labels (Noa's selector) — labels only,
 *     decoupled from real agents for now (behavior TBD).
 */

import type { Lang } from './i18n';

export interface DemoClient {
  id: string;
  name: Record<Lang, string>;
  /** When set, shown as the brand logo; otherwise a gradient-dot + name mark. */
  logoUrl?: string;
}

export interface DemoScenario {
  id: string;
  labels: Record<Lang, string>;
}

export const CLIENTS: DemoClient[] = [
  { id: 'lybi', name: { he: 'Lybi', en: 'Lybi' }, logoUrl: '/img/lybi-logo-transparent.png' },
  { id: 'bank', name: { he: 'הבנק שלי', en: 'My Bank' } },
  { id: 'insurance', name: { he: 'ביטוח פלוס', en: 'Insurance Plus' } },
  { id: 'health', name: { he: 'בריאות מאוחדת', en: 'United Health' } },
];

export const SCENARIOS: DemoScenario[] = [
  { id: 'account', labels: { he: 'פתיחת חשבון', en: 'Account opening' } },
  { id: 'objection', labels: { he: 'טיפול בהתנגדויות', en: 'Objection handling' } },
  { id: 'valueprop', labels: { he: 'בניית הצעת ערך', en: 'Value proposition' } },
  { id: 'profiling', labels: { he: 'פרופיילינג והתפתחות קשר', en: 'Profiling' } },
];

export function clientById(id: string): DemoClient {
  return CLIENTS.find(c => c.id === id) ?? CLIENTS[0];
}

/**
 * Default starting questions shown as boxes when there's no conversation
 * yet. Placeholder content until the builder lets authors configure these
 * per-agent (the builder will eventually feed this list).
 */
export interface QuickQuestion {
  icon: string;
  text: Record<Lang, string>;
}

export const DEFAULT_QUESTIONS: QuickQuestion[] = [
  { icon: '💬', text: { he: 'ספרי לי עליך', en: 'Tell me about you' } },
  { icon: '🤝', text: { he: 'רוצה להתחיל תהליך', en: 'I want to start a process' } },
  { icon: '🤔', text: { he: 'לא בטוח מה מתאים לי', en: "I'm not sure what fits me" } },
  { icon: '❓', text: { he: 'יש לי שאלה', en: 'I have a question' } },
];
