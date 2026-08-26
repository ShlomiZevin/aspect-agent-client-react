import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageCommentsProvider, SectionComments, type CommentTokens } from '../components/common';

/**
 * Zol Stock — Smart Replenishment: the brief for Vova.
 *
 * Deliberately SHORT. This says WHAT we are building and HOW it hangs together,
 * and stops there — his own Claude session reads the codebase and works out the
 * detail. The job of this page is to aim him, not to hand him an implementation
 * manual (the first draft did that and was rightly rejected as unreadable).
 *
 * Anything longer than a screen per section belongs in the repo task file
 * (aspect-agent-server/tasks/pending/zolstock-smart-replenishment.md), not here.
 *
 * Customer-facing Hebrew companion: /aspect/zolstock-purchasing-he.
 * Both pages carry per-section review comments (name + note, no auth).
 */

const MONO = "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const BG = 'var(--z-bg)';
const PANEL = 'var(--z-panel)';
const PANEL2 = 'var(--z-panel2)';
const BORDER = 'var(--z-border)';
const TEXT = 'var(--z-text)';
const MUTED = 'var(--z-muted)';
const FAINT = 'var(--z-faint)';
const TEAL = 'var(--z-teal)';
const GREEN = 'var(--z-green)';
const AMBER = 'var(--z-amber)';
const BAD = 'var(--z-bad)';
const HAIRLINE = 'var(--z-hairline)';

const THEME_BG: Record<'dark' | 'light', string> = { dark: '#0A0D13', light: '#F2F5F8' };

const THEME_CSS = `
.zolSpec{
  --z-bg:#0A0D13; --z-panel:#0F141C; --z-panel2:#0C1017; --z-border:#333E4C;
  --z-text:#C9D1D9; --z-muted:#8B949E; --z-faint:#7C8794;
  --z-teal:#56D4DD; --z-green:#7EE787; --z-amber:#E3B341; --z-bad:#F2708A;
  --z-hairline:#1B2430; --z-navbg:rgba(10,13,19,0.90);
  --z-teal-bd:rgba(86,212,221,0.44);   --z-teal-bg:rgba(86,212,221,0.065);
  --z-green-bd:rgba(126,231,135,0.44); --z-green-bg:rgba(126,231,135,0.06);
  --z-amber-bd:rgba(227,179,65,0.44);  --z-amber-bg:rgba(227,179,65,0.06);
  --z-bad-bd:rgba(242,112,138,0.44);   --z-bad-bg:rgba(242,112,138,0.065);
  --z-muted-bd:#3E4956; --z-muted-bg:#141B25;
  --z-rail-on:rgba(86,212,221,0.07);
  --z-note:#161D26; --z-note-bd:#303C4A;
}
.zolSpec[data-theme="light"]{
  --z-bg:#F2F5F8; --z-panel:#FFFFFF; --z-panel2:#F6F8FA; --z-border:#C3CEDA;
  --z-text:#111C27; --z-muted:#48576A; --z-faint:#6A788B;
  --z-teal:#0E7A83; --z-green:#15803D; --z-amber:#B45309; --z-bad:#BE123C;
  --z-hairline:#E3E9EF; --z-navbg:rgba(242,245,248,0.92);
  --z-teal-bd:rgba(14,122,131,0.26);   --z-teal-bg:rgba(14,122,131,0.045);
  --z-green-bd:rgba(21,128,61,0.26);   --z-green-bg:rgba(21,128,61,0.04);
  --z-amber-bd:rgba(180,83,9,0.26);    --z-amber-bg:rgba(180,83,9,0.038);
  --z-bad-bd:rgba(190,18,60,0.26);     --z-bad-bg:rgba(190,18,60,0.038);
  --z-muted-bd:#D3DCE5; --z-muted-bg:#FBFCFD;
  --z-rail-on:rgba(14,124,134,0.08);
  --z-note:#FFFFFF; --z-note-bd:#D5DFE9;
}
.zolSpec table{ border-collapse:collapse; width:100%; }
.zolSpec th,.zolSpec td{ text-align:start; vertical-align:top; }
@media (max-width: 1000px){ .zolSpecRail{ display:none !important; } }
`;

