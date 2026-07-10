/**
 * LiveBrainMockPage — a runnable, in-project mockup of the Live Brain.
 *
 * Standalone demo surface (not wired to a live agent yet). Renders the
 * customer-facing Live Brain panel next to a chat backdrop, plus a Setup tab
 * showing how a panel is authored. The panels themselves come from the
 * reusable <LiveBrainContent/> — the actual integration unit — fed by mock
 * config + values. Swap those two for a live config + memory blob and the
 * same components render production data.
 *
 * Routes: /lybi/brain-mock  and  /:agent/brain-mock
 */

import { useState } from 'react';
import { getMock, mockChat } from './live-brain/mockData';
import { LiveBrainContent } from './live-brain/LiveBrainContent';
import { SetupMock } from './live-brain/SetupMock';
import './liveChat.css';

type View = 'customer' | 'setup';
type Lang = 'en' | 'he';
type Theme = 'light' | 'dark';

function BrainSvg() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9.5 3A2.5 2.5 0 0 0 7 5.5 2.5 2.5 0 0 0 5 8a2.5 2.5 0 0 0 0 4 2.5 2.5 0 0 0 1 4.5A2.5 2.5 0 0 0 9.5 21 2.5 2.5 0 0 0 12 18.5V4.5A2.5 2.5 0 0 0 9.5 3Z" />
      <path d="M14.5 3A2.5 2.5 0 0 1 17 5.5 2.5 2.5 0 0 1 19 8a2.5 2.5 0 0 1 0 4 2.5 2.5 0 0 1-1 4.5A2.5 2.5 0 0 1 14.5 21 2.5 2.5 0 0 1 12 18.5" />
    </svg>
  );
}

function RefreshSvg() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" />
    </svg>
  );
}

export function LiveBrainMockPage() {
  const [view, setView] = useState<View>('customer');
  const [lang, setLang] = useState<Lang>('en');
  const [theme, setTheme] = useState<Theme>('light');

  const { config, values } = getMock(lang);
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
              <div className="panel-inner">
                <div className="lb-bhead">
                  <div className="lb-bglyph"><BrainSvg /></div>
                  <div>
                    <div className="lb-btitle">{tr('Live Brain', 'המוח החי')}</div>
                    <div className="lb-live"><span className="lb-pulse" /> {tr('updated just now', 'עודכן ממש עכשיו')}</div>
                  </div>
                  <button className="lb-refresh"><RefreshSvg /> {tr('Refresh', 'רענון')}</button>
                </div>
                <div className="lb-scrollcol">
                  <LiveBrainContent config={config} values={values} />
                </div>
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
