import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Lybi technology page — the Adaptive Reasoning Runtime (ARR).
 * Technical, wow-first flows. Each subsystem opens a deep-dive modal.
 * Grounded in Builder V2 (crews → Cortex → a chain of addons), not V1.
 */

const MONO = "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * Every colour is a CSS variable so the light theme is one swap of the token
 * block below rather than a second copy of the page. The JS constants keep
 * their old names, so component code is unchanged.
 */
const BG = 'var(--t-bg)';
const PANEL = 'var(--t-panel)';
const PANEL2 = 'var(--t-panel2)';
const BORDER = 'var(--t-border)';
const TEXT = 'var(--t-text)';
const MUTED = 'var(--t-muted)';
const FAINT = 'var(--t-faint)';
const TEAL = 'var(--t-teal)';
const GREEN = 'var(--t-green)';
const AMBER = 'var(--t-amber)';
const PURPLE = 'var(--t-purple)';
const SURFACE = 'var(--t-surface)';      // header strips, chrome inside panels
const SURFACE2 = 'var(--t-surface2)';    // the demo's own canvas
const HAIRLINE = 'var(--t-hairline)';    // dividers quieter than BORDER
const ARROW = 'var(--t-arrow)';
const ARROW_DIM = 'var(--t-arrow-dim)';
const BAD = 'var(--t-bad)';
const DOT = 'var(--t-dot)';

/** Concrete page background per theme — `body` sits outside the token scope. */
const THEME_BG: Record<'dark' | 'light', string> = { dark: '#0A0D13', light: '#F2F5F8' };

const THEME_CSS = `
.lybiTech{
  --t-bg:#0A0D13; --t-panel:#0F141C; --t-panel2:#0C1017; --t-border:#333E4C;
  --t-text:#C9D1D9; --t-muted:#8B949E; --t-faint:#7C8794;
  --t-teal:#56D4DD; --t-green:#7EE787; --t-amber:#E3B341; --t-purple:#C89BE8;
  --t-surface:#141B25; --t-surface2:#0B0F16; --t-hairline:#1B2430;
  --t-arrow:#9AA4B0; --t-arrow-dim:#68727F; --t-bad:#F2708A; --t-dot:#3A4753;
  --t-navbg:rgba(10,13,19,0.90);
  --t-teal-bd:rgba(86,212,221,0.55);   --t-teal-bg:rgba(86,212,221,0.09);
  --t-green-bd:rgba(126,231,135,0.55); --t-green-bg:rgba(126,231,135,0.09);
  --t-purple-bd:rgba(200,155,232,0.60);--t-purple-bg:rgba(200,155,232,0.11);
  --t-amber-bd:rgba(227,179,65,0.55);  --t-amber-bg:rgba(227,179,65,0.09);
  --t-muted-bd:#3E4956; --t-muted-bg:#141B25;
  --t-band-strong:rgba(227,179,65,0.13); --t-band-weak:rgba(227,179,65,0.05); --t-band-bd:rgba(227,179,65,0.22);
  --t-rail-on:rgba(86,212,221,0.07); --t-rail-hover:rgba(86,212,221,0.05);
  --t-select-bg:rgba(86,212,221,0.30); --t-select-fg:#F2FCFD;
  --t-shadow:0 8px 30px rgba(0,0,0,0.35); --t-glow:inset 0 0 26px rgba(126,231,135,0.06);
}
.lybiTech[data-theme="light"]{
  --t-bg:#F2F5F8; --t-panel:#FFFFFF; --t-panel2:#F6F8FA; --t-border:#C3CEDA;
  --t-text:#111C27; --t-muted:#48576A; --t-faint:#6A788B;
  --t-teal:#00727E; --t-green:#1B7A33; --t-amber:#8A5D00; --t-purple:#6B34A0;
  --t-surface:#EDF1F6; --t-surface2:#F8FAFC; --t-hairline:#E1E7EE;
  --t-arrow:#66748A; --t-arrow-dim:#9AA6B6; --t-bad:#C0334E; --t-dot:#C3CEDA;
  --t-navbg:rgba(242,245,248,0.90);
  --t-teal-bd:rgba(0,114,126,0.40);    --t-teal-bg:rgba(0,114,126,0.07);
  --t-green-bd:rgba(27,122,51,0.40);   --t-green-bg:rgba(27,122,51,0.07);
  --t-purple-bd:rgba(107,52,160,0.40); --t-purple-bg:rgba(107,52,160,0.07);
  --t-amber-bd:rgba(138,93,0,0.40);    --t-amber-bg:rgba(138,93,0,0.08);
  --t-muted-bd:#C3CEDA; --t-muted-bg:#EDF1F6;
  --t-band-strong:rgba(138,93,0,0.13); --t-band-weak:rgba(138,93,0,0.05); --t-band-bd:rgba(138,93,0,0.22);
  --t-rail-on:rgba(0,114,126,0.09); --t-rail-hover:rgba(0,114,126,0.06);
  --t-select-bg:rgba(0,114,126,0.20); --t-select-fg:#03282C;
  --t-shadow:0 6px 22px rgba(17,28,39,0.10); --t-glow:inset 0 0 26px rgba(27,122,51,0.07);
}
.lybiTech ::selection{background:var(--t-select-bg);color:var(--t-select-fg)}
.lybiTech ::-moz-selection{background:var(--t-select-bg);color:var(--t-select-fg)}
.lybiTech section{scroll-margin-top:53px}
.lybiTech nav a:hover{background:var(--t-rail-hover)}
@media(max-width:1080px){.lybiTechRail{display:none!important}}
`;

type Tone = 'teal' | 'green' | 'purple' | 'amber' | 'muted';
const TONES: Record<Tone, { fg: string; bd: string; bg: string }> = {
  teal:   { fg: TEAL,   bd: 'var(--t-teal-bd)',   bg: 'var(--t-teal-bg)' },
  green:  { fg: GREEN,  bd: 'var(--t-green-bd)',  bg: 'var(--t-green-bg)' },
  purple: { fg: PURPLE, bd: 'var(--t-purple-bd)', bg: 'var(--t-purple-bg)' },
  amber:  { fg: AMBER,  bd: 'var(--t-amber-bd)',  bg: 'var(--t-amber-bg)' },
  muted:  { fg: MUTED,  bd: 'var(--t-muted-bd)',  bg: 'var(--t-muted-bg)' },
};

function Node({ label, sub, tone = 'muted', dim }: { label: string; sub?: string; tone?: Tone; dim?: boolean }) {
  const t = TONES[tone];
  return (
    <div style={{ background: t.bg, border: `1px solid ${t.bd}`, borderRadius: 10, padding: '9px 13px', textAlign: 'center', opacity: dim ? 0.85 : 1 }}>
      <div style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: t.fg, whiteSpace: 'nowrap' }}>{label}</div>
      {sub && <div style={{ fontFamily: SANS, fontSize: 11, color: MUTED, marginTop: 3, whiteSpace: 'nowrap' }}>{sub}</div>}
    </div>
  );
}
function Arrow({ dim }: { dim?: boolean }) {
  return <span style={{ color: dim ? ARROW_DIM : ARROW, fontSize: 18, fontWeight: 700, flexShrink: 0, margin: '0 1px' }}>→</span>;
}
function Chip({ children, tone = 'teal' }: { children: React.ReactNode; tone?: Tone }) {
  const t = TONES[tone];
  return <span style={{ fontFamily: MONO, fontSize: 11.5, color: t.fg, background: t.bg, border: `1px solid ${t.bd}`, borderRadius: 999, padding: '4px 10px' }}>{children}</span>;
}
/** Height of the sticky top bar — section headers pin directly beneath it. */
const NAV_H = 53;

