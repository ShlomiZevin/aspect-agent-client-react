import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Lybi banking deck — on the site, in Hila's own look.
 *
 * Tab 1 embeds her actual deck (public/decks/lybi-banking-deck.html) so the
 * slides are exactly hers, her viewer and all. Tabs 2 and 3 are notes and a
 * suggested revision, styled to match her deck rather than anything else.
 */

const DECK_URL = '/decks/lybi-banking-deck.html';

// Hila's palette, taken from the deck file itself.
const BG = '#0A0420';
const PANEL = '#150A2E';
const PANEL2 = '#0F051E';
const BORDER = '#3A1260';
const WHITE = '#FFFFFF';
const TEXT = '#EAE4F2';
const MUTED = '#D4C8E8';
const FAINT = '#9B8BB4';
const MAGENTA = '#E0198A';
const PINK = '#F060B0';
const PURPLE = '#9A2295';
const AMBER = '#FFC34D';

const SANS = "'Assistant', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;600;700&display=swap');
.lybiDeckPg ::selection{background:rgba(224,25,138,0.35);color:#fff}
.lybiDeckPg a{color:${PINK}}
.lybiDeckPg .tabBtn:hover{color:${WHITE}}
`;

const strong = { color: WHITE, fontWeight: 700 } as const;

// ─── notes ────────────────────────────────────────────────────────
// Plain review, in the order they come up in the deck. Only things that are
// clearly wrong or clearly contradictory — nothing that is simply unfinished.
const NOTES: React.ReactNode[] = [
  <>
    <strong style={strong}>“Conative”</strong> — not a word most people know. It’s the old psychology term for the will
    to act, as opposed to thinking and feeling, so it is genuinely the right word for what this deck is about. But the
    deck never says that. It goes straight to “We call it Conative AI”. If the room can’t define the word, the category
    doesn’t stick. One sentence where it first appears fixes it.
  </>,
  <>
    <strong style={strong}>Slide 7 and slide 11 contradict each other.</strong> Slide 7: “A platform built around the
    decision itself.” Slide 11: “More than a platform.” And we sell a finished solution, not a platform — so “platform”
    probably shouldn’t be the word carrying slides 6 to 8.
  </>,
  <>
    <strong style={strong}>Slide 3 doesn’t parse.</strong> “The top line: sales, share of wallet, and
    retention—depends on one thing” reads as “sales … depends”. Something like “The top line — sales, share of wallet,
    retention — depends on one thing.”
  </>,
  <>
    <strong style={strong}>Slide 8, the three engines are names without substance.</strong> Each gloss repeats its own
    name: “Path Composer Engine — composes what to explore or make visible next.” A bank will read that as branding. One
    concrete sentence each about what actually happens would make it real.
  </>,
  <>
    <strong style={strong}>Regulation gets one chip.</strong> It appears once, in the list on slide 11, between “Value
    rules” and “Evaluation sets”. In a banking room that’s usually the first question asked, not a chip in a row.
  </>,
  <>
    <strong style={strong}>Slides 6 and 7 introduce three new terms in a row</strong> — “a new kind of intelligence”,
    “Conative AI”, and “Decision Catalyst Platform”. That’s a lot to hold across two slides.
  </>,
  <>
    <strong style={strong}>Typos, all the way through.</strong> A space before the full stop: “rationally .” (4).
    Sentences ending on a hyphen instead of a dash: “past experience-” (4), “a smarter agent- It’s” (6). Double spaces:
    “Meet Lybi  Conative AI” (7), “journeys -  where” (12). One cleanup pass.
  </>,
];

// ─── suggested revision ───────────────────────────────────────────
type Block = { k: 'lead' | 'body' | 'punch' | 'list' | 'meta'; t: string };
type Slide = { n: string; kicker?: string; blocks: Block[]; note?: string };

const PROPOSED: Slide[] = [
  { n: '01', blocks: [
    { k: 'lead', t: 'Lybi — the decision layer for high-value banking journeys.' },
    { k: 'meta', t: 'CONFIDENTIAL' },
  ], note: 'Category name off the title slide, so the first thing they read isn’t a word they can’t define.' },
  { n: '02', kicker: 'The agentic AI revolution', blocks: [
    { k: 'lead', t: 'Agentic AI is redefining what systems can do.' },
    { k: 'body', t: 'Banks are investing heavily in better reasoning, greater agency, more autonomous action — all of it aimed at the economics of service.' },
    { k: 'punch', t: 'But what about the top line?' },
  ] },
  { n: '03', kicker: 'The business outcome', blocks: [
    { k: 'lead', t: 'The top line — sales, share of wallet, retention — depends on one thing: a customer making a decision.' },
    { k: 'body', t: 'To take out a mortgage. Secure a loan. Open an account. Move their financial activity.' },
    { k: 'punch', t: 'Make a choice — and move forward.' },
  ], note: 'Sentence fixed so subject and verb agree.' },
  { n: '04', kicker: 'Why that is hard', blocks: [
    { k: 'lead', t: 'The system can run the process. It cannot make the decision.' },
    { k: 'body', t: 'And customers do not decide rationally. Choices are shaped by motives, constraints, identity, fear, trust and past experience — most of it never said out loud.' },
  ], note: 'Slides 4 and 5 were making one argument. Merged, so the punch line gets its own slide.' },
  { n: '05', kicker: 'The blind spot', blocks: [
    { k: 'lead', t: 'Digital and AI systems track and execute the process. They still can’t see what governs the decision.' },
    { k: 'punch', t: 'Advancing the process is not the same as advancing the decision.' },
  ], note: 'Best line in the deck. Given a slide to itself.' },
  { n: '06', kicker: 'What is missing', blocks: [
    { k: 'lead', t: 'Not a smarter agent — a system built around the decision itself.' },
    { k: 'body', t: 'Psychology splits the mind three ways: cognition, the thinking; affect, the feeling; and conation — the will that turns intent into action. Today’s AI is built on the first two.' },
    { k: 'punch', t: 'We build for the third. We call it Conative AI.' },
    { k: 'meta', t: 'the customer — what must become true to decide   ·   the organization — the value it can responsibly provide' },
  ], note: 'Defines the word where it first appears, and drops “a new kind of intelligence” so only one new term lands here.' },
  { n: '07', kicker: 'What Lybi is', blocks: [
    { k: 'lead', t: 'Not a chatbot with better manners. Not a wrapper over old decision trees. And not a toolkit to assemble yourself.' },
    { k: 'punch', t: 'Lybi arrives as the finished expert for a domain. Banking today.' },
    { k: 'body', t: 'It composes the customer’s decision path, assembles the value that matters to them, and sets the conditions for an informed decision.' },
  ], note: 'Says solution instead of platform, and says it here rather than waiting until slide 11.' },
  { n: '08', kicker: 'How it works', blocks: [
    { k: 'lead', t: 'One system. Four moving parts.' },
    { k: 'body', t: 'Live decision state — reads what’s driving this customer from how they talk, including what they never say outright, and tracks what’s still missing.' },
    { k: 'body', t: 'Path composer — decides what to raise next, and goes after a missing piece rather than waiting for the customer to bring it up.' },
    { k: 'body', t: 'Value assembler — puts the right product, proof or explanation in front of them at the moment it matters, before they ask.' },
    { k: 'body', t: 'Progress governor — decides whether the customer is actually ready to move forward, and holds if not.' },
  ], note: 'Same four parts, but each one now says what happens instead of restating its own name.' },
  { n: '09', kicker: 'Live from the platform', blocks: [
    { k: 'lead', t: 'Same journey. Three customers. Three different decisions in motion.' },
    { k: 'punch', t: 'The customer sees one conversation. The system underneath is never the same.' },
  ] },
  { n: '10', kicker: 'Governance', blocks: [
    { k: 'lead', t: 'You can read what the agent will say before it says it.' },
    { k: 'body', t: 'Every state maps to content someone wrote and approved — nothing is improvised out of a document pile. Compliance signs off in advance instead of auditing transcripts afterwards.' },
    { k: 'punch', t: 'Governed by design, not by review.' },
  ], note: 'New slide. Regulation was one chip on slide 11; in a bank it is usually the first question.' },
  { n: '11', kicker: 'Banking-ready, not a blank canvas', blocks: [
    { k: 'lead', t: 'Decades of banking expertise, productized.' },
    { k: 'list', t: 'Decision models · Diagnostic paths · Journey logic · Value rules · Response policies · Regulatory boundaries · Evaluation sets' },
    { k: 'body', t: 'Ready to customize. Designed for rapid, governed deployment.' },
  ] },
  { n: '12', kicker: 'The business case', blocks: [
    { k: 'lead', t: 'Where a customer decision shapes the outcome, the journey has to be designed around the decision — not around the process.' },
    { k: 'meta', t: 'transactional flows   →   decision journeys' },
    { k: 'punch', t: 'This is where your AI investment meets the top line.' },
  ] },
  { n: '13', kicker: 'The next step', blocks: [
    { k: 'lead', t: 'Let’s assess one journey.' },
    { k: 'list', t: 'Onboarding · Credit · Mortgages · Loans' },
    { k: 'punch', t: 'Schedule the assessment' },
  ] },
  { n: '14', kicker: 'Appendix', blocks: [
    { k: 'lead', t: 'Use cases · Technical appendix' },
  ] },
];

/** One slide, rendered at deck scale. Used for the on-site viewer. */
function SlideStage({ s }: { s: Slide }) {
  const st: Record<string, React.CSSProperties> = {
    lead:  { fontFamily: SANS, fontSize: 34, lineHeight: 1.2, color: WHITE, fontWeight: 700, margin: '0 0 20px', letterSpacing: '-0.02em' },
    body:  { fontFamily: SANS, fontSize: 17, lineHeight: 1.6, color: MUTED, margin: '0 0 14px', maxWidth: '62ch' },
    punch: { fontFamily: SANS, fontSize: 22, lineHeight: 1.35, color: MAGENTA, fontWeight: 700, margin: '10px 0 0' },
    meta:  { fontFamily: MONO, fontSize: 12, lineHeight: 1.7, color: FAINT, margin: '0 0 12px', letterSpacing: '0.16em' },
  };
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', minHeight: 380, background: PANEL2, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', right: '3%', bottom: '-6%', fontFamily: SANS, fontSize: 190, fontWeight: 700, color: 'rgba(255,255,255,0.035)', lineHeight: 1, pointerEvents: 'none' }}>{s.n}</div>
      <div style={{ position: 'absolute', inset: 0, padding: '6% 7%', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'auto' }}>
        {s.kicker && (
          <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: PURPLE, marginBottom: 18 }}>{s.kicker}</div>
        )}
        {s.blocks.map((b, i) =>
          b.k === 'list' ? (
            <div key={i} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '4px 0 14px' }}>
              {b.t.split('·').map(x => x.trim()).filter(Boolean).map(x => (
                <span key={x} style={{ fontFamily: SANS, fontSize: 15, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 999, padding: '6px 16px' }}>{x}</span>
              ))}
            </div>
          ) : (
            <p key={i} style={st[b.k]}>{b.t}</p>
          ),
        )}
      </div>
    </div>
  );
}

// ─── standalone HTML export ───────────────────────────────────────
// Built from the same PROPOSED array the viewer uses, so the file Hila
// downloads can never drift from what this page shows. Plain, readable
// markup — one <section> per slide — because she edits it afterwards.
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function slideMarkup(s: Slide): string {
  const parts: string[] = [];
  parts.push(`  <!-- ═══ SLIDE ${s.n}${s.kicker ? ' · ' + s.kicker : ''} ═══ -->`);
  if (s.note) parts.push(`  <!-- changed from the original: ${s.note.replace(/--/g, '—')} -->`);
  parts.push('  <section class="slide">');
  parts.push(`    <div class="num">${s.n}</div>`);
  parts.push('    <div class="inner">');
  if (s.kicker) parts.push(`      <p class="kicker">${esc(s.kicker)}</p>`);
  for (const b of s.blocks) {
    if (b.k === 'list') {
      const items = b.t.split('·').map(x => x.trim()).filter(Boolean)
        .map(x => `<li>${esc(x)}</li>`).join('');
      parts.push(`      <ul class="chips">${items}</ul>`);
    } else if (b.k === 'lead') {
      parts.push(`      <h2 class="lead">${esc(b.t)}</h2>`);
    } else {
      parts.push(`      <p class="${b.k}">${esc(b.t)}</p>`);
    }
  }
  parts.push('    </div>');
  parts.push('  </section>');
  return parts.join('\n');
}

function buildDeckHtml(): string {
  const slides = PROPOSED.map(slideMarkup).join('\n\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lybi — Banking Deck</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
  /* ── Lybi palette ─────────────────────────────────── */
  :root{
    --bg:#0A0420; --slide:#0F051E; --border:#3A1260;
    --white:#FFFFFF; --muted:#D4C8E8; --faint:#9B8BB4;
    --magenta:#E0198A; --purple:#9A2295;
    --sans:'Assistant', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --mono:'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace;
  }
  *{box-sizing:border-box}
  html,body{margin:0;height:100%;background:var(--bg);color:var(--muted);font-family:var(--sans)}
  .stage{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px}

  .slide{
    display:none;position:relative;overflow:hidden;
    width:min(1240px, 94vw);aspect-ratio:16/9;
    background:var(--slide);border:1px solid var(--border);border-radius:18px;
  }
  .slide.on{display:block}
  .inner{position:absolute;inset:0;padding:6% 7%;display:flex;flex-direction:column;justify-content:center;overflow:auto}
  .num{position:absolute;right:3%;bottom:-6%;font-size:190px;font-weight:700;color:rgba(255,255,255,.035);line-height:1;pointer-events:none}

  .kicker{font-family:var(--mono);font-size:13px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--purple);margin:0 0 20px}
  .lead{font-size:clamp(24px,3.2vw,44px);font-weight:700;line-height:1.15;letter-spacing:-.02em;color:var(--white);margin:0 0 22px}
  .body{font-size:clamp(14px,1.4vw,20px);line-height:1.6;color:var(--muted);margin:0 0 16px;max-width:62ch}
  .punch{font-size:clamp(17px,1.9vw,27px);font-weight:700;line-height:1.35;color:var(--magenta);margin:12px 0 0}
  .meta{font-family:var(--mono);font-size:13px;letter-spacing:.16em;color:var(--faint);margin:0 0 14px}
  .chips{list-style:none;display:flex;flex-wrap:wrap;gap:10px;padding:0;margin:6px 0 16px}
  .chips li{border:1px solid var(--border);border-radius:999px;padding:6px 16px;font-size:clamp(12px,1.05vw,16px);color:var(--muted)}

  /* ── controls ─────────────────────────────────────── */
  .nav{position:fixed;left:50%;transform:translateX(-50%);bottom:16px;display:flex;align-items:center;gap:14px;
       background:rgba(15,5,30,.9);border:1px solid var(--border);border-radius:999px;padding:7px 16px}
  .nav button{background:none;border:none;color:var(--muted);font-size:19px;cursor:pointer;line-height:1;padding:2px 6px}
  .nav button:hover{color:var(--white)}
  .count{font-family:var(--mono);font-size:13px;color:var(--faint);min-width:62px;text-align:center}
  .count b{color:var(--white);font-weight:600}

  /* ── print / PDF: every slide on its own page ─────── */
  @media print{
    html,body{background:#fff}
    .stage{position:static;display:block;padding:0}
    .slide{display:block!important;width:100%;border:none;border-radius:0;page-break-after:always;background:var(--slide)}
    .nav{display:none}
  }
</style>
</head>
<body>

<div class="stage">
${slides}
</div>

<div class="nav">
  <button id="prev" aria-label="Previous">&#8249;</button>
  <span class="count"><b id="cur">1</b> / <span id="tot"></span></span>
  <button id="next" aria-label="Next">&#8250;</button>
</div>

<script>
  var slides = document.querySelectorAll('.slide');
  var i = 0;
  document.getElementById('tot').textContent = slides.length;
  function show(n){
    i = Math.max(0, Math.min(slides.length - 1, n));
    for (var k = 0; k < slides.length; k++) slides[k].classList.toggle('on', k === i);
    document.getElementById('cur').textContent = i + 1;
    location.hash = i + 1;
  }
  document.getElementById('prev').onclick = function(){ show(i - 1); };
  document.getElementById('next').onclick = function(){ show(i + 1); };
  document.addEventListener('keydown', function(e){
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') show(i + 1);
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') show(i - 1);
    if (e.key === 'Home') show(0);
    if (e.key === 'End') show(slides.length - 1);
  });
  show(parseInt(location.hash.replace('#',''), 10) - 1 || 0);
</script>

</body>
</html>
`;
}