type Tone = 'teal' | 'green' | 'amber' | 'bad' | 'muted';
const TONES: Record<Tone, { fg: string; bd: string; bg: string }> = {
  teal:  { fg: TEAL,  bd: 'var(--z-teal-bd)',  bg: 'var(--z-teal-bg)' },
  green: { fg: GREEN, bd: 'var(--z-green-bd)', bg: 'var(--z-green-bg)' },
  amber: { fg: AMBER, bd: 'var(--z-amber-bd)', bg: 'var(--z-amber-bg)' },
  bad:   { fg: BAD,   bd: 'var(--z-bad-bd)',   bg: 'var(--z-bad-bg)' },
  muted: { fg: MUTED, bd: 'var(--z-muted-bd)', bg: 'var(--z-muted-bg)' },
};

const NAV_H = 53;
const strong = { color: TEXT, fontWeight: 600 } as const;

const COMMENT_TOKENS: CommentTokens = {
  border: BORDER, text: TEXT, faint: FAINT,
  paper: 'var(--z-note)', paperBorder: 'var(--z-note-bd)', noteAccent: TEAL,
  font: SANS, dir: 'ltr',
};

function Head({ n, title, sub }: { n: string; title: string; sub?: string }) {
  return (
    <>
      <div style={{
        position: 'sticky', top: NAV_H, zIndex: 20, background: BG,
        borderBottom: `1px solid ${BORDER}`, padding: '14px 0 12px',
        marginBottom: sub ? 12 : 22, display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <span style={{
          flexShrink: 0, fontFamily: MONO, fontSize: 13, fontWeight: 700, color: TEAL,
          background: TONES.teal.bg, border: `1px solid ${TONES.teal.bd}`, borderRadius: 8,
          padding: '5px 10px', lineHeight: 1.1,
        }}>{n}</span>
        <h2 style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: TEXT, margin: 0, letterSpacing: '-0.015em', lineHeight: 1.3, minWidth: 0 }}>{title}</h2>
      </div>
      {sub && <div style={{ fontFamily: SANS, fontSize: 14, lineHeight: 1.7, color: FAINT, marginBottom: 22, maxWidth: 780 }}>{sub}</div>}
    </>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: SANS, fontSize: 15, lineHeight: 1.8, color: MUTED, margin: '0 0 14px', maxWidth: 790 }}>{children}</p>;
}

function Box({ children, tone = 'muted', label }: { children: React.ReactNode; tone?: Tone; label?: string }) {
  const t = TONES[tone];
  return (
    <div style={{ border: `1px solid ${t.bd}`, background: t.bg, borderRadius: 12, padding: '14px 16px', margin: '0 0 16px' }}>
      {label && (
        <div style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.fg, marginBottom: 9 }}>
          {label}
        </div>
      )}
      <div style={{ fontFamily: SANS, fontSize: 14, lineHeight: 1.8, color: MUTED }}>{children}</div>
    </div>
  );
}

function Card({ n, title, tone = 'teal', children }: { n: string; title: string; tone?: Tone; children: React.ReactNode }) {
  const t = TONES[tone];
  return (
    <div style={{
      border: `1px solid ${BORDER}`, background: PANEL, borderRadius: 12,
      padding: '15px 17px', margin: '0 0 12px', display: 'flex', gap: 14, alignItems: 'flex-start',
    }}>
      <span style={{
        flexShrink: 0, fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: t.fg,
        background: t.bg, border: `1px solid ${t.bd}`, borderRadius: 8, padding: '4px 9px', lineHeight: 1.2,
      }}>{n}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 700, color: TEXT, marginBottom: 6 }}>{title}</div>
        <div style={{ fontFamily: SANS, fontSize: 14, lineHeight: 1.8, color: MUTED }}>{children}</div>
      </div>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre style={{
      fontFamily: MONO, fontSize: 12, lineHeight: 1.7, color: TEXT, background: PANEL2,
      border: `1px solid ${BORDER}`, borderRadius: 10, padding: '13px 15px', margin: '0 0 16px',
      overflowX: 'auto', whiteSpace: 'pre',
    }}>{children}</pre>
  );
}

function C({ children }: { children: React.ReactNode }) {
  return <code style={{ fontFamily: MONO, fontSize: 12.5, color: TEAL, background: PANEL2, border: `1px solid ${HAIRLINE}`, borderRadius: 5, padding: '1px 5px' }}>{children}</code>;
}