/**
 * Head — a section START, not just a heading, and it PINS.
 *
 * The number + title row is sticky inside its own <section>, so while you read
 * a section its title stays at the top of the column, and the next section's
 * title pushes it out on the way in. That, plus the boxed number and the size
 * jump, is what makes the boundaries legible on a page this long. The subtitle
 * sits outside the sticky bar so the pinned strip stays thin.
 */
function Head({ n, title, sub }: { n: string; title: string; sub?: string }) {
  return (
    // A FRAGMENT on purpose: a sticky element can only travel inside its
    // parent's box, so the bar must be a direct child of <section>. Wrapping
    // it in a div would pin it for the height of that div and no further.
    <>
      <div style={{
        position: 'sticky', top: NAV_H, zIndex: 20, background: BG,
        borderBottom: `1px solid ${BORDER}`, padding: '14px 0 12px',
        marginBottom: sub ? 14 : 24,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <span style={{
          flexShrink: 0, fontFamily: MONO, fontSize: 14, fontWeight: 700, color: TEAL,
          background: TONES.teal.bg, border: `1px solid ${TONES.teal.bd}`, borderRadius: 8,
          padding: '5px 10px', lineHeight: 1.1,
        }}>{n}</span>
        <h2 style={{ fontFamily: MONO, fontSize: 21, fontWeight: 700, color: TEXT, margin: 0, letterSpacing: '-0.015em', lineHeight: 1.3, minWidth: 0 }}>{title}</h2>
      </div>
      {sub && <div style={{ fontFamily: SANS, fontSize: 13.5, lineHeight: 1.6, color: FAINT, marginBottom: 24 }}>{sub}</div>}
    </>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: SANS, fontSize: 14.5, lineHeight: 1.8, color: MUTED, margin: '0 0 14px', maxWidth: 760 }}>{children}</p>;
}
const strong = { color: TEXT, fontWeight: 600 } as const;
const em = { color: TEXT, fontStyle: 'normal' } as const;

/**
 * Deeper — the second tier, inline. The page used to hide this behind a
 * "details ↗" modal, which meant the strongest technical material was the
 * least-read material. It now sits under each section, visually set back so a
 * skimmer can drop out of it and a technical reader can keep going.
 */
function Deeper({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 26, borderInlineStart: `2px solid ${BORDER}`, paddingInlineStart: 20 }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: FAINT, marginBottom: 4 }}>
        one level deeper
      </div>
      {children}
    </div>
  );
}
function DSec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: TEAL, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function FlowRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: PANEL2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 16px' }}>{children}</div>;
}
/**
 * RagSagFlows — RAG vs SAG as ONE aligned comparison, so the two paths line
 * up column-for-column and the single thing that actually differs — the
 * trigger — is impossible to miss. Everything downstream of the trigger is
 * deliberately shown as identical, because it is.
 * Shared by the §04 section and the SAG deep-dive modal.
 */
