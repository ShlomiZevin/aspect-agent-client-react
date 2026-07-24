import { useEffect } from 'react';
import { Link } from 'react-router-dom';

// Static page: what "Effortless Installation" means, what it includes,
// what it explicitly does not, and the one-time effort to go live.

const PURPLE = '#680662';
const INK = '#1C1917';
const MUTED = '#78716C';
const FAINT = '#A8A29E';
const LINE = '#E7E5E4';
const GREEN = '#3E7A5E';

const INCLUDED = [
  { title: 'Dedicated cloud environment', desc: 'Your own isolated deployment — app, database and knowledge base run separately from any other customer.' },
  { title: 'Your branding', desc: 'Logo, colors, agent name and welcome screen — the chat looks like yours.' },
  { title: 'Agent configured & loaded', desc: 'Persona, conversation flows and the full knowledge base installed and tuned in Hebrew.' },
  { title: 'Your own web address', desc: 'A dedicated link (e.g. yourname.lybi.ai) — share it and users are in. Works on any phone or computer, nothing to install.' },
  { title: 'Admin & test users', desc: 'Password-protected access for your team to try everything before launch.' },
  { title: 'Usage reporting', desc: 'Per-user usage tracking from day one — the numbers behind the per-user pricing.' },
  { title: 'Full QA & go-live', desc: 'We test every flow in Hebrew, then walk your team through the live system.' },
];

const EXCLUDED = [
  'Integration with your internal systems (EMR, CRM, member portal)',
  'Single sign-on (SSO) with your user directory',
  'On-premise or private-network hosting',
  'Data migration from existing systems',
  'Custom security audits & certifications',
  'Native mobile app (App Store / Google Play)',
];

const TIMELINE = [
  { day: 'Day 1', what: 'Dedicated environment set up & deployed' },
  { day: 'Day 2', what: 'Branding + agent configuration' },
  { day: 'Day 3', what: 'Knowledge base loading + Hebrew tuning' },
  { day: 'Day 4', what: 'Admin, test users & usage reporting' },
  { day: 'Day 5', what: 'Final QA, walkthrough & go-live' },
];

export function LybiInstallPage() {
  useEffect(() => {
    document.title = 'Effortless Installation | Lybi';
  }, []);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: '#FAF7F7', color: INK, minHeight: '100vh', overflow: 'auto' }}>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(250,247,247,0.95)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/lybi/knowledge" style={{ display: 'inline-block', textDecoration: 'none' }}>
            <img src="/img/lybi-logo-transparent.png" alt="Lybi" style={{ height: 32, width: 'auto' }} />
          </Link>
          <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: PURPLE, background: 'rgba(104,6,98,0.06)', padding: '4px 10px', borderRadius: 4 }}>
            Installation
          </span>
        </div>
      </nav>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '48px 24px 80px' }}>

        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, fontWeight: 500, margin: '0 0 10px', lineHeight: 1.15 }}>
          Effortless Installation
        </h1>
        <p style={{ fontSize: 16, color: MUTED, margin: '0 0 36px', maxWidth: '58ch', lineHeight: 1.6 }}>
          A standalone deployment of your agent — nothing to install on your side, no integration
          with your systems, no IT project. We set it up, we run it, you get a link.
        </p>

        {/* Headline: the effort */}
        <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '26px 28px', marginBottom: 36, display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' as const }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: FAINT, marginBottom: 6 }}>
              One-time setup
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 44, fontWeight: 500, color: PURPLE, lineHeight: 1 }}>
              5 working days
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 260, fontSize: 14, color: MUTED, lineHeight: 1.6 }}>
            From signed agreement to a live, branded agent your users can open on any device.
            Your team's effort: choose a name, send a logo, try it out.
          </div>
        </div>

        {/* Timeline */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 44, flexWrap: 'wrap' as const }}>
          {TIMELINE.map(t => (
            <div key={t.day} style={{ flex: '1 1 150px', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: PURPLE, marginBottom: 6 }}>{t.day}</div>
              <div style={{ fontSize: 13, color: INK, lineHeight: 1.45 }}>{t.what}</div>
            </div>
          ))}
        </div>

        {/* Included */}
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 500, margin: '0 0 16px' }}>What's included</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12, marginBottom: 44 }}>
          {INCLUDED.map(item => (
            <div key={item.title} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, padding: '14px 18px', display: 'flex', gap: 12 }}>
              <span style={{ color: GREEN, fontWeight: 700, fontSize: 15, lineHeight: 1.5 }}>✓</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{item.title}</div>
                <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Not included */}
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 500, margin: '0 0 6px' }}>Not part of effortless</h2>
        <p style={{ fontSize: 13.5, color: MUTED, margin: '0 0 16px' }}>
          Everything below is possible — as a separately scoped project, priced on its own.
        </p>
        <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, padding: '8px 18px', marginBottom: 44 }}>
          {EXCLUDED.map((item, i) => (
            <div key={item} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i === EXCLUDED.length - 1 ? 'none' : `1px solid ${LINE}`, fontSize: 13.5, color: MUTED }}>
              <span style={{ color: FAINT, fontWeight: 700 }}>—</span>
              {item}
            </div>
          ))}
        </div>

        {/* Fine print */}
        <div style={{ fontSize: 12.5, color: FAINT, lineHeight: 1.7, borderTop: `1px solid ${LINE}`, paddingTop: 18 }}>
          Installation is a one-time fee. Ongoing service — hosting, model usage and support — is
          covered by the per-user subscription. The dedicated cloud environment is managed
          entirely by Lybi.
        </div>
      </div>
    </div>
  );
}