const INTRO = { id: 'top', n: '00', label: 'The brief' };
const SECTIONS: { id: string; n: string; label: string }[] = [
  { id: 'goal',  n: '01', label: 'What we build' },
  { id: 'data',  n: '02', label: 'What the data is' },
  { id: 'parts', n: '03', label: 'The four pieces' },
  { id: 'rules', n: '04', label: 'Non-negotiables' },
  { id: 'order', n: '05', label: 'Build order' },
];

function SideRail({ active }: { active: string }) {
  return (
    <nav aria-label="Sections" style={{ position: 'sticky', top: 80, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {SECTIONS.map(s => {
        const on = s.id === active;
        return (
          <a key={s.id} href={`#${s.id}`} style={{
            display: 'flex', alignItems: 'baseline', gap: 9, textDecoration: 'none',
            padding: '6px 10px', borderRadius: 7,
            borderInlineStart: `2px solid ${on ? TEAL : 'transparent'}`,
            background: on ? 'var(--z-rail-on)' : 'transparent',
            transition: 'color .2s, background .2s, border-color .2s',
          }}>
            <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, color: on ? TEAL : FAINT }}>{s.n}</span>
            <span style={{ fontFamily: MONO, fontSize: 11.5, color: on ? TEXT : FAINT }}>{s.label}</span>
          </a>
        );
      })}
    </nav>
  );
}

type Theme = 'dark' | 'light';
const THEME_KEY = 'zolstock-spec-theme';

