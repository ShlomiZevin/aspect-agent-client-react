import { useEffect } from 'react';
import { Link } from 'react-router-dom';

// INTERNAL: the ready answer for "how do we support this?".
// Two options — 12/6 is the one to lead with.

const PURPLE = '#680662';
const INK = '#1C1917';
const MUTED = '#78716C';
const FAINT = '#A8A29E';
const LINE = '#E7E5E4';
const GREEN = '#3E7A5E';
const RED = '#A33B3B';

const COVERED = [
  'Incidents & outages',
  'Bug fixes',
  'Monitoring & health checks',
  'Technical questions from the customer',
];

const NOT_COVERED = [
  'New features or changes — scoped and priced separately',
];

export function LybiSupportPage() {
  useEffect(() => {
    document.title = 'Support — Internal Answer | Lybi';
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
          "How do we support this?"
        </h1>

        {/* THE answer */}
        <div style={{ background: '#fff', border: `2px solid ${PURPLE}`, borderRadius: 14, padding: '24px 28px', marginBottom: 24 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: PURPLE, marginBottom: 8 }}>
            The answer
          </div>
          <div style={{ fontSize: 19, lineHeight: 1.55 }}>
            A dedicated developer on call, by the hour:
            <b style={{ color: PURPLE }}> $80/hour, minimum bank of 10 hours a month ($800)</b>.
            Coverage <b>12/6</b>. SLA: <b>2-hour response</b> to start, reduced to <b>1 hour</b> over time.
          </div>
        </div>

        {/* Two options */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' as const, marginBottom: 24 }}>
          <div style={{ flex: '1 1 300px', background: '#fff', border: `2px solid ${PURPLE}`, borderRadius: 12, padding: '18px 20px' }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#fff', background: PURPLE, padding: '3px 10px', borderRadius: 99 }}>
              12/6 — the offer
            </span>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column' as const, gap: 8, fontSize: 14.5 }}>
              <div><b style={{ color: PURPLE }}>$80 / hour</b></div>
              <div>Minimum bank: <b>10 hours / month ($800)</b></div>
              <div>Above the bank: 10 + actual hours</div>
              <div>Coverage: <b>12 hours × 6 days</b>, Israel time</div>
              <div>SLA: <b>2-hour response</b> to start, reduced to 1 hour over time</div>
            </div>
          </div>
          <div style={{ flex: '1 1 300px', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: '18px 20px' }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: MUTED, background: '#FAF7F7', padding: '3px 10px', borderRadius: 99 }}>
              24/7 — if demanded
            </span>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column' as const, gap: 8, fontSize: 14.5, color: MUTED }}>
              <div><b style={{ color: INK }}>$1,500 / month</b> minimum</div>
              <div>Same bank structure, $80/hour above it</div>
              <div>Coverage: around the clock, every day</div>
              <div>SLA: 2-hour response to start, reduced to 1 hour over time</div>
            </div>
          </div>
        </div>

        {/* Covered / not */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' as const, marginBottom: 24 }}>
          <div style={{ flex: '1 1 300px', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: GREEN, marginBottom: 8 }}>
              Support covers
            </div>
            {COVERED.map(item => (
              <div key={item} style={{ display: 'flex', gap: 10, padding: '4px 0', fontSize: 13.5 }}>
                <span style={{ color: GREEN, fontWeight: 700 }}>✓</span>
                {item}
              </div>
            ))}
          </div>
          <div style={{ flex: '1 1 300px', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: RED, marginBottom: 8 }}>
              Not support
            </div>
            {NOT_COVERED.map(item => (
              <div key={item} style={{ display: 'flex', gap: 10, padding: '4px 0', fontSize: 13.5, color: MUTED }}>
                <span style={{ color: RED, fontWeight: 700 }}>✕</span>
                {item}
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 12.5, color: FAINT, lineHeight: 1.7, margin: 0 }}>
          For us: SLA is response time, not resolution. Escalation beyond the support developer
          goes to Shlomi. Don't sign a 24/7 commitment before confirming with Shlomi that it can
          be staffed.
        </p>
      </div>
    </div>
  );
}