function RagSagFlows() {
  const rows: { tag: string; tone: Tone; trigger: string; fetch: string; verdict: string; win: boolean }[] = [
    { tag: 'RAG', tone: 'muted', trigger: 'the words you typed', fetch: 'search the library', verdict: 'Never mentioned it? Nothing surfaces.', win: false },
    { tag: 'SAG', tone: 'green', trigger: 'the state we infer', fetch: 'fetch that exact module', verdict: 'Fires on the state — before you ask, and even if you never do.', win: true },
  ];
  const lbl = { fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: FAINT };

  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px 20px 18px', overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '58px minmax(150px, 1.15fr) 20px minmax(140px, 1fr) 20px minmax(110px, 0.85fr)', alignItems: 'center', rowGap: 10, columnGap: 6, minWidth: 560 }}>
        {/* header */}
        <span />
        <span style={{ ...lbl, color: AMBER, fontWeight: 700 }}>the trigger — the only difference</span>
        <span />
        <span style={lbl}>what it fetches</span>
        <span />
        <span style={lbl}>result</span>

        {rows.map(r => {
          const t = TONES[r.tone];
          return (
            <div key={r.tag} style={{ display: 'contents' }}>
              <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 700, color: t.fg }}>{r.tag}</span>
              <div style={{ background: r.win ? 'var(--t-band-strong)' : 'var(--t-band-weak)', border: `1px solid ${r.win ? TONES.amber.bd : 'var(--t-band-bd)'}`, borderRadius: 9, padding: '10px 13px', fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: r.win ? AMBER : MUTED }}>
                {r.trigger}
              </div>
              <span style={{ textAlign: 'center', color: r.win ? ARROW : ARROW_DIM, fontSize: 16, fontWeight: 700 }}>→</span>
              <div style={{ background: t.bg, border: `1px solid ${t.bd}`, borderRadius: 9, padding: '10px 13px', fontFamily: MONO, fontSize: 12.5, color: t.fg }}>
                {r.fetch}
              </div>
              <span style={{ textAlign: 'center', color: r.win ? ARROW : ARROW_DIM, fontSize: 16, fontWeight: 700 }}>→</span>
              <div style={{ background: PANEL2, border: `1px solid ${BORDER}`, borderRadius: 9, padding: '10px 13px', fontFamily: MONO, fontSize: 12.5, color: MUTED }}>
                into the prompt
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${HAIRLINE}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(r => (
          <div key={r.tag} style={{ display: 'flex', gap: 9, alignItems: 'baseline' }}>
            <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: TONES[r.tone].fg, minWidth: 34, flexShrink: 0 }}>{r.tag}</span>
            <span style={{ fontFamily: SANS, fontSize: 12.5, lineHeight: 1.55, color: r.win ? MUTED : FAINT }}>{r.verdict}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** RagSagMatrix — the point-by-point table. Lives in the SAG deep-dive. */
function RagSagMatrix() {
  const ROWS: [string, string, string][] = [
    ['Triggered by', 'the words the user typed', 'the state the chain inferred'],
    ['Behaviour', 'reactive — answers what was asked', 'anticipatory — brings what’s needed'],
    ['If they never mention it', 'nothing surfaces', 'the right module still fires'],
    ['Selection', 'nearest-neighbour, scored', 'exact, or a signal-scoped search'],
    ['Best at', 'question and answer', 'leading a real, deep flow'],
  ];
  return (
    <div style={{ background: PANEL2, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
        {[['', 'RAG · everyone', 'SAG · Lybi'] as [string, string, string], ...ROWS].map(([a, b, c], r) =>
          [a, b, c].map((cell, ci) => (
            <div key={`${r}-${ci}`} style={{
              padding: '10px 13px',
              borderTop: r === 0 ? 'none' : `1px solid ${HAIRLINE}`,
              background: r === 0 ? SURFACE : ci === 2 ? TONES.green.bg : 'transparent',
              fontFamily: r === 0 || ci === 0 ? MONO : SANS,
              fontSize: r === 0 ? 11 : ci === 0 ? 11.5 : 12.5,
              lineHeight: 1.5,
              fontWeight: r === 0 || ci === 0 ? 600 : 400,
              letterSpacing: r === 0 ? '0.05em' : undefined,
              textTransform: r === 0 ? 'uppercase' : undefined,
              color: r === 0 ? (ci === 2 ? GREEN : FAINT) : ci === 0 ? MUTED : ci === 2 ? TEXT : FAINT,
            }}>{cell}</div>
          )),
        )}
      </div>
    </div>
  );
}

/**
 * SagDemo — the centrepiece proof for §04. Cycles through chat messages;
 * each one lights up different signals, which switch on different knowledge
 * rows and inject different KB modules. Lives on the page itself, not behind
 * a modal — this is the clearest demonstration of what SAG does.
 */
const SAG_TURN_MS = 5600;
function SagDemo() {
  const TURNS: { msg: string; domain: 'banking' | 'menopause'; sig: string[]; tier: { label: string; tone: Tone }; note: string }[] = [
    // The one case RAG could also handle — a direct question.
    { msg: 'What’s the interest rate on my savings account?', domain: 'banking', sig: ['topic = savings-rate'], tier: { label: 'both · RAG can catch this', tone: 'muted' }, note: 'A direct question — a keyword search would find it too.' },
    // Only our signals — the user names nothing the KB could match.
    { msg: 'Honestly I’ve just been foggy and short-tempered lately.', domain: 'menopause', sig: ['stage = peri', 'concern = mood'], tier: { label: 'only our signals', tone: 'green' }, note: 'She never said “menopause” — nothing for RAG to match. Our signals read the stage and inject it.' },
    { msg: 'Money’s been really tight since the baby arrived.', domain: 'banking', sig: ['life-event = new-child', 'cashflow = strained'], tier: { label: 'only our signals', tone: 'green' }, note: 'She never asked about a product — we spot the strain and surface the right help.' },
    { msg: 'I’ve gained weight round my middle no matter what I do.', domain: 'menopause', sig: ['stage = peri', 'concern = weight'], tier: { label: 'only our signals', tone: 'green' }, note: 'She’s talking about weight — we read the stage underneath and bring the right guidance.' },
    { msg: 'I keep getting texts about a payment I don’t recognise.', domain: 'banking', sig: ['fraud-risk = high'], tier: { label: 'only our signals', tone: 'green' }, note: 'She didn’t ask how to report fraud — we detect it and bring the exact steps.' },
  ];
  const ROWS = [
    { s: 'stage = peri', m: 'kb.peri' },
    { s: 'concern = mood', m: 'kb.mood' },
    { s: 'concern = weight', m: 'kb.weight' },
    { s: 'topic = savings-rate', m: 'kb.savings' },
    { s: 'life-event = new-child', m: 'kb.family' },
    { s: 'cashflow = strained', m: 'kb.overdraft' },
    { s: 'fraud-risk = high', m: 'kb.fraud' },
  ];
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setI(v => (v + 1) % TURNS.length), SAG_TURN_MS);
    return () => clearInterval(id);
  }, [playing, TURNS.length]);
  const step = (d: number) => { setPlaying(false); setI(v => (v + d + TURNS.length) % TURNS.length); };
  const jump = (idx: number) => { setPlaying(false); setI(idx); };
  const turn = TURNS[i];
  const on = (s: string) => turn.sig.includes(s);
  const active = ROWS.filter(r => on(r.s)).length;
  const tt = TONES[turn.tier.tone];
  const ctlBtn = { fontFamily: MONO, fontSize: 12, color: MUTED, background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '3px 9px', cursor: 'pointer', lineHeight: 1 } as const;

  return (
    <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--t-shadow)' }}>
      <style>{`@keyframes sagIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}@keyframes sagBar{from{transform:scaleX(0)}to{transform:scaleX(1)}}`}</style>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 14px', borderBottom: `1px solid ${BORDER}`, background: SURFACE, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT }}>incoming message · {i + 1}/{TURNS.length}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, marginInlineEnd: 4 }}>
            {TURNS.map((_, idx) => (
              <button key={idx} onClick={() => jump(idx)} aria-label={`Go to message ${idx + 1}`} style={{ width: 8, height: 8, borderRadius: '50%', padding: 0, cursor: 'pointer', border: 'none', background: idx === i ? TEAL : DOT }} />
            ))}
          </div>
          <button onClick={() => step(-1)} style={ctlBtn} title="Previous message" aria-label="Previous">◀</button>
          <button onClick={() => setPlaying(p => !p)} style={{ ...ctlBtn, color: playing ? MUTED : TEAL }} title={playing ? 'Pause' : 'Play'}>{playing ? '⏸ pause' : '▶ play'}</button>
          <button onClick={() => step(1)} style={ctlBtn} title="Next message" aria-label="Next">▶</button>
        </div>
      </div>

      {/* Autoplay progress — so the advance never feels like a random jump */}
      <div style={{ height: 2, background: HAIRLINE }}>
        <div key={`bar${i}${playing}`} style={{
          height: '100%', background: TEAL, transformOrigin: 'left center',
          animation: playing ? `sagBar ${SAG_TURN_MS}ms linear` : 'none',
          transform: playing ? undefined : 'scaleX(0)',
        }} />
      </div>

      {/* Message + case tag + detected signals + note */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}`, background: SURFACE }}>
        <div key={`t${i}`} style={{ animation: 'sagIn 0.4s ease', display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, color: MUTED, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 5, padding: '3px 8px' }}>{turn.domain === 'banking' ? '🏦 banking' : '🌸 menopause'}</span>
          <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: tt.fg, background: tt.bg, border: `1px solid ${tt.bd}`, borderRadius: 5, padding: '3px 8px' }}>{turn.tier.label}</span>
        </div>
        <div key={`m${i}`} style={{ animation: 'sagIn 0.45s ease' }}>
          <span style={{ fontFamily: SANS, fontSize: 13.5, lineHeight: 1.5, color: TEXT, background: TONES.teal.bg, border: `1px solid ${TONES.teal.bd}`, borderRadius: '4px 12px 12px 12px', padding: '8px 12px', display: 'inline-block', maxWidth: '100%' }}>{turn.msg}</span>
        </div>
        <div key={`s${i}`} style={{ animation: 'sagIn 0.55s ease', display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: FAINT }}>signals detected →</span>
          {turn.sig.map(s => (
            <span key={s} style={{ fontFamily: MONO, fontSize: 11.5, color: TEAL, background: TONES.teal.bg, border: `1px solid ${TONES.teal.bd}`, borderRadius: 999, padding: '4px 10px' }}>{s}</span>
          ))}
        </div>
        <div key={`n${i}`} style={{ animation: 'sagIn 0.6s ease', marginTop: 10, fontFamily: MONO, fontSize: 11.5, lineHeight: 1.55, color: AMBER }}>⚡ {turn.note}</div>
      </div>

      {/* Knowledge table header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED }}>domain knowledge · one module per state</span>
        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: GREEN }}>{active} of {ROWS.length} switched on</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, padding: '6px 14px', borderBottom: `1px solid ${BORDER}`, background: SURFACE2 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: FAINT }}>when this state holds</span>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: FAINT }}>this module</span>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: FAINT }}>state</span>
      </div>

      {/* Rows — animate on/off as the message changes */}
      {ROWS.map((r, idx) => {
        const a = on(r.s);
        return (
          <div key={r.s} style={{
            display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center',
            padding: '11px 14px', borderTop: idx === 0 ? 'none' : `1px solid ${HAIRLINE}`,
            borderLeft: `3px solid ${a ? GREEN : 'transparent'}`,
            background: a ? TONES.green.bg : 'transparent',
            boxShadow: a ? 'var(--t-glow)' : 'none',
            transition: 'background 0.45s ease, border-left-color 0.45s ease, box-shadow 0.45s ease',
          }}>
            <span style={{ fontFamily: MONO, fontSize: 13, color: a ? TEXT : MUTED, transition: 'color 0.45s ease' }}>{r.s}</span>
            <span style={{ fontFamily: MONO, fontSize: 12.5, color: a ? TEAL : FAINT, transition: 'color 0.45s ease' }}>{r.m}</span>
            <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', color: a ? GREEN : FAINT, transition: 'color 0.45s ease' }}>{a ? '● injected' : 'off'}</span>
          </div>
        );
      })}

      <div style={{ padding: '10px 14px', borderTop: `1px solid ${BORDER}`, background: SURFACE, fontFamily: MONO, fontSize: 11, lineHeight: 1.6, color: MUTED }}>
        <span style={{ color: GREEN }}>▸</span> only the lit rows reach this turn’s prompt — the rest of the library stays out
      </div>
    </div>
  );
}

function DeepChain() {
  return (
    <Deeper>
        <DSec title="Three lanes">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[['blocking', 'runs in order; the reply waits for it', 'purple'], ['background', 'runs every message, never holds up the reply', 'teal'], ['offline', 'fires on a trigger after the reply — summaries, profiling', 'amber']].map(([l, d, t]) => (
              <div key={l} style={{ display: 'flex', gap: 12, alignItems: 'baseline', background: PANEL2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px' }}>
                <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: TONES[t as Tone].fg, minWidth: 90 }}>{l}</span>
                <span style={{ fontFamily: SANS, fontSize: 13, lineHeight: 1.5, color: MUTED }}>{d}</span>
              </div>
            ))}
          </div>
          <p style={{ fontFamily: SANS, fontSize: 12.5, lineHeight: 1.7, color: FAINT, margin: '10px 0 0' }}>
            The lane is chosen per step, per crew — the same kind of step can block in one stage and run in the background in
            another.
          </p>
        </DSec>
        <DSec title="The step kinds shipping today">
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {['Field Extractor', 'Vibe Extractor', 'Field Reasoner', 'Field Interviewer', 'KB Retriever', 'Thinker', 'Talker', 'Rules', 'Summarizer', 'Transition Router'].map(s => <Chip key={s} tone="purple">{s}</Chip>)}
          </div>
          <p style={{ fontFamily: SANS, fontSize: 12.5, lineHeight: 1.7, color: FAINT, margin: '10px 0 0' }}>
            Not a fixed set — a step kind is a plugin, so the catalogue grows. <strong style={{ ...strong, color: MUTED }}>Rules</strong>{' '}
            is worth calling out: deterministic if/then, no model involved, for the parts of a flow that must never be left to
            a probability.
          </p>
        </DSec>
        <DSec title="Depth follows the domain">
          <FlowRow>
            <Node label="FAQ" tone="muted" sub="2 steps" /><Arrow />
            <Node label="onboarding" tone="teal" sub="a few" /><Arrow />
            <Node label="clinical / financial" tone="purple" sub="many steps" />
          </FlowRow>
          <p style={{ fontFamily: SANS, fontSize: 12.5, lineHeight: 1.7, color: FAINT, margin: '10px 0 0' }}>Stacking many narrow, specialized steps is what produces depth a single prompt can’t reach — and it is all authoring, not code.</p>
        </DSec>
    </Deeper>
  );
}

function DeepSignals() {
  return (
    <Deeper>
        <DSec title="Where they’re stored, and what it costs">
          <P>Signals are held as <strong style={strong}>fields, grouped by domain</strong>, in memory shared by every step.
            Extraction runs <em style={em}>alongside</em> the reply rather than in front of it, so reading meaning costs the
            user nothing in latency — and each extractor is an addon with its own model, prompt and history window.</P>
        </DSec>
        <DSec title="Four ways a signal gets filled">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[['Field Extractor', 'the facts — age, intent class, product, employment', 'teal'], ['Vibe Extractor', 'the read — tone, mood, energy, what they are feeling but not saying', 'purple'], ['Field Reasoner', 'one field worth its own thinking, inferred from many signals at once', 'green'], ['Field Interviewer', 'owns one signal and drives for it — picks the next question and captures the answer in one step', 'amber']].map(([l, d, t]) => (
              <div key={l} style={{ display: 'flex', gap: 12, alignItems: 'baseline', background: PANEL2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: TONES[t as Tone].fg, minWidth: 118 }}>{l}</span>
                <span style={{ fontFamily: SANS, fontSize: 13, lineHeight: 1.5, color: MUTED, flex: 1 }}>{d}</span>
              </div>
            ))}
          </div>
        </DSec>
        <DSec title="Example">
          <div style={{ background: PANEL2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 16px', fontFamily: MONO, fontSize: 12.5, lineHeight: 1.8 }}>
            <div style={{ color: MUTED }}>“I keep waking at 3am and I’m on edge lately.”</div>
            <div style={{ color: FAINT, margin: '8px 0 4px' }}>── inferred ──</div>
            <div><span style={{ color: TEAL }}>stage</span>=<span style={{ color: GREEN }}>peri</span>{'   '}<span style={{ color: TEAL }}>symptom</span>=<span style={{ color: GREEN }}>sleep</span>{'   '}<span style={{ color: TEAL }}>sentiment</span>=<span style={{ color: GREEN }}>anxious</span></div>
          </div>
        </DSec>
        <DSec title="What signals drive">
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <Chip tone="green">gate knowledge · SAG</Chip><Chip tone="purple">shape reasoning</Chip><Chip tone="amber">drive transitions</Chip><Chip tone="teal">fill prompt tokens</Chip>
          </div>
        </DSec>
    </Deeper>
  );
}

function DeepSag() {
  return (
    <Deeper>
        <DSec title="Point by point">
          <RagSagMatrix />
        </DSec>

        <DSec title="How a module gets addressed">
          <FlowRow>
            <Node label="signal value" tone="teal" /><Arrow />
            <Node label="its branch" tone="green" sub="authored, addressable" /><Arrow />
            <Node label="rendered verbatim" tone="amber" />
          </FlowRow>
          <p style={{ fontFamily: SANS, fontSize: 12.5, lineHeight: 1.7, color: FAINT, margin: '10px 0 0' }}>
            Targeted KB is an authored tree — type → value → sections. A field’s value selects its branch, and the section is
            substituted into the prompt through a token. Same state in, same knowledge out, every time: that determinism is
            what makes it auditable — you can point at a state and read exactly what the agent will be told.
          </p>
        </DSec>

        <DSec title="Why RAG structurally can’t do this">
          <P>A vector index is queried with the user’s text. If the person never produces text near the topic, the
            nearest-neighbour search has nothing to move toward — that isn’t a tuning problem, it’s the retrieval contract.
            SAG changes where the query comes from: the <strong style={strong}>state</strong>, which exists whether or not it
            was ever spoken aloud.</P>
        </DSec>

        <DSec title="What that buys">
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <Chip tone="green">expert depth without being asked</Chip>
            <Chip tone="teal">lean prompt at expert coverage</Chip>
            <Chip tone="amber">auditable — state in, knowledge out</Chip>
          </div>
        </DSec>

    </Deeper>
  );
}

function DeepLcs() {
  return (
    <Deeper>
        <DSec title="Token grammar — resolved live, per step">
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {['{{persona}}', '{{field:NAME}}', '{{memory:DOMAIN}}', '{{dc:FIELD:SECTION}}', '{{kb:NAME}}', '{{thinking:DOMAIN}}', '{{summary:NAME}}'].map(t => <Chip key={t} tone="teal">{t}</Chip>)}
          </div>
          <p style={{ fontFamily: SANS, fontSize: 12.5, lineHeight: 1.7, color: FAINT, margin: '10px 0 0' }}>
            Authors write prompts with these tokens; the runtime resolves each one against live state at assembly time. A
            token that resolves to nothing collapses to nothing — the prompt shrinks when the state is empty rather than
            carrying dead scaffolding.
          </p>
        </DSec>
        <DSec title="Why this isn’t just templating">
          <P>The obvious objection is that every tool fills variables into a prompt. But templating fills slots in a{' '}
            <em style={em}>fixed</em> prompt — the shape is decided in advance and only the values move. Here,{' '}
            <strong style={strong}>which sections and which knowledge exist at all</strong> changes turn to turn: a state
            that isn’t present contributes no section, no instruction and no tokens, so two turns of the same conversation
            can be given structurally different prompts.</P>
        </DSec>
    </Deeper>
  );
}

/** What the "you are here" chip shows before the first section is reached. */
const INTRO = { id: 'intro', n: '00', label: 'Overview' };

/** The page's sections, in order — drives the rail, the anchors and the chip. */
const SECTIONS: { id: string; n: string; label: string }[] = [
  { id: 'shift',   n: '01', label: 'Two ways to work' },
  { id: 'cortex',  n: '02', label: 'Cortex' },
  { id: 'signals', n: '03', label: 'Signals' },
  { id: 'sag',     n: '04', label: 'SAG' },
  { id: 'lcs',     n: '05', label: 'Live context' },
  { id: 'buys',    n: '06', label: 'What it buys' },
  { id: 'stack',   n: '07', label: 'Stack' },
];

/**
 * SideRail — sticky section nav with scroll-spy. Replaces the old
 * "details ↗" modals: with every level of depth now inline, the page is long,
 * so it needs a way to see the shape and jump around.
 */
function SideRail({ active }: { active: string }) {
  return (
    <nav aria-label="Sections" style={{ position: 'sticky', top: 80, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {SECTIONS.map(s => {
        const on = s.id === active;
        return (
          <a key={s.id} href={`#${s.id}`}
            style={{
              display: 'flex', alignItems: 'baseline', gap: 9, textDecoration: 'none',
              padding: '6px 10px', borderRadius: 7,
              borderInlineStart: `2px solid ${on ? TEAL : 'transparent'}`,
              background: on ? 'var(--t-rail-on)' : 'transparent',
              transition: 'color 0.2s, background 0.2s, border-color 0.2s',
            }}>
            <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, color: on ? TEAL : FAINT }}>{s.n}</span>
            <span style={{ fontFamily: MONO, fontSize: 12, color: on ? TEXT : FAINT }}>{s.label}</span>
          </a>
        );
      })}
    </nav>
  );
}