export function ZolstockPurchasingSpecPage() {
  const [active, setActive] = useState(INTRO.id);
  const [progress, setProgress] = useState(0);
  const [theme, setTheme] = useState<Theme>(() => {
    // Light is the default — these are documents people read and forward, and
    // a dark page is a surprise when a link is opened cold. A stored 'dark'
    // still wins, so anyone who chose it keeps it.
    try { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
  });
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'Zol Stock · Smart Replenishment — the brief';
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    const prev = document.body.style.background;
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.background = prev;
    };
  }, []);

  useEffect(() => {
    document.body.style.background = THEME_BG[theme];
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* private mode */ }
  }, [theme]);

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
    <PageCommentsProvider pageKey="zolstock-purchasing" t={COMMENT_TOKENS}>
    <div ref={scrollerRef} className="zolSpec" data-theme={theme}
      style={{ fontFamily: SANS, background: BG, color: TEXT, minHeight: '100vh', overflow: 'auto' }}>
      <style>{THEME_CSS}</style>

      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--z-navbg)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '11px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontFamily: MONO, fontSize: 13, color: MUTED, flexShrink: 0 }}>
            <span style={{ color: TEAL }}>~/</span>zolstock<span style={{ color: FAINT }}> · replenishment</span>
          </span>
          <span style={{ color: FAINT, fontFamily: MONO, fontSize: 13, flexShrink: 0 }}>/</span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: TEAL, flexShrink: 0 }}>{here.n}</span>
            <span style={{ fontFamily: MONO, fontSize: 13, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{here.label}</span>
          </span>
          <span style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <Link to="/aspect/zolstock-purchasing-he" style={{
              fontFamily: MONO, fontSize: 11, color: MUTED, textDecoration: 'none',
              border: `1px solid ${BORDER}`, borderRadius: 6, padding: '4px 10px', lineHeight: 1.6,
            }}>עברית · ללקוח</Link>
            <button onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              style={{ fontFamily: MONO, fontSize: 11, color: MUTED, background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', lineHeight: 1.6 }}>
              {theme === 'dark' ? '☀ light' : '☾ dark'}
            </button>
          </span>
        </div>
        <div style={{ height: 2, background: HAIRLINE }}>
          <div style={{ height: '100%', width: `${progress}%`, background: TEAL, transition: 'width .12s linear' }} />
        </div>
      </nav>

      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '52px 24px 110px', display: 'flex', gap: 40 }}>
        <div className="zolSpecRail" style={{ width: 176, flexShrink: 0 }}><SideRail active={active} /></div>

        <div style={{ flex: '1 1 auto', minWidth: 0, maxWidth: 880 }}>

          {/* ─────────────── HERO ─────────────── */}
          <div id="top" style={{ scrollMarginTop: 70 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: TEAL, marginBottom: 14 }}>
              Aspect Intelligence · brief for Vova
            </div>
            <h1 style={{ fontFamily: MONO, fontSize: 32, fontWeight: 700, lineHeight: 1.2, color: TEXT, margin: '0 0 18px', letterSpacing: '-0.01em' }}>
              Zol Stock — Smart Replenishment
            </h1>
            <p style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.85, color: MUTED, margin: '0 0 14px', maxWidth: 800 }}>
              Zol Stock's BI answers <strong style={strong}>what happened</strong>. The client wants{' '}
              <strong style={strong}>what to order, how much, and when</strong>. Their BI has no concept of how long a
              supplier takes to deliver, so it can never answer "when" — that is the gap we fill.
            </p>
            <p style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.85, color: MUTED, margin: '0 0 14px', maxWidth: 800 }}>
              This page is the aim, not the manual. It says what to build and how the pieces fit. The details —
              exact columns, SQL, file layout — your session works out from the codebase.
            </p>

            <Box tone="amber" label="scope, in one sentence">
              This is an <strong style={strong}>answering</strong> product, not an ordering system. Nothing runs ahead
              of the user, nothing is pushed anywhere. The only automatic part is data preparation inside the import
              that already runs; everything else is computed when someone asks.
            </Box>

            <Box tone="muted" label="push comes later — build so it can">
              The client asked for alerts and recommendations that reach them. We are deliberately{' '}
              <strong style={strong}>not</strong> building that yet: it only makes sense once the screen and the agent
              are approved and the numbers are trusted. That is agreed with them and written into their document.
              <br /><br />
              What it means for you: the calculation must be callable{' '}
              <strong style={strong}>without a user in front of it</strong> — a plain function over stored settings,
              no request context, no session. Get that right and the push phase is a scheduler and a delivery channel,
              not a rewrite.
            </Box>
          </div>

          {/* ─────────────── 01 ─────────────── */}
          <section id="goal" style={{ scrollMarginTop: 70 }}>
            <Head n="01" title="What we are building" />

            <P>
              Three questions, in three places in the supply chain. Same engine each time, different point of view.
              We build the first one now and the other two later.
            </P>

            <Card n="1" title="Purchasing — what to order, how much, when" tone="green">
              <strong style={strong}>This phase.</strong> For every supplier in the data, and every item that has a
              warehouse code: how fast it sells, how much is on hand and on the way, and therefore the date an order
              must go out so the goods land before stock runs out.
            </Card>
            <Card n="2" title="Warehouse — what comes in, what goes out, how much, when" tone="muted">
              Same engine, warehouse point of view. Later.
            </Card>
            <Card n="3" title="Branches — what each branch needs, how much, when" tone="muted">
              Same engine, per-store grain. Later.
            </Card>

            <Box tone="teal" label="build it parameterised">
              Do not hardcode "warehouse" into the calculation. Pass the stock source in. Phases 2 and 3 should be a
              new caller, not a second implementation.
            </Box>

            <SectionComments sectionId="goal" />
          </section>

          {/* ─────────────── 02 ─────────────── */}
          <section id="data" style={{ scrollMarginTop: 70 }}>
            <Head n="02" title="What the data actually is"
              sub="Five things worth knowing before you design anything. Everything else your session will find on its own." />

            <Card n="a" title="It is a Qlik export, already imported and running" tone="teal">
              Four CSVs land in GCS; <C>scripts/reload-zolstock.js</C> loads them into a shadow schema, builds
              indexes and materialized views, then atomically swaps it in. You extend that phase — you do not touch
              the import mechanism.
            </Card>

            <Card n="b" title="Sales and stock use different item keys" tone="bad">
              Sales rows key on one column, warehouse/orders on another, and{' '}
              <strong style={strong}>only about 14,600 of 298,000 items have the warehouse key at all</strong>. Demand
              and stock must be bridged through the item catalogue. Items without the key can be seen in sales but
              cannot get an order recommendation — <strong style={strong}>this is the main open risk</strong> and
              step 1 measures it per supplier.
            </Card>

            <Card n="c" title="Nothing records goods arriving" tone="bad">
              No receipt, no arrival date, and purchase orders have no status. Two consequences: lead time can never
              be measured, so it has to be entered; and "what's already on the way" may include stock that arrived
              months ago, which would make us under-order. Flag it, don't hide it.
            </Card>

            <Card n="d" title="There are two supplier columns and the obvious one is wrong" tone="amber">
              One is the supplying company the buyer means; the other is the manufacturer, whose Latin names are
              stored <strong style={strong}>character-reversed</strong> in the export. Our sales views currently carry
              the wrong one — so "sales by supplier" today groups by manufacturer. Fixing that is part of this work.
            </Card>

            <Card n="e" title="Inventory is a snapshot, money is an estimate" tone="muted">
              Stock rows carry no date, so there is no history and no measured consumption — demand comes from sales
              only. And the feed has no money at all: every value is derived from list prices, excluding discounts.
              Existing code already labels this everywhere; keep doing it.
            </Card>

            <SectionComments sectionId="data" />
          </section>

          {/* ─────────────── 03 ─────────────── */}
          <section id="parts" style={{ scrollMarginTop: 70 }}>
            <Head n="03" title="The four pieces"
              sub="This is the whole design." />

            <Card n="1" title="Prepare at import time" tone="teal">
              Two new materialized views built during the reload that already runs: one row per{' '}
              <strong style={strong}>supplier</strong> (so the supplier list builds itself from the data — nobody
              types suppliers in, a new one appears by itself), and one row per{' '}
              <strong style={strong}>item</strong> carrying its stock, what's on order, what's committed, and its
              sales velocity over trailing windows.
              <br /><br />
              Heavy scanning happens here, once. At request time we only read ~15k prepared rows.
            </Card>

            <Card n="2" title="A Suppliers screen — the one thing the customer types" tone="amber">
              The supplier list, with a <strong style={strong}>lead time per supplier</strong>. Default 90 days,
              editable per supplier, and the dataset default is editable too. Any supplier not yet set is answered
              using the default and <strong style={strong}>labelled as such</strong> — the buyer must always be able
              to tell a number they gave us from a number we assumed.
              <br /><br />
              <strong style={{ ...strong, color: BAD }}>Store it in the platform DB, never in the Zol Stock data
              schema</strong> — that schema is dropped and rebuilt on every import, so anything the customer typed
              there would silently disappear.
            </Card>

            <Card n="3" title="The calculation — in code, not in the LLM" tone="green">
              Given velocity, stock, what's on order, and the supplier's lead time: when does stock run out, therefore
              when must the order go out, therefore how much to order (rounded up to carton size where known).
              <Code>{`cover      = available / daily velocity
order by   = data date + (cover − lead time)
order qty  = velocity × (lead time + review cycle) + safety − available`}</Code>
              This is fixed arithmetic. It must be a plain function, unit-tested, so the same question always returns
              the same number and every row can show its own working. The model's job is to{' '}
              <strong style={strong}>explain</strong> the answer and ask for a missing lead time — never to compute it.
            </Card>

            <Card n="4" title="Three places the answer shows up" tone="teal">
              All three read the same calculation, so the numbers cannot disagree.
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${HAIRLINE}` }}>
                <div style={{ marginBottom: 7 }}><strong style={strong}>A dedicated screen</strong> — a "what to order"
                table in the Intelligence Center, sorted by urgency, filterable by supplier, expandable per row to
                show the full calculation, exportable to CSV. Fixed fields, repeatable answer.</div>
                <div style={{ marginBottom: 7 }}><strong style={strong}>The chat</strong> — the same numbers via a
                tool the agent calls with structured arguments (not generated SQL). It answers using the default lead
                time, says so, and points at the screen where it can be set properly.</div>
                <div><strong style={strong}>A report</strong> — the existing Intelligence report flow, with the data
                step swapped for our calculation. Everything downstream stays as it is.</div>
              </div>
            </Card>

            <Box tone="muted" label="why a screen AND chat AND report">
              They are different jobs. The screen is for the buyer who does this every week and wants the same table
              every time. The chat is for the manager who has one question. The report is what gets shared. The
              Intelligence Center already has all three surfaces — we are adding one answer to them, not building a
              new product.
            </Box>

            <SectionComments sectionId="parts" />
          </section>

          {/* ─────────────── 04 ─────────────── */}
          <section id="rules" style={{ scrollMarginTop: 70 }}>
            <Head n="04" title="Non-negotiables"
              sub="Short list. Each one is something this codebase already learned the hard way." />

            <Box tone="bad" label="do not">
              <div style={{ marginBottom: 8 }}><strong style={strong}>Do not store customer input in the Zol Stock schema.</strong> It is rebuilt on every import.</div>
              <div style={{ marginBottom: 8 }}><strong style={strong}>Do not let the LLM do the arithmetic.</strong> House rule: code does arithmetic, the model does judgment.</div>
              <div style={{ marginBottom: 8 }}><strong style={strong}>Do not join the item catalogue without deduplicating.</strong> ~1,900 item numbers repeat. The same mistake once inflated another client's revenue by 44.6%.</div>
              <div style={{ marginBottom: 8 }}><strong style={strong}>Do not anchor anything to today's date.</strong> The feed is a periodic export and can be months behind. Anchor to the last date in the sales data.</div>
              <div><strong style={strong}>Do not add routes to <C>server.js</C>.</strong> New feature ⇒ its own folder with a router, mounted in one line.</div>
            </Box>

            <Box tone="green" label="do">
              <div style={{ marginBottom: 8 }}><strong style={strong}>Register every new claim in the dataset manifest.</strong> That is the mechanism that makes caveats unskippable rather than optional — it is how the product stays honest under pressure.</div>
              <div style={{ marginBottom: 8 }}><strong style={strong}>Answer in the language you were asked in.</strong> Hebrew and English both, and Hebrew inside the data (supplier names) says nothing about the requested language. This has broken in both directions before.</div>
              <div><strong style={strong}>Show the working.</strong> A buyer will not act on a number they cannot check. Every recommendation row must open to reveal its inputs and formula.</div>
            </Box>

            <SectionComments sectionId="rules" />
          </section>

          {/* ─────────────── 05 ─────────────── */}
          <section id="order" style={{ scrollMarginTop: 70 }}>
            <Head n="05" title="Build order"
              sub="Five steps. Stop after each one and show it before moving on." />

            <Card n="1" title="Audit the data first — and stop" tone="bad">
              A read-only script that measures what is actually there: supplier coverage, how many items per supplier
              have the warehouse key, what purchase-order rows really contain, whether any receipt data exists at all.
              It also outputs a short plain-Hebrew list of what is missing, which Shlomi sends to the BI developer and
              the client manually.
              <br /><br />
              <strong style={strong}>Nothing else gets built until that has been read.</strong> If most suppliers turn
              out to have almost no coded items, we re-scope rather than ship a screen that recommends nothing.
            </Card>

            <Card n="2" title="Import-time preparation" tone="teal">
              The two new materialized views, plus fixing the supplier column in the existing sales views. Verify a
              full reload still completes — the base table is ~30M rows.
            </Card>

            <Card n="3" title="Suppliers screen + settings storage" tone="teal">
              The table in the platform DB, the API, the screen. Prove it by running a full reload and confirming the
              lead times are still there afterwards.
            </Card>

            <Card n="4" title="The calculation + the 'what to order' screen" tone="teal">
              The function, its unit tests, and the table that renders it. Then{' '}
              <strong style={strong}>hand-check ten real items with a calculator</strong> — invented test cases only
              test what we already understand.
            </Card>

            <Card n="5" title="Chat and report" tone="teal">
              The tool the agent calls, and the report path. Ask the same question five different ways in each
              language and confirm the numbers are identical every time — that invariance is the whole reason the
              calculation is a tool and not a prompt.
            </Card>

            <Box tone="amber" label="then, together with the client">
              Before it becomes routine, sit with them over a few dozen items and compare our recommendation to what
              they would have ordered. That calibration is what turns a technically correct system into one they
              trust — and it is where the real requirements will surface.
            </Box>

            <Box tone="muted" label="deeper reference, if the session wants it">
              A longer version of this — the exact data facts, contracts and per-step verification — lives in the
              repo at <C>aspect-agent-server/tasks/pending/zolstock-smart-replenishment.md</C>. This page is
              authoritative on scope; that file is a working aid.
            </Box>

            <SectionComments sectionId="order" />

            <div style={{ marginTop: 40, paddingTop: 22, borderTop: `1px solid ${BORDER}`, fontFamily: MONO, fontSize: 12, color: FAINT, lineHeight: 1.9 }}>
              <div>Aspect Intelligence · Zol Stock replenishment · brief</div>
              <div>Customer-facing Hebrew version: <Link to="/aspect/zolstock-purchasing-he" style={{ color: TEAL, textDecoration: 'none' }}>/aspect/zolstock-purchasing-he</Link></div>
            </div>
          </section>

        </div>
      </div>
    </div>
    </PageCommentsProvider>
  );
}
