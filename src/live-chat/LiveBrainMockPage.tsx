/**
 * LiveBrainMockPage — a runnable, in-project mockup of the Live Brain, now
 * rendered with the SAME Noa components the customer chat uses: the BrainViz
 * radar banner + PanelSurface (look="brain") via <BrainPanels/>. The old
 * bespoke renderer (LiveBrainContent) is kept only behind the Setup tab.
 *
 * This is the clean "focus on the Live Brain" surface — Noa's exact panel
 * set as mock data, so /brain-mock reads 1:1 with her design in light/dark
 * and en/he (RTL).
 *
 * Routes: /lybi/brain-mock  and  /:agent/brain-mock
 */

import { useState } from 'react';
import { getMock, mockChat } from './live-brain/mockData';
import { SetupMock } from './live-brain/SetupMock';
import { BrainPanels } from './components/BrainPanels';
import type { LiveBrainPanelData } from '../builder/state/builderApi';
import './liveChat.css';

type View = 'customer' | 'setup';
type Lang = 'en' | 'he';
type Theme = 'light' | 'dark';

/** Noa's exact Live Brain panel set (her "Lybi Live Brain" design), as mock
 *  data. Bilingual so the RTL layout can be checked in Hebrew. */
function noaBrainPanels(lang: Lang): LiveBrainPanelData[] {
  const he = lang === 'he';
  const t = (en: string, hebrew: string) => (he ? hebrew : en);
  return [
    {
      id: 'now',
      title: t("What's going on", 'מה קורה עכשיו'),
      render: 'text',
      text: t(
        'The user opened with *"Hi! 😊 How are you?"* — a warm, not-yet-goal-directed greeting.',
        'המשתמש פתח בשיחה עם *"היי! 😊 מה שלומך?"* — פנייה חמה, עדיין בלי מטרה ממוקדת.',
      ),
    },
    {
      id: 'snapshot',
      title: t('Snapshot', 'תמונת מצב'),
      render: 'html',
      text:
        `<div style="border:1px solid var(--lb-card-line);border-radius:12px;padding:12px 14px;background:var(--lb-tint)">` +
        `<div style="font-weight:700;margin-bottom:4px;color:var(--lb-title)">${t('Conversation with the user', 'שיחה עם המשתמש')}</div>` +
        `<div style="color:var(--lb-ink)">${t('The user opened the conversation with a "hi" greeting.', 'המשתמש פתח בשיחה עם ברכת "הי".')}</div></div>`,
    },
    {
      id: 'mood',
      title: t('Mood & topics', 'מצב רוח ונושאים'),
      render: 'tags',
      values: { tags: [t('greeting', 'ברכה'), t('friendly', 'ידידותי')], active: [t('greeting', 'ברכה')] },
    },
    {
      id: 'facts',
      title: t('Key facts', 'עובדות מפתח'),
      render: 'fields',
      values: {
        pairs: [
          { k: t('Goal', 'מטרה'), v: t('Chat initiation', 'פתיחת שיחה') },
          { k: t('Mood', 'מצב רוח'), v: t('Friendly', 'ידידותי') },
          { k: t('Topic', 'נושא'), v: t('Greeting', 'ברכה') },
        ],
      },
    },
    {
      id: 'read',
      title: t('Read on the user', 'קריאה על המשתמש'),
      render: 'bars',
      values: {
        bars: [
          { label: t('Engagement', 'מעורבות'), value: 60 },
          { label: t('Confidence', 'ביטחון'), value: 50 },
          { label: t('Urgency', 'דחיפות'), value: 30 },
          { label: t('Positivity', 'חיוביות'), value: 70 },
        ],
      },
    },
  ];
}

export function LiveBrainMockPage() {
  const [view, setView] = useState<View>('customer');
  const [lang, setLang] = useState<Lang>('en');
  const [theme, setTheme] = useState<Theme>('light');

  const { config } = getMock(lang);
  const chat = mockChat(lang);
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  const tr = (en: string, he: string) => (lang === 'he' ? he : en);

  return (
    <div className="lybi-chat lb-mock" data-theme={theme} dir={dir}>
      <div className="lb-top">
        <div className="lb-brand">l<b>y</b>bi</div>
        <div className="lb-seg" role="tablist" aria-label="View">
          <button role="tab" aria-selected={view === 'customer'} onClick={() => setView('customer')}>
            {tr('Customer view', 'תצוגת לקוח')}
          </button>
          <button role="tab" aria-selected={view === 'setup'} onClick={() => setView('setup')}>
            {tr('Setup', 'הגדרה')}
          </button>
        </div>
        <div className="lb-grow" />
        <button className="lb-tbtn" onClick={() => setLang((l) => (l === 'en' ? 'he' : 'en'))}>
          {lang === 'en' ? 'עברית' : 'English'}
        </button>
        <button className="lb-tbtn" onClick={() => setTheme((th) => (th === 'light' ? 'dark' : 'light'))} aria-label="Toggle theme">
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>

      <div className="lb-stage">
        {view === 'customer' ? (
          <div className="app">
            <aside className="side brain open">
              <div className="panel-inner lb-mock-panel">
                <BrainPanels panels={noaBrainPanels(lang)} />
              </div>
            </aside>

            <div className="chat-col">
              <div className="lb-chat">
                {chat.map((m, i) => (
                  <div key={i} className={`lb-bubble ${m.role}`}>{m.text}</div>
                ))}
              </div>
              <div className="lb-composer">
                <div className="lb-cbox">{tr('Message Lybi…', 'כתבי ל-Lybi…')}</div>
              </div>
            </div>
          </div>
        ) : (
          <SetupMock config={config} />
        )}
      </div>
    </div>
  );
}
