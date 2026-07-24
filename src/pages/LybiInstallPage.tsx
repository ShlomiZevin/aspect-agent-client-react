import { useEffect } from 'react';
import { Link } from 'react-router-dom';

// INTERNAL: the ready answer for "how much is an installation?".
// One answer, its conditions, nothing more.

const PURPLE = '#680662';
const INK = '#1C1917';
const MUTED = '#78716C';
const FAINT = '#A8A29E';
const LINE = '#E7E5E4';
const GREEN = '#3E7A5E';
const RED = '#A33B3B';

const EFFORTLESS_CONDITIONS = [
  'Standalone app in our cloud — we manage everything',
  'No on-premise / their private cloud',
  'No integration with their systems',
  'No SSO',
  'Access = link + password, nothing to install',
];

const RED_FLAGS = [
  'Their private cloud / on-premise',
  'Integration with any internal system',
  'SSO',
  'Security certifications / custom audit',
  'Data migration',
  'Native mobile app',
];

export function LybiInstallPage() {
  useEffect(() => {
    document.title = 'Installation — Internal Answer | Lybi';
  }, []);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: '#FAF7F7', color: INK, minHeight: '100vh', overflow: 'auto' }}>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(250,247,247,0.95)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/lybi/knowledge" style={{ display: 'inline-block', textDecoration: 'none' }}>
            <img src="/img/lybi-logo-transparent.png" alt="Lybi" style={{ height: 32, width: 'auto' }} />
          </Link>
          <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: PURPLE, background: 'rgba(104,6,98,0.06)', padding: '4px 10px', borderRadius: 4 }}>
            Internal
          </span>
        </div>
      </nav>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>

        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 500, margin: '0 0 28px', lineHeight: 1.15 }}>
          "How much is an installation?"
        </h1>

        {/* THE answer */}
        <div style={{ background: '#fff', border: `2px solid ${PURPLE}`, borderRadius: 14, padding: '24px 28px', marginBottom: 28 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: PURPLE, marginBottom: 8 }}>
            The answer
          </div>
          <div style={{ fontSize: 19, lineHeight: 1.55 }}>
            An effortless installation: <b style={{ color: PURPLE }}>5 working days, one-time fee</b> —
            from signed agreement to a live branded agent. Ongoing hosting, model usage and support
            are covered by the per-user subscription, not the installation.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' as const, marginBottom: 24 }}>
          <div style={{ flex: '1 1 300px', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: GREEN, marginBottom: 8 }}>
              Effortless = all of these
            </div>
            {EFFORTLESS_CONDITIONS.map(item => (
              <div key={item} style={{ display: 'flex', gap: 10, padding: '4px 0', fontSize: 13.5 }}>
                <span style={{ color: GREEN, fontWeight: 700 }}>✓</span>
                {item}
              </div>
            ))}
          </div>
          <div style={{ flex: '1 1 300px', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: RED, marginBottom: 8 }}>
              Customer asks for any of these → don't commit
            </div>
            {RED_FLAGS.map(item => (
              <div key={item} style={{ display: 'flex', gap: 10, padding: '4px 0', fontSize: 13.5, color: MUTED }}>
                <span style={{ color: RED, fontWeight: 700 }}>✕</span>
                {item}
              </div>
            ))}
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 8, fontStyle: 'italic' }}>
              Answer: "possible — scoped and priced separately."
            </div>
          </div>
        </div>

        <p style={{ fontSize: 12.5, color: FAINT, lineHeight: 1.7, margin: 0 }}>
          For us: the hands-on work is much less than 5 days — the rest is comment rounds, QA and
          buffer. Never quote less. Before the first invoice, per-user usage logging needs to be
          improved so usage per user is counted reliably.
        </p>
      </div>
    </div>
  );
}
