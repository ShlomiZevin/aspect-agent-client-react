import { useEffect } from 'react';
import { Link } from 'react-router-dom';

// INTERNAL: the ready answer for "how do we support this?".
// On-demand developer by the hour instead of a full-time hire.

const PURPLE = '#680662';
const INK = '#1C1917';
const MUTED = '#78716C';
const FAINT = '#A8A29E';
const LINE = '#E7E5E4';
const GREEN = '#3E7A5E';
const RED = '#A33B3B';

const TERMS = [
  { label: 'Rate', value: '$70 / hour', note: 'A full-time developer runs $6,800/month (≈ $40/h). On-demand hourly always costs more — no idle salary.' },
  { label: 'Minimum', value: '10 hours / month', note: 'Fixed monthly bank. Used less — still 10. Used more — 10 + actual hours.' },
  { label: 'Coverage', value: '12 / 6, Israel time', note: 'e.g. 08:00–20:00, Sunday–Friday. Matches our customers — all Israeli.' },
  { label: 'SLA', value: '2-hour response', note: 'Response within coverage hours, not resolution. Critical issues first.' },
];

const COVERED = [
  'Incidents & outages',
  'Bug fixes',
  'Monitoring & health checks',
  'Technical questions from the customer',
];

const NOT_COVERED = [
  'New features or changes — scoped and priced separately',
  '24/6 coverage (see below)',
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
        <div style={{ background: '#fff', border: `2px solid ${PURPLE}`, borderRadius: 14, padding: '24px 28px', marginBottom: 28 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: PURPLE, marginBottom: 8 }}>
            The answer
          </div>
          <div style={{ fontSize: 19, lineHeight: 1.55 }}>
            A dedicated developer on call, by the hour: <b style={{ color: PURPLE }}>$70/hour,
            minimum bank of 10 hours a month</b>. Coverage <b>12/6 Israel time</b>,
            <b> 2-hour response SLA</b>. No full-time hire needed —
            that's <b style={{ color: PURPLE }}>$700/month minimum</b> instead of $6,800 for a full-timer.
          </div>
        </div>

        {/* Terms */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginBottom: 24 }}>
          {TERMS.map(t => (
            <div key={t.label} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, padding: '14px 18px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: FAINT, marginBottom: 4 }}>{t.label}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: PURPLE, marginBottom: 4 }}>{t.value}</div>
              <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>{t.note}</div>
            </div>
          ))}
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

        {/* 24/6 */}
        <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, padding: '14px 18px', marginBottom: 24 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: FAINT, marginBottom: 6 }}>
            If a customer insists on 24/6
          </div>
          <div style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.6 }}>
            Offer 24/6 with a tiered SLA: <b style={{ color: INK }}>2-hour response during the day,
            up to 10 hours at night</b> — a night issue is handled first thing in the morning.
            Nights are quiet anyway (Israeli customers), and the cloud platform self-heals and is
            monitored automatically. Only if a customer contractually demands a fast night
            response do we add a developer in a second timezone — possible, priced separately.
          </div>
        </div>

        <p style={{ fontSize: 12.5, color: FAINT, lineHeight: 1.7, margin: 0 }}>
          For us: SLA is response time, not resolution — never promise resolution times. Escalation
          beyond the support developer goes to Shlomi. Before selling support, set up basic uptime
          monitoring so we detect problems before the customer does.
        </p>
      </div>
    </div>
  );
}
