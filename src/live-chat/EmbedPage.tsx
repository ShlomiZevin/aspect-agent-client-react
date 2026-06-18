/**
 * EmbedPage — "agent on a website" demo.
 *
 * A thin Lybi-branded mock site (Lybi = the Intelligent Relationship
 * System — a multi-agent AI platform, NOT banking) with the agent shown
 * as a floating chat widget. The widget body is a real <iframe> pointing
 * at `/<agent>/live?embed=1`, so it's exactly what a customer embeds —
 * the `embed=1` flag makes the chat render in a compact size.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IconChat, IconClose } from './icons';
import './embed.css';

const POINTS = [
  { icon: '🧠', label: 'Memory' },
  { icon: '🎯', label: 'Reasoning' },
  { icon: '💬', label: 'Voice' },
];

/** Read the chat's language (set inside the iframe) so the widget header
 *  matches. Updates live via same-origin `storage` events when the user
 *  toggles language inside the embedded chat. */
function useChatLang(): 'he' | 'en' {
  const read = (): 'he' | 'en' => {
    try {
      const raw = localStorage.getItem('lybi-live:settings');
      return raw && JSON.parse(raw).lang === 'en' ? 'en' : 'he';
    } catch {
      return 'he';
    }
  };
  const [lang, setLang] = useState<'he' | 'en'>(read);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'lybi-live:settings' || e.key === null) setLang(read());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return lang;
}

export function EmbedPage() {
  const { agent } = useParams<{ agent: string }>();
  const slug = agent ?? 'lybi';
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const lang = useChatLang();
  const he = lang === 'he';

  return (
    <div className="lybi-embed" dir="ltr">
      {/* ---- thin Lybi host site ---- */}
      <header className="site-nav">
        <img className="site-logo" src="/img/lybi-logo-transparent.png" alt="Lybi" />
        <nav className="site-links">
          <a href="#">Our Belief</a>
          <a href="#">What We Enable</a>
          <a href="#">About</a>
        </nav>
        <button className="site-link-btn" onClick={() => navigate(`/${slug}/live`)}>Open full chat ↗</button>
        <button className="site-cta">Book a demo</button>
      </header>

      <main className="site-hero">
        <span className="hero-badge">The Intelligent Relationship System</span>
        <h1>Relationships that <span className="grad">remember</span>.</h1>
        <p>Lybi builds AI agents that reason, remember and grow real relationships with your customers — cognitive systems, not scripted chatbots.</p>
        <div className="hero-actions">
          <button className="primary">Get started</button>
          <button className="ghost">Learn more</button>
        </div>
        <div className="hero-points">
          {POINTS.map(p => (
            <span className="point" key={p.label}><b>{p.icon}</b> {p.label}</span>
          ))}
        </div>
      </main>

      <div className="demo-note">Demo · the agent shown as an embedded widget on a Lybi page</div>

      {/* ---- floating chat widget ---- */}
      <div className="widget">
        {open && (
          <div className="widget-window" dir={he ? 'rtl' : 'ltr'}>
            <div className="widget-head">
              <span className="wh-av">L</span>
              <div className="wh-name">
                Lybi
                <div className="wh-sub">{he ? 'כאן כדי לעזור' : 'Here to help'}</div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="close"><IconClose size={18} /></button>
            </div>
            <iframe className="widget-frame" src={`/${slug}/live?embed=1`} title="Lybi chat" />
          </div>
        )}
        <button className="widget-launcher" onClick={() => setOpen(o => !o)} aria-label="chat">
          {open ? <IconClose size={26} /> : <IconChat />}
        </button>
      </div>
    </div>
  );
}