function downloadDeck() {
  const blob = new Blob([buildDeckHtml()], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lybi-banking-deck-suggested.html';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type Tab = 'deck' | 'notes' | 'suggested';
const TABS: { id: Tab; label: string }[] = [
  { id: 'deck', label: 'The deck' },
  { id: 'notes', label: 'Notes' },
  { id: 'suggested', label: 'Suggested version' },
];

export function LybiBankingDeckPage() {
  const [tab, setTab] = useState<Tab>('deck');
  const [idx, setIdx] = useState(0);

  // Arrow keys drive the suggested-version viewer, same as in the deck itself.
  useEffect(() => {
    if (tab !== 'suggested') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIdx(i => Math.min(PROPOSED.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setIdx(i => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab]);

  useEffect(() => {
    document.title = 'Banking Deck | Lybi';
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    const prev = document.body.style.background;
    document.body.style.background = BG;
    return () => { document.documentElement.style.overflow = ''; document.body.style.overflow = ''; document.body.style.background = prev; };
  }, []);

  return (
    <div className="lybiDeckPg" style={{ fontFamily: SANS, background: BG, color: TEXT, minHeight: '100vh', overflow: 'auto' }}>
      <style>{CSS}</style>

      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(10,4,32,0.92)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to="/lybi/knowledge" style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: MUTED, textDecoration: 'none', flexShrink: 0 }}>
            Lybi<span style={{ color: FAINT, fontWeight: 400 }}> · knowledge</span>
          </Link>
          <span style={{ color: BORDER }}>/</span>
          <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: WHITE, whiteSpace: 'nowrap' }}>Banking deck</span>
          <a href={DECK_URL} target="_blank" rel="noreferrer"
            style={{ marginInlineStart: 'auto', fontFamily: SANS, fontSize: 13, fontWeight: 600, color: WHITE, background: MAGENTA, borderRadius: 999, padding: '7px 16px', textDecoration: 'none', flexShrink: 0 }}>
            Open full screen ↗
          </a>
        </div>
      </nav>

      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '48px 24px 90px' }}>
        <div style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: MAGENTA, marginBottom: 16 }}>
          Lybi · Banking
        </div>
        <h1 style={{ fontFamily: SANS, fontSize: 40, fontWeight: 700, lineHeight: 1.15, color: WHITE, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
          The Conative AI platform for <span style={{ color: MAGENTA }}>high-value customer journeys.</span>
        </h1>
        <p style={{ fontFamily: SANS, fontSize: 16.5, lineHeight: 1.75, color: MUTED, margin: 0, maxWidth: 700 }}>
          Hila’s banking deck, live on the site. The notes and a suggested version sit alongside it.
        </p>

        {/* tabs */}
        <div style={{ marginTop: 36, borderBottom: `1px solid ${BORDER}`, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TABS.map(t => {
            const on = t.id === tab;
            return (
              <button key={t.id} className="tabBtn" onClick={() => setTab(t.id)}
                style={{
                  fontFamily: SANS, fontSize: 15, fontWeight: on ? 700 : 400,
                  color: on ? WHITE : FAINT, background: 'transparent',
                  border: 'none', borderBottom: `2px solid ${on ? MAGENTA : 'transparent'}`,
                  padding: '11px 4px', marginInlineEnd: 22, cursor: 'pointer', marginBottom: -1,
                }}>
                {t.label}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 28 }}>
          {tab === 'deck' && (
            <>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', minHeight: 420, background: PANEL2, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: 'hidden' }}>
                <iframe
                  src={DECK_URL}
                  title="Lybi Banking Deck"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                />
              </div>
              <p style={{ fontFamily: SANS, fontSize: 13.5, color: FAINT, margin: '14px 0 0' }}>
                All 14 slides, exactly as Hila built them. Click inside and use the arrows, or{' '}
                <a href={DECK_URL} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>open it full screen</a>.
              </p>
            </>
          )}

          {tab === 'notes' && (
            <div style={{ maxWidth: 780, paddingTop: 4 }}>
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 22 }}>
                {NOTES.map((n, i) => (
                  <li key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <span style={{ flexShrink: 0, fontFamily: MONO, fontSize: 12, fontWeight: 700, color: MAGENTA, paddingTop: 4 }}>{String(i + 1).padStart(2, '0')}</span>
                    <p style={{ fontFamily: SANS, fontSize: 15.5, lineHeight: 1.8, color: MUTED, margin: 0 }}>{n}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {tab === 'suggested' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                <p style={{ fontFamily: SANS, fontSize: 15, lineHeight: 1.75, color: FAINT, margin: 0, flex: '1 1 340px' }}>
                  Same argument and same order, with the notes applied. Slides marked{' '}
                  <span style={{ color: AMBER, fontWeight: 700 }}>changed</span> are the ones that differ.
                </p>
                <button onClick={downloadDeck}
                  style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700, color: WHITE, background: MAGENTA, border: 'none', borderRadius: 999, padding: '10px 20px', cursor: 'pointer', flexShrink: 0 }}>
                  ↓ Download as HTML
                </button>
              </div>

              <SlideStage s={PROPOSED[idx]} />

              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
                  style={{ fontFamily: SANS, fontSize: 18, color: idx === 0 ? BORDER : MUTED, background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 999, width: 36, height: 36, cursor: idx === 0 ? 'default' : 'pointer', lineHeight: 1 }}
                  aria-label="Previous slide">‹</button>
                <span style={{ fontFamily: MONO, fontSize: 13, color: FAINT }}>
                  <b style={{ color: WHITE }}>{idx + 1}</b> / {PROPOSED.length}
                </span>
                <button onClick={() => setIdx(i => Math.min(PROPOSED.length - 1, i + 1))} disabled={idx === PROPOSED.length - 1}
                  style={{ fontFamily: SANS, fontSize: 18, color: idx === PROPOSED.length - 1 ? BORDER : MUTED, background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 999, width: 36, height: 36, cursor: idx === PROPOSED.length - 1 ? 'default' : 'pointer', lineHeight: 1 }}
                  aria-label="Next slide">›</button>

                <div style={{ display: 'flex', gap: 6, marginInlineStart: 6, flexWrap: 'wrap' }}>
                  {PROPOSED.map((s, i) => (
                    <button key={s.n} onClick={() => setIdx(i)} aria-label={`Slide ${s.n}`}
                      title={s.kicker || `Slide ${s.n}`}
                      style={{ width: 9, height: 9, borderRadius: '50%', padding: 0, border: 'none', cursor: 'pointer', background: i === idx ? MAGENTA : BORDER }} />
                  ))}
                </div>
                <span style={{ fontFamily: SANS, fontSize: 12.5, color: FAINT, marginInlineStart: 'auto' }}>← → to move</span>
              </div>

              {PROPOSED[idx].note && (
                <div style={{ marginTop: 16, background: PANEL, border: `1px solid ${BORDER}`, borderInlineStart: `3px solid ${AMBER}`, borderRadius: 12, padding: '14px 18px', fontFamily: SANS, fontSize: 14, lineHeight: 1.7, color: MUTED }}>
                  <span style={{ color: AMBER, fontWeight: 700 }}>changed · </span>{PROPOSED[idx].note}
                </div>
              )}

              <p style={{ fontFamily: SANS, fontSize: 13.5, lineHeight: 1.7, color: FAINT, margin: '22px 0 0', maxWidth: 720 }}>
                The download is a single self-contained HTML file — same kind of thing as the original deck. Arrow keys to
                present, print to PDF puts one slide per page, and the source is one plain{' '}
                <code style={{ fontFamily: MONO, fontSize: 12.5, color: MUTED }}>&lt;section&gt;</code> per slide with the
                reason for each change left in as a comment, so it is easy to edit.
              </p>
            </div>
          )}
        </div>

        <div style={{ marginTop: 48, paddingTop: 22, borderTop: `1px solid ${BORDER}` }}>
          <Link to="/lybi/knowledge" style={{ fontFamily: SANS, fontSize: 14, color: PINK, textDecoration: 'none' }}>
            ← back to knowledge base
          </Link>
        </div>
      </div>
    </div>
  );
}
