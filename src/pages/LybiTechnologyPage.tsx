import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Lybi technology page — the Adaptive Reasoning Runtime (ARR).
 * Technical, wow-first flows. Each subsystem opens a deep-dive modal.
 * Grounded in Builder V2 (crews → Cortex → a chain of addons), not V1.
 */

const MONO = "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const BG = '#0A0D13';
const PANEL = '#0F141C';
const PANEL2 = '#0C1017';
const BORDER = '#1B2430';
const TEXT = '#C9D1D9';
const MUTED = '#8B949E';
const FAINT = '#7C8794';
const TEAL = '#56D4DD';
const GREEN = '#7EE787';
const AMBER = '#E3B341';
const PURPLE = '#C89BE8';

type Tone = 'teal' | 'green' | 'purple' | 'amber' | 'muted';
const TONES: Record<Tone, { fg: string; bd: string; bg: string }> = {
  teal:   { fg: TEAL,   bd: 'rgba(86,212,221,0.4)',   bg: 'rgba(86,212,221,0.07)' },
  green:  { fg: GREEN,  bd: 'rgba(126,231,135,0.4)',  bg: 'rgba(126,231,135,0.07)' },
  purple: { fg: PURPLE, bd: 'rgba(200,155,232,0.45)', bg: 'rgba(200,155,232,0.09)' },
  amber:  { fg: AMBER,  bd: 'rgba(227,179,65,0.4)',   bg: 'rgba(227,179,65,0.07)' },
  muted:  { fg: MUTED,  bd: BORDER,                    bg: PANEL },
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
  return <span style={{ color: dim ? '#68727F' : '#9AA4B0', fontSize: 18, fontWeight: 700, flexShrink: 0, margin: '0 1px' }}>→</span>;
}
function Chip({ children, tone = 'teal' }: { children: React.ReactNode; tone?: Tone }) {
  const t = TONES[tone];
  return <span style={{ fontFamily: MONO, fontSize: 11.5, color: t.fg, background: t.bg, border: `1px solid ${t.bd}`, borderRadius: 999, padding: '4px 10px' }}>{children}</span>;
}
function Head({ n, title, onDeep }: { n: string; title: string; onDeep?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
      <span style={{ fontFamily: MONO, fontSize: 12, color: TEAL, fontWeight: 600 }}>{n}</span>
      <h2 style={{ fontFamily: MONO, fontSize: 17, fontWeight: 600, color: TEXT, margin: 0 }}>{title}</h2>
      {onDeep && (
        <button onClick={onDeep} style={{ marginInlineStart: 'auto', fontFamily: MONO, fontSize: 11, color: TEAL, background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = TEAL; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}>
          details ↗
        </button>
      )}
    </div>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: SANS, fontSize: 14.5, lineHeight: 1.8, color: MUTED, margin: '0 0 14px', maxWidth: 760 }}>{children}</p>;
}
const strong = { color: TEXT, fontWeight: 600 } as const;
const em = { color: TEXT, fontStyle: 'normal' } as const;