type Theme = 'dark' | 'light';
const THEME_KEY = 'lybi-tech-theme';

export function LybiTechnologyPage() {
  const [active, setActive] = useState(INTRO.id);
  const [progress, setProgress] = useState(0);
  const [theme, setTheme] = useState<Theme>(() => {
    try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
  });
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'Runtime · Technology | Lybi';
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    const prev = document.body.style.background;
    return () => { document.documentElement.style.overflow = ''; document.body.style.overflow = ''; document.body.style.background = prev; };
  }, []);

  // `body` sits outside the token scope, so it needs the concrete colour —
  // otherwise the overscroll area flashes the old theme.
  useEffect(() => {
    document.body.style.background = THEME_BG[theme];
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* private mode */ }
  }, [theme]);

  // Scroll-spy for the rail. Two things to know here:
  //  1. This page's own wrapper is the scrolling element, not the window — the
  //     wrapper carries `overflow: auto` inside a full-height #root, so a
  //     window-only listener never fires. We bind to both.
  //  2. A plain "last section whose top is above the reading line" beats
  //     IntersectionObserver: these sections are far taller than the viewport,
  //     so several are always intersecting at once.
  useEffect(() => {
    let frame = 0;
    const pick = () => {
      frame = 0;
      const line = 140;
      let current = INTRO.id;
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= line) current = s.id;
      }
      setActive(a => (a === current ? a : current));

      const sc = scrollerRef.current;
      const box = sc && sc.scrollHeight > sc.clientHeight ? sc : document.documentElement;
      const max = box.scrollHeight - box.clientHeight;
      const pct = max > 0 ? Math.min(100, Math.max(0, (box.scrollTop / max) * 100)) : 0;
      setProgress(p => (Math.abs(p - pct) < 0.5 ? p : pct));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(pick); };
    pick();
    const scroller = scrollerRef.current;
    scroller?.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      scroller?.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const here = SECTIONS.find(s => s.id === active) ?? INTRO;

  return (
    <div ref={scrollerRef} className="lybiTech" data-theme={theme} style={{ fontFamily: SANS, background: BG, color: TEXT, minHeight: '100vh', overflow: 'auto' }}>
      <style>{THEME_CSS}</style>
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--t-navbg)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '11px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to="/lybi/knowledge" style={{ fontFamily: MONO, fontSize: 13, color: MUTED, textDecoration: 'none', flexShrink: 0 }}>
            <span style={{ color: TEAL }}>~/</span>lybi<span style={{ color: FAINT }}> · knowledge</span>
          </Link>

          {/* You-are-here. The left rail hides on narrow screens, so this is
              the one indicator that is always on screen. */}
          <span style={{ color: FAINT, fontFamily: MONO, fontSize: 13, flexShrink: 0 }}>/</span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: TEAL, flexShrink: 0 }}>{here.n}</span>
            <span style={{ fontFamily: MONO, fontSize: 13, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{here.label}</span>
          </span>

          <span style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button
              onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
              title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              style={{ fontFamily: MONO, fontSize: 11, color: MUTED, background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', lineHeight: 1.6 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = TEAL; (e.currentTarget as HTMLElement).style.color = TEAL; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; (e.currentTarget as HTMLElement).style.color = MUTED; }}>
              {theme === 'dark' ? '☀ light' : '☾ dark'}
            </button>
            <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: TEAL, border: `1px solid ${BORDER}`, padding: '4px 10px', borderRadius: 4 }}>Runtime</span>
          </span>
        </div>

        {/* Reading progress — a second, ambient answer to "where am I". */}
        <div style={{ height: 2, background: HAIRLINE }}>
          <div style={{ height: '100%', width: `${progress}%`, background: TEAL, transition: 'width 0.12s linear' }} />
        </div>
      </nav>

      {/* The rail column must STRETCH (no align-items:flex-start) — a sticky
          child can only travel inside its parent's box, so a collapsed column
          would let the rail scroll away with the hero. */}
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '56px 24px 100px', display: 'flex', gap: 40 }}>
        <div className="lybiTechRail" style={{ width: 168, flexShrink: 0 }}><SideRail active={active} /></div>
        <div style={{ flex: '1 1 auto', minWidth: 0, maxWidth: 920 }}>
        <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: TEAL, marginBottom: 14 }}>
          Lybi · the runtime behind our agents
        </div>
        <h1 style={{ fontFamily: MONO, fontSize: 34, fontWeight: 700, lineHeight: 1.2, color: TEXT, margin: '0 0 18px', letterSpacing: '-0.01em' }}>
          Adaptive Reasoning Runtime
        </h1>
        <p style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.85, color: MUTED, margin: '0 0 14px', maxWidth: 780 }}>
          An LLM is <strong style={strong}>autocomplete</strong> — brilliant at the next word, blind to the whole
          conversation. Every agent platform papers over that by boxing the model into a fixed flowchart, and inherits the
          flowchart's ceiling along with it.
        </p>
        <p style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.85, color: MUTED, margin: 0, maxWidth: 780 }}>
          We do the opposite. On every turn Lybi runs a <strong style={strong}>chain of specialized reasoning steps</strong> —
          as deep as the domain needs — and rebuilds the agent's entire context from what it{' '}
          <strong style={strong}>infers about the person in front of it</strong>. That is what makes autocomplete{' '}
          <strong style={strong}>reason, react, and adjust</strong> instead of just answer.
        </p>

        {/* the spine — one turn, end to end. The map for everything below. */}
        <div style={{ marginTop: 30, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT, marginBottom: 14 }}>
            one turn, end to end
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Node label="message" tone="muted" />
            <Arrow />
            <div style={{ flex: '1 1 340px', minWidth: 300, border: `1px solid ${TONES.purple.bd}`, background: TONES.purple.bg, borderRadius: 12, padding: '10px 14px 13px' }}>
              <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: PURPLE, marginBottom: 10 }}>
                02 · Cortex <span style={{ color: FAINT, fontWeight: 400 }}>— the chain that runs the turn</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Node label="signals" tone="teal" sub="03 · what it infers" /><Arrow />
                <Node label="active KB" tone="green" sub="04 · SAG" /><Arrow />
                <Node label="live context" tone="amber" sub="05 · composed" />
              </div>
            </div>
            <Arrow />
            <Node label="reply" tone="muted" />
          </div>
          <p style={{ fontFamily: SANS, fontSize: 12.5, lineHeight: 1.7, color: FAINT, margin: '14px 0 0' }}>
            Four subsystems on one spine, and each section below is one of them. The{' '}
            <strong style={{ ...strong, color: MUTED }}>Cortex</strong> is the chain; signals are what it infers and goes after, the active
            KB is what those signals switch on, and live context is how all of it becomes the prompt the model actually sees.
          </p>
        </div>

        {/* 01 · The shift */}
        <section id="shift" style={{ marginTop: 44, paddingBottom: 78 }}>
          <Head n="01" title="Two ways to put an LLM to work" sub="Almost everyone picked the first one." />
          <P>
            The industry took a genuinely new technology and used it to rebuild the old one: a scripted, stateful chatbot
            with no room to think. The path is drawn in advance, so the agent can only go where somebody already drew a line.
          </P>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px 20px 22px' }}>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT, marginBottom: 16 }}>Everyone else · static graph</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Node label="node" dim /><Arrow dim /><Node label="node" dim /><Arrow dim /><Node label="node" dim />
              </div>
              <p style={{ fontFamily: SANS, fontSize: 12.5, lineHeight: 1.65, color: FAINT, margin: '16px 0 0' }}>
                Each node is one small, fixed step, so the model never holds the whole picture. Depth, freedom and real
                reactivity all have to be drawn by hand — and the conversation is finite by construction.
              </p>
            </div>
            <div style={{ background: TONES.purple.bg, border: `1px solid ${TONES.purple.bd}`, borderRadius: 14, padding: '20px 20px 22px' }}>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: PURPLE, marginBottom: 16 }}>Lybi · live reasoning chain</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Node label="signals" tone="teal" /><Arrow />
                <Node label="reason" tone="purple" /><Arrow />
                <Node label="activate KB" tone="green" /><Arrow />
                <Node label="…" tone="purple" sub="as deep as needed" /><Arrow />
                <Node label="reply" tone="amber" />
              </div>
              <p style={{ fontFamily: SANS, fontSize: 12.5, lineHeight: 1.65, color: MUTED, margin: '16px 0 0' }}>
                Nothing about the path is drawn in advance. The chain is{' '}
                <strong style={strong}>rebuilt every turn</strong> from what the system infers, so the agent holds the whole
                picture and the flow emerges per person.
              </p>
            </div>
          </div>
        </section>

        {/* 02 · The chain */}
        <section id="cortex" style={{ paddingBottom: 78 }}>
          <Head n="02" title="Cortex — a reasoning chain, not a prompt" sub="One turn runs many specialized steps. The domain decides how many." />
          <P>
            A conversation stage is a <strong style={strong}>crew</strong>, and every crew runs a{' '}
            <strong style={strong}>Cortex</strong>: an ordered chain of steps. A step is self-contained — its own model, its
            own prompt, its own slice of history and memory. One infers a signal, another pulls knowledge, another
            strategises, another speaks.
          </P>
          <P>
            None of it is hardcoded. The whole chain is authored in <strong style={strong}>Builder V2</strong> — steps,
            models, prompts, fields, knowledge, transitions — so a quick FAQ and a deep clinical flow are the{' '}
            <em style={em}>same runtime</em> with different chains. Stacking narrow, specialized steps is what reaches a depth
            no single prompt gets to.
          </P>
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '26px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Node label="infer signal" tone="teal" /><Arrow />
              <Node label="reason" tone="purple" /><Arrow />
              <Node label="pull knowledge" tone="green" /><Arrow />
              <Node label="plan" tone="purple" /><Arrow />
              <Node label="⋯" tone="muted" sub="more per domain" /><Arrow />
              <Node label="respond" tone="amber" />
            </div>
            <div style={{ marginTop: 20, paddingTop: 18, borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[['a model per step', 'the right model for each job'], ['authored, not hardcoded', 'every step configured in Builder V2'], ['depth follows the domain', 'two steps, or twenty']].map(([a, b]) => (
                <div key={a} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: MONO, fontSize: 12.5, color: TEXT, fontWeight: 600 }}>{a}</div>
                  <div style={{ fontFamily: SANS, fontSize: 11.5, color: FAINT, marginTop: 3 }}>{b}</div>
                </div>
              ))}
            </div>
          </div>
          <DeepChain />
        </section>

        {/* 03 · Signals */}
        <section id="signals" style={{ paddingBottom: 78 }}>
          <Head n="03" title="Signals — the state nobody types" sub="Read continuously from meaning — and when one is missing, actively gone after." />
          <P>
            While the chain runs, its extractor steps write <strong style={strong}>structured state</strong> back into a
            shared memory — stage, intent, sentiment, goals, risk, whatever the domain declares. Most of it is{' '}
            <em style={em}>inferred</em>: the user never says it outright, and no keyword would catch it.
          </P>
          <P>
            That inferred state is the <strong style={strong}>signal</strong>, and it is what everything downstream runs on —
            which knowledge activates, how the agent reasons, where the conversation goes next. Signals persist across the
            whole conversation and across crews, so the next stage opens already knowing what the last one learned.
          </P>
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '24px 22px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Node label="conversation" tone="muted" />
            <Arrow />
            <Node label="infer" tone="purple" sub="reads meaning, not keywords" />
            <Arrow />
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'center' }}>
              {['stage', 'intent', 'sentiment', 'goals'].map(s => <Chip key={s} tone="teal">{s}</Chip>)}
            </div>
          </div>
          {/* Active discovery — the half that isn't listening. */}
          <div style={{ marginTop: 30 }}>
            <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 8 }}>It doesn’t only listen — it goes and gets them</div>
            <P>
              Reading what someone says is half the job. When a signal the domain needs is still{' '}
              <strong style={strong}>missing</strong>, the chain doesn’t wait and hope it comes up: steps are given{' '}
              <strong style={strong}>ownership of a specific signal</strong> and steer the conversation toward it —
              deciding what to ask next, fitting it into the flow, and capturing the answer in the same move.
            </P>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '22px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Node label="signal still missing" tone="muted" /><Arrow />
              <Node label="a step owns it" tone="purple" sub="drives the exchange" /><Arrow />
              <Node label="shapes what’s asked next" tone="teal" /><Arrow />
              <Node label="captured" tone="green" />
            </div>
            <p style={{ fontFamily: SANS, fontSize: 14.5, lineHeight: 1.8, color: MUTED, margin: '16px 0 0', maxWidth: 760 }}>
              So a conversation that reads as ordinary talk is also, underneath, a plan to find out what the agent still
              needs to know — <strong style={strong}>without ever turning into a form</strong>.
            </p>
          </div>
          <DeepSignals />
        </section>

        {/* 04 · SAG */}
        <section id="sag" style={{ paddingBottom: 78 }}>
          <Head n="04" title="SAG — knowledge that doesn’t wait to be asked" sub="Signal-Augmented Generation: the knowledge fires on the state we infer, not on the words you use." />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: TONES.green.bg, border: `1px solid ${TONES.green.bd}`, borderRadius: 999, padding: '5px 13px', margin: '0 0 18px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN, flexShrink: 0 }} />
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: GREEN }}>where our innovation is sharpest</span>
          </div>
          <P>
            To hold its own as a genuine <strong style={strong}>domain expert</strong>, an agent has to know far more than
            fits in one prompt. There are only two known ways to hand the model that knowledge — and on their own,{' '}
            <strong style={strong}>both break</strong>:
          </P>

          {/* the problem — two options */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px' }}>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED, marginBottom: 14 }}>Option 1 · everything in the prompt</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {['Slow — a huge prompt on every single turn', 'Costly — you pay for every token, every time', 'Unreliable — models drift and lose the thread inside giant prompts'].map(t => (
                  <div key={t} style={{ display: 'flex', gap: 9, alignItems: 'baseline' }}>
                    <span style={{ color: BAD, fontFamily: MONO, fontSize: 12, flexShrink: 0 }}>✕</span>
                    <span style={{ fontFamily: SANS, fontSize: 13, lineHeight: 1.5, color: MUTED }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px' }}>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED, marginBottom: 14 }}>Option 2 · a knowledge base (RAG)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {[['✓', GREEN, 'Lean — pulls only what looks relevant'], ['✕', BAD, 'But it only fires on the user’s own words'], ['✕', BAD, 'Blind to what they need to hear but never mention']].map(([icon, col, t]) => (
                  <div key={t} style={{ display: 'flex', gap: 9, alignItems: 'baseline' }}>
                    <span style={{ color: col, fontFamily: MONO, fontSize: 12, flexShrink: 0 }}>{icon}</span>
                    <span style={{ fontFamily: SANS, fontSize: 13, lineHeight: 1.5, color: MUTED }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* the need + the answer (SAG) */}
          <div style={{ marginTop: 16, background: TONES.green.bg, border: `1px solid ${TONES.green.bd}`, borderInlineStart: `3px solid ${GREEN}`, borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: GREEN, marginBottom: 10 }}>the answer · signal-augmented generation</div>
            <p style={{ fontFamily: SANS, fontSize: 14.5, lineHeight: 1.8, color: MUTED, margin: '0 0 12px' }}>
              What’s needed is one mechanism doing <strong style={strong}>both jobs at once</strong>: keep the prompt lean,{' '}
              <em style={em}>and</em> land the exact right knowledge — including when the user mentions nothing relevant at all.
            </p>
            <p style={{ fontFamily: SANS, fontSize: 14.5, lineHeight: 1.8, color: TEXT, margin: 0 }}>
              That is <strong style={strong}>SAG</strong>. The knowledge is authored as modules, one per state; our signals
              decide which module belongs in <em style={em}>this</em> turn and fetch only that one. The prompt stays lean and
              exactly on point — and the agent answers like a domain expert{' '}
              <strong style={strong}>without the customer ever asking</strong>.
            </p>
          </div>

          {/* the flows — the SAME component used in the details modal */}
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: FAINT, margin: '26px 0 12px' }}>side by side · same job, different trigger</div>
          <RagSagFlows />
          <div style={{ marginTop: 24 }}>
            <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 8 }}>The difference is the trigger</div>
            <p style={{ fontFamily: SANS, fontSize: 14.5, lineHeight: 1.8, color: MUTED, margin: 0, maxWidth: 760 }}>
              Both do the same job — bring in the relevant piece, never the whole library. RAG is triggered by the user’s
              words, so it can only help once they raise the topic themselves. SAG is triggered by the{' '}
              <strong style={strong}>state we infer</strong>, so the right knowledge is already in the prompt at the moment it
              matters — before the customer asks, and even if they never do.
            </p>
          </div>

          {/* ── the proof: the live demo, on the page ───────────────── */}
          <div style={{ marginTop: 34 }}>
            <div style={{ background: TONES.green.bg, border: `1px solid ${TONES.green.bd}`, borderInlineStart: `3px solid ${GREEN}`, borderRadius: 10, padding: '15px 18px', margin: '0 0 18px' }}>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: GREEN, marginBottom: 7 }}>the whole point</div>
              <div style={{ fontFamily: SANS, fontSize: 14.5, lineHeight: 1.7, color: TEXT }}>
                The user can say <strong style={strong}>not one word</strong> related to the knowledge — and we still know to
                inject the right piece. RAG structurally cannot: no mention, no retrieval.
              </div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 8 }}>See it live · signals → knowledge, message by message</div>
            <P>
              Picture the domain knowledge as a <strong style={strong}>table of states</strong>. Each message, the chain reads
              the signals and switches on the rows that match — and <strong style={strong}>only those</strong> get injected.
              The first message is a plain question RAG could catch too; the rest — across{' '}
              <strong style={strong}>menopause and banking</strong> — name nothing a search could match, yet the right
              knowledge still fires. Use ◀ ▶ to hold on any message.
            </P>
            <SagDemo />
          </div>

          {/* ── how activation actually works ────────────────────────── */}
          <div style={{ marginTop: 34 }}>
            <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 8 }}>Two ways a signal reaches knowledge</div>
            <P>
              “Activated by signals” is not one trick. A domain uses whichever of the two fits the knowledge it has — and both
              are triggered by inferred state, never by lexical match.
            </P>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
              <div style={{ background: PANEL, border: `1px solid ${TONES.green.bd}`, borderRadius: 14, padding: '20px' }}>
                <div style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: GREEN, marginBottom: 4 }}>Targeted KB · exact</div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: FAINT, marginBottom: 12 }}>deterministic · no search</div>
                <p style={{ fontFamily: SANS, fontSize: 13.5, lineHeight: 1.7, color: MUTED, margin: 0 }}>
                  Knowledge authored as an addressable tree: a signal’s value selects its branch, and that branch is rendered
                  into the prompt <strong style={strong}>verbatim</strong>. No chunking, no similarity score, nothing to guess
                  wrong — <em style={em}>state X is here, therefore section Y</em>.
                </p>
              </div>
              <div style={{ background: PANEL, border: `1px solid ${TONES.teal.bd}`, borderRadius: 14, padding: '20px' }}>
                <div style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: TEAL, marginBottom: 4 }}>Gated retrieval · vector</div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: FAINT, marginBottom: 12 }}>Pinecone · signal-scoped</div>
                <p style={{ fontFamily: SANS, fontSize: 13.5, lineHeight: 1.7, color: MUTED, margin: 0 }}>
                  For open-ended libraries we still search — but the chain picks <strong style={strong}>which source</strong>{' '}
                  and <strong style={strong}>what to search for</strong> from live signals, not from the user’s sentence. Same
                  vector index everyone has, aimed by state instead of by wording.
                </p>
              </div>
            </div>
          </div>
          <DeepSag />
        </section>

        {/* 05 · Rebuilt every turn */}
        <section id="lcs" style={{ paddingBottom: 78 }}>
          <Head n="05" title="Live Context Synthesis — a new agent every turn" sub="No fixed prompt. No fixed states. Composed, not selected." />
          <P>
            There is no system prompt sitting in a file waiting to be sent. Every message, the agent’s whole context —
            persona, memory, the knowledge that just activated, the reasoning from the steps before it — is{' '}
            <strong style={strong}>assembled from scratch</strong> out of the current signals.
          </P>
          <P>
            Because it is built from independent signal dimensions, the space is combinatorial rather than a finite list of
            authored nodes: it <strong style={strong}>never runs the same agent twice</strong>. That is the difference between
            <em style={em}> selecting</em> a context, which RAG does, <em style={em}>branching</em> to one, which a graph
            does, and <strong style={strong}>synthesising</strong> it, which is what happens here.
          </P>
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '24px 22px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[['persona', 'purple'], ['memory', 'teal'], ['activated knowledge', 'green'], ['reasoning', 'purple']].map(([l, t]) => (
                <Node key={l} label={l} tone={t as Tone} />
              ))}
            </div>
            <Arrow />
            <div style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: AMBER, background: TONES.amber.bg, border: `1px solid ${TONES.amber.bd}`, borderRadius: 10, padding: '10px 14px' }}>
              this turn’s agent
            </div>
          </div>
          <DeepLcs />
        </section>

        {/* 06 · What it unlocks */}
        <section id="buys" style={{ paddingBottom: 78 }}>
          <Head n="06" title="What the architecture buys" sub="Four subsystems feeding each other — which is why this is a platform, not three features." />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 14 }}>
            {[
              ['Depth a flowchart can’t hold', 'The agent runs a real process — assess, weigh, advise — instead of walking a menu of nodes.', 'purple'],
              ['Adapts to the person', 'Two conversations never share a path, a prompt, or a reaction. The flow emerges from who is talking.', 'teal'],
              ['Proactive, not reactive', 'The right knowledge and the right next step arrive before anyone asks — and a missing signal gets pursued, not waited for.', 'green'],
              ['Shipped as the finished expert', 'Not a builder to assemble yourself. Lybi comes as a whole solution per domain, ours to know — menopause and banking today, one runtime under both.', 'amber'],
            ].map(([t, d, tone]) => (
              <div key={t} style={{ background: PANEL, border: `1px solid ${TONES[tone as Tone].bd}`, borderRadius: 14, padding: '18px 20px' }}>
                <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: TONES[tone as Tone].fg, marginBottom: 8 }}>{t}</div>
                <p style={{ fontFamily: SANS, fontSize: 13, lineHeight: 1.7, color: MUTED, margin: 0 }}>{d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 07 · Stack */}
        <section id="stack" style={{ paddingBottom: 78 }}>
          <Head n="07" title="Stack" sub="What it actually runs on." />
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '18px 20px', display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 20, rowGap: 9, fontFamily: MONO, fontSize: 12.5, lineHeight: 1.65, color: TEXT }}>
            <span style={{ color: FAINT }}>runtime</span>
            <span>Node 22 · Express 5 · live token streaming (SSE)</span>
            <span style={{ color: FAINT }}>models</span>
            <span>provider-agnostic router → OpenAI · Anthropic · Google <span style={{ color: FAINT }}>(per step, with fallback)</span></span>
            <span style={{ color: FAINT }}>knowledge</span>
            <span>Targeted KB <span style={{ color: FAINT }}>(exact, signal-gated)</span> + Pinecone vector retrieval</span>
            <span style={{ color: FAINT }}>state</span>
            <span>PostgreSQL — memory, signals, context, versions</span>
            <span style={{ color: FAINT }}>authoring</span>
            <span>Builder V2 — every chain, step, field and module</span>
            <span style={{ color: FAINT }}>delivery</span>
            <span>Firebase Hosting · Google Cloud Run</span>
          </div>
        </section>

        <div style={{ marginTop: 48, paddingTop: 20, borderTop: `1px solid ${BORDER}` }}>
          <Link to="/lybi/knowledge" style={{ fontFamily: MONO, fontSize: 13, color: TEAL, textDecoration: 'none' }}>
            ← back to knowledge base
          </Link>
        </div>
        </div>
      </div>
    </div>
  );
}