// ─── Deep-dive modal ──────────────────────────────────────────────
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
const DEEP: Record<string, { title: string; tag: string; render: () => React.ReactNode }> = {
  chain: {
    title: 'The reasoning chain',
    tag: 'cortex',
    render: () => (
      <>
        <P>A conversation stage is a <strong style={strong}>crew</strong>. Each crew runs a <strong style={strong}>Cortex</strong> —
          an ordered <strong style={strong}>chain of steps (addons)</strong>. A step is a self-contained unit with its own
          model, prompt, and configuration; it can infer a signal, pull knowledge, reason, plan, route, or speak. There is
          no fixed shape — a domain composes as many steps as it needs.</P>
        <DSec title="Three lanes">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[['blocking', 'the response waits for it', 'purple'], ['background', 'runs per message, never blocks the reply', 'teal'], ['offline', 'fires on a trigger after the reply (summaries, profiling)', 'amber']].map(([l, d, t]) => (
              <div key={l} style={{ display: 'flex', gap: 12, alignItems: 'baseline', background: PANEL2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px' }}>
                <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: TONES[t as Tone].fg, minWidth: 90 }}>{l}</span>
                <span style={{ fontFamily: SANS, fontSize: 13, color: MUTED }}>{d}</span>
              </div>
            ))}
          </div>
        </DSec>
        <DSec title="Step kinds — examples, not a fixed set">
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {['Field Extractor', 'Vibe Extractor', 'Field Reasoner', 'KB Retriever', 'Thinker', 'Talker', 'Summarizer', 'Transition Router'].map(s => <Chip key={s} tone="purple">{s}</Chip>)}
          </div>
        </DSec>
        <DSec title="Depth follows the domain">
          <FlowRow>
            <Node label="FAQ" tone="muted" sub="2 steps" /><Arrow />
            <Node label="onboarding" tone="teal" sub="a few" /><Arrow />
            <Node label="clinical / financial" tone="purple" sub="many steps" />
          </FlowRow>
          <p style={{ fontFamily: SANS, fontSize: 12.5, color: FAINT, margin: '10px 0 0' }}>Stacking many narrow, specialized steps is what produces depth a single prompt can’t reach.</p>
        </DSec>
      </>
    ),
  },
  signals: {
    title: 'Signals',
    tag: 'inferred state',
    render: () => (
      <>
        <P>A <strong style={strong}>signal</strong> is structured state the system <em style={em}>inferred</em> from the
          conversation — stage, intent, sentiment, goals — most of which the user never says outright. Signals are stored
          as <strong style={strong}>fields, grouped by domain</strong>, in a shared memory that persists across the whole
          conversation and across crews.</P>
        <DSec title="How it’s inferred">
          <FlowRow>
            <Node label="conversation" tone="muted" /><Arrow />
            <Node label="extractor steps" tone="purple" sub="read meaning · parallel" /><Arrow />
            <Node label="signals" tone="teal" sub="fields by domain" />
          </FlowRow>
          <p style={{ fontFamily: SANS, fontSize: 12.5, color: FAINT, margin: '10px 0 0' }}>Extractors run in parallel with the reply on a buffered stream; each is an addon with its own model and behavior.</p>
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
      </>
    ),
  },
  sag: {
    title: 'SAG — knowledge that switches on by itself',
    tag: 'active knowledge',
    render: () => (
      <>
        <P>A domain holds far more knowledge than fits in a single prompt — so, exactly like any knowledge base, the agent
          must pull in only the <strong style={strong}>relevant piece</strong> for the moment, never everything at once. The
          real question is <em style={em}>what decides which piece</em>.</P>

        <DSec title="RAG — triggered by your words">
          <div style={{ background: PANEL2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '3px 9px' }}>RAG</span>
              <Node label="you ask" tone="muted" sub="you raise the topic" /><Arrow /><Node label="it retrieves" tone="muted" sub="finds the matching piece" /><Arrow /><Node label="it answers" tone="muted" sub="replies with that piece" />
            </div>
            <p style={{ fontFamily: SANS, fontSize: 13, color: MUTED, margin: '12px 0 0', lineHeight: 1.6 }}>It brings the right piece — but only if you bring up the topic. Miss it, and it stays silent.</p>
          </div>
        </DSec>

        <DSec title="SAG — triggered by what we detect">
          <div style={{ background: 'linear-gradient(180deg, rgba(126,231,135,0.07), transparent)', border: `1px solid ${TONES.green.bd}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: GREEN, border: `1px solid ${TONES.green.bd}`, borderRadius: 6, padding: '3px 9px' }}>SAG</span>
              <Node label="we detect" tone="teal" sub="signals read the state" /><Arrow /><Node label="we inject" tone="green" sub="add the matching piece" /><Arrow /><Node label="it answers" tone="amber" sub="already knows it" />
            </div>
            <p style={{ fontFamily: SANS, fontSize: 13, color: MUTED, margin: '12px 0 0', lineHeight: 1.6 }}>Same selective injection — but <strong style={strong}>our own mechanism spots the moment</strong> and brings the right knowledge on its own, before you ask.</p>
          </div>
        </DSec>

        <DSec title="How it works">
          <P>As you talk, our <strong style={strong}>signals</strong> identify the event or state you’re in — a stage, a
            concern, a decision point — most of which you never say outright. Our targeted knowledge base holds the domain as{' '}
            <strong style={strong}>modules, one per state</strong>. We inject <em style={em}>only the matching module</em> into
            that turn’s prompt — the right knowledge, exactly when it matters, without loading the rest.</P>
          <FlowRow>
            <Node label="detect: stage = peri" tone="teal" sub="from your signals" /><Arrow />
            <Node label="inject the “peri” module" tone="green" /><Arrow />
            <Node label="in this turn’s answer" tone="amber" />
          </FlowRow>
        </DSec>

        <DSec title="One knowledge base, many modules">
          <P>The full domain expertise, split into modules that switch on and off by state — so the agent carries a{' '}
            <strong style={strong}>different, focused playbook for every situation</strong> instead of one bloated prompt.
            Detecting the moment and injecting exactly the right knowledge for it is one of our strongest capabilities.</P>
        </DSec>
      </>
    ),
  },
  lcs: {
    title: 'Live Context Synthesis',
    tag: 'per-turn prompt',
    render: () => (
      <>
        <P>The agent has no fixed prompt. On every message, its whole operating context is <strong style={strong}>assembled
          from scratch</strong> out of the current signals.</P>
        <DSec title="Assembled per turn">
          <FlowRow>
            <Node label="persona" tone="purple" /><span style={{ color: FAINT }}>+</span>
            <Node label="memory" tone="teal" /><span style={{ color: FAINT }}>+</span>
            <Node label="activated knowledge" tone="green" /><span style={{ color: FAINT }}>+</span>
            <Node label="reasoning" tone="purple" /><Arrow />
            <Node label="this turn’s prompt" tone="amber" />
          </FlowRow>
        </DSec>
        <DSec title="Token grammar (resolved live)">
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {['{{persona}}', '{{field:NAME}}', '{{targetedkb:NAME}}', '{{dc:FIELD:SECTION}}', '{{summary}}'].map(t => <Chip key={t} tone="teal">{t}</Chip>)}
          </div>
        </DSec>
        <DSec title="Combinatorial, not enumerable">
          <P>Because it’s built from independent signal dimensions, the context space is combinatorial — not a finite set of
            authored graph nodes. It <strong style={strong}>never runs the same agent twice</strong>. This is more than
            templating: templating fills slots in a static prompt; ARR recomposes <em style={em}>which</em> knowledge and
            sections even exist.</P>
        </DSec>
      </>
    ),
  },
};

function DeepModal({ dkey, onClose }: { dkey: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  const d = DEEP[dkey];
  if (!d) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(3,5,8,0.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 20px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 720, background: BG, border: `1px solid ${BORDER}`, borderRadius: 16, boxShadow: '0 24px 70px rgba(0,0,0,0.6)' }}>
        <div style={{ position: 'sticky', top: 0, background: BG, borderBottom: `1px solid ${BORDER}`, borderRadius: '16px 16px 0 0', padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h3 style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, color: TEXT, margin: 0 }}>{d.title}</h3>
            <span style={{ fontFamily: MONO, fontSize: 11, color: FAINT }}>· {d.tag}</span>
          </div>
          <button onClick={onClose} style={{ fontFamily: MONO, fontSize: 16, color: MUTED, background: 'transparent', border: 'none', cursor: 'pointer', lineHeight: 1 }} aria-label="Close">✕</button>
        </div>
        <div style={{ padding: '10px 22px 26px' }}>{d.render()}</div>
      </div>
    </div>
  );
}

export function LybiTechnologyPage() {
  const [deep, setDeep] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Runtime · Technology | Lybi';
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    const prev = document.body.style.background;
    document.body.style.background = BG;
    return () => { document.documentElement.style.overflow = ''; document.body.style.overflow = ''; document.body.style.background = prev; };
  }, []);

  return (
    <div style={{ fontFamily: SANS, background: BG, color: TEXT, minHeight: '100vh', overflow: 'auto' }}>
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(10,13,19,0.9)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 920, margin: '0 auto', padding: '13px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/lybi/knowledge" style={{ fontFamily: MONO, fontSize: 13, color: MUTED, textDecoration: 'none' }}>
            <span style={{ color: TEAL }}>~/</span>lybi<span style={{ color: FAINT }}> · knowledge</span>
          </Link>
          <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: TEAL, border: `1px solid ${BORDER}`, padding: '4px 10px', borderRadius: 4 }}>Runtime</span>
        </div>
      </nav>

      <div style={{ maxWidth: 920, margin: '0 auto', padding: '56px 24px 100px' }}>
        <h1 style={{ fontFamily: MONO, fontSize: 34, fontWeight: 700, lineHeight: 1.2, color: TEXT, margin: '0 0 18px', letterSpacing: '-0.01em' }}>
          Adaptive Reasoning Runtime
        </h1>
        <p style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.85, color: MUTED, margin: 0, maxWidth: 780 }}>
          An LLM is <strong style={strong}>autocomplete</strong> — brilliant at the next word, blind to the whole. Every
          agent platform hides that by boxing the model into a fixed flowchart. We do the opposite: for each turn, Lybi
          composes a <strong style={strong}>live chain of specialized reasoning steps</strong> — as deep as the domain needs —
          driven by what it infers about the person. That is what makes autocomplete <strong style={strong}>reason, react,
          and adjust</strong> instead of just answer.
        </p>

        {/* 01 · The shift */}
        <section style={{ marginTop: 56 }}>
          <Head n="01" title="The shift" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px 20px 22px' }}>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT, marginBottom: 16 }}>Everyone else · static graph</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Node label="node" dim /><Arrow dim /><Node label="node" dim /><Arrow dim /><Node label="node" dim />
              </div>
              <p style={{ fontFamily: SANS, fontSize: 12.5, lineHeight: 1.65, color: FAINT, margin: '16px 0 0' }}>
                The LLM is boxed into small, fixed steps. It never sees the whole picture — hard to give it depth, freedom, or real reactivity.
              </p>
            </div>
            <div style={{ background: 'linear-gradient(180deg, rgba(200,155,232,0.06), rgba(86,212,221,0.04))', border: `1px solid ${TONES.purple.bd}`, borderRadius: 14, padding: '20px 20px 22px' }}>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: PURPLE, marginBottom: 16 }}>Lybi · live reasoning chain</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Node label="signals" tone="teal" /><Arrow />
                <Node label="reason" tone="purple" /><Arrow />
                <Node label="activate KB" tone="green" /><Arrow />
                <Node label="…" tone="purple" sub="as deep as needed" /><Arrow />
                <Node label="reply" tone="amber" />
              </div>
              <p style={{ fontFamily: SANS, fontSize: 12.5, lineHeight: 1.65, color: MUTED, margin: '16px 0 0' }}>
                <strong style={strong}>Rebuilt every turn</strong> from what the system infers — the agent holds the whole picture and adapts to each person.
              </p>
            </div>
          </div>
        </section>

        {/* 02 · The chain */}
        <section style={{ marginTop: 56 }}>
          <Head n="02" title="A reasoning chain — as deep as the domain needs" onDeep={() => setDeep('chain')} />
          <P>
            Each conversation stage runs a <strong style={strong}>chain of specialized steps</strong>. A step can infer a
            signal, pull knowledge, reason, plan, or speak — and a domain uses <strong style={strong}>as many as it needs</strong>,
            not a fixed two. Nothing is generic: every step has its own model and behavior, tuned for the job.
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
              {[['own model per step', 'the right model for each job'], ['fully configured', 'nothing hardcoded or generic'], ['depth = domain', 'shallow chat or deep expert']].map(([a, b]) => (
                <div key={a} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: MONO, fontSize: 12.5, color: TEXT, fontWeight: 600 }}>{a}</div>
                  <div style={{ fontFamily: SANS, fontSize: 11.5, color: FAINT, marginTop: 3 }}>{b}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 03 · Signals */}
        <section style={{ marginTop: 56 }}>
          <Head n="03" title="Signals — it reads what you don’t say" onDeep={() => setDeep('signals')} />
          <P>
            As you talk, the chain continuously <strong style={strong}>infers structured state</strong> — stage, intent,
            sentiment, and more — most of which the user never says outright. This inferred state is the{' '}
            <em style={em}>signal</em> that drives everything downstream: which knowledge activates, how the agent reasons,
            where the conversation goes next.
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
        </section>

        {/* 04 · SAG */}
        <section style={{ marginTop: 56 }}>
          <Head n="04" title="SAG — a knowledge base that doesn’t wait to be asked" onDeep={() => setDeep('sag')} />
          <P>
            Every KB and every RAG system is <strong style={strong}>query-driven</strong>: you ask, it searches, it answers.
            If you never mention the topic, nothing surfaces. Ours is <strong style={strong}>signal-driven</strong> — the right
            knowledge activates from what the system <em style={em}>infers</em>, before you ask, even when you never said a word about it.
          </P>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
            <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px' }}>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT, marginBottom: 16 }}>RAG · reactive</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Node label="you ask" dim /><Arrow dim /><Node label="search" dim /><Arrow dim /><Node label="answer" dim />
              </div>
              <p style={{ fontFamily: SANS, fontSize: 12.5, color: FAINT, margin: '15px 0 0' }}>Never mentioned it? Nothing surfaces.</p>
            </div>
            <div style={{ background: 'linear-gradient(180deg, rgba(126,231,135,0.06), rgba(86,212,221,0.03))', border: `1px solid ${TONES.green.bd}`, borderRadius: 14, padding: '20px' }}>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: GREEN, marginBottom: 16 }}>SAG · anticipatory</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Node label="signals" tone="teal" /><Arrow /><Node label="activate" tone="green" /><Arrow /><Node label="right knowledge" tone="green" />
              </div>
              <p style={{ fontFamily: SANS, fontSize: 12.5, color: MUTED, margin: '15px 0 0' }}>Surfaces what you need — <strong style={strong}>before you ask</strong>.</p>
            </div>
          </div>
        </section>

        {/* 05 · Rebuilt every turn */}
        <section style={{ marginTop: 56 }}>
          <Head n="05" title="Rebuilt every turn" onDeep={() => setDeep('lcs')} />
          <P>
            The agent has no fixed prompt and no fixed states. Its whole context — persona, memory, the knowledge just
            activated, the reasoning so far — is <strong style={strong}>assembled fresh on every message</strong> from the
            current signals. Built from independent signals, the space is combinatorial: it <strong style={strong}>never runs
            the same agent twice</strong>.
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
        </section>

        {/* 06 · Stack */}
        <section style={{ marginTop: 56 }}>
          <Head n="06" title="Stack" />
          <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '18px 20px', fontFamily: MONO, fontSize: 12.5, lineHeight: 2, color: TEXT }}>
            <div><span style={{ color: FAINT }}>runtime{'  '}</span> Node 22 · Express 5 · live token streaming (SSE)</div>
            <div><span style={{ color: FAINT }}>models{'   '}</span> multi-provider router → OpenAI · Anthropic · Google <span style={{ color: FAINT }}>(+ fallback)</span></div>
            <div><span style={{ color: FAINT }}>knowledge</span> Pinecone vector index · signal-gated modules (SAG)</div>
            <div><span style={{ color: FAINT }}>state{'    '}</span> PostgreSQL — memory, signals, context, versions</div>
            <div><span style={{ color: FAINT }}>authoring</span> Builder V2 · React 19 + TypeScript</div>
          </div>
        </section>

        <div style={{ marginTop: 48, paddingTop: 20, borderTop: `1px solid ${BORDER}` }}>
          <Link to="/lybi/knowledge" style={{ fontFamily: MONO, fontSize: 13, color: TEAL, textDecoration: 'none' }}>
            ← back to knowledge base
          </Link>
        </div>
      </div>

      {deep && <DeepModal dkey={deep} onClose={() => setDeep(null)} />}
    </div>
  );
}
