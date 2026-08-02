/**
 * BrainViz — Noa's "cognitive processing" panel (Live Brain Shell mockup).
 * A framed panel like every other one in the brain: head, body, footer. The
 * body is the reasoning animation — a breathing spiral core, two
 * counter-rotating orbit rings, expanding pulse rings, six synapse rays and
 * six labelled nodes that light in sequence around it.
 *
 * Purely decorative: no data, no LLM. It sits first in the panel list and
 * says "she is thinking" while the real panels fill in below.
 */

import { useState } from 'react';
import s from './BrainViz.module.css';

/** The six things Lybi is doing — verbs, not topics. They light one after
 *  another around the core, so the ring reads as a thought in motion. */
const LABELS: Record<'he' | 'en', string[]> = {
  he: ['קוראת', 'מבינה', 'מכריעה', 'בונה', 'פועלת', 'זוכרת'],
  en: ['Reading', 'Understanding', 'Deciding', 'Building', 'Acting', 'Remembering'],
};
const TITLE: Record<'he' | 'en', string> = {
  he: 'עיבוד קוגניטיבי',
  en: 'Cognitive processing',
};

// Noa's node placement: six seats on an 88×76 hexagon around the core, each
// lighting one second after the last across a 6s loop.
const NODES = [
  { x: 88, y: 0 }, { x: 44, y: 76 }, { x: -44, y: 76 },
  { x: -88, y: 0 }, { x: -44, y: -76 }, { x: 44, y: -76 },
];

// Her drifting particles — hand-placed, not generated, so the field reads as
// composed rather than random.
const MOTES = [
  { top: '23%', left: '15%', size: 4, color: '#E0198A', dur: 5.0, delay: 0 },
  { top: '60%', left: '46%', size: 3, color: '#8A2290', dur: 6.3, delay: 0.7 },
  { top: '27%', left: '77%', size: 2, color: '#F060B0', dur: 7.6, delay: 1.4 },
  { top: '64%', left: '24%', size: 3, color: '#B07BE8', dur: 8.9, delay: 2.1 },
  { top: '31%', left: '55%', size: 2, color: '#F060B0', dur: 5.0, delay: 2.8 },
  { top: '68%', left: '86%', size: 3, color: '#8A2290', dur: 6.3, delay: 3.5 },
  { top: '35%', left: '33%', size: 4, color: '#E0198A', dur: 7.6, delay: 4.2 },
  { top: '72%', left: '64%', size: 3, color: '#8A2290', dur: 8.9, delay: 4.9 },
];

export function BrainViz({ lang = 'he' }: { lang?: 'he' | 'en' }) {
  const [open, setOpen] = useState(true);
  const labels = LABELS[lang] ?? LABELS.he;
  const title = TITLE[lang] ?? TITLE.he;

  return (
    <section className={s.panel}>
      <button type="button" className={s.head} onClick={() => setOpen(o => !o)}>
        <span className={s.icon} aria-hidden>
          <img src="/img/lybi-spiral.png" alt="" />
        </span>
        <span className={s.title}>{title}</span>
        <span className={s.spacer} />
        <span className={`${s.chev} ${open ? s.chevOpen : ''}`} aria-hidden>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {open && (
        <>
          <div className={s.viz} aria-hidden>
            <span className={s.glow} />

            {MOTES.map((m, i) => (
              <span
                key={`mote-${i}`}
                className={s.mote}
                style={{
                  top: m.top, left: m.left, width: m.size, height: m.size,
                  background: m.color, animationDuration: `${m.dur}s`, animationDelay: `${m.delay}s`,
                }}
              />
            ))}

            <span className={s.stage}>
              <span className={`${s.orbit} ${s.orbitOuter}`} />
              <span className={`${s.orbit} ${s.orbitInner}`} />
              <span className={s.pulse} />
              <span className={`${s.pulse} ${s.pulseB}`} />

              {NODES.map((_, i) => (
                <span
                  key={`syn-${i}`}
                  className={s.synapse}
                  style={{ transform: `rotate(${i * 60}deg)`, animationDelay: `${i}s` }}
                />
              ))}

              <span className={s.core}>
                <img src="/img/lybi-spiral.png" alt="" />
              </span>

              {NODES.map((n, i) => (
                <span
                  key={`node-${i}`}
                  className={s.node}
                  style={{ left: `calc(50% + ${n.x}px)`, top: `calc(50% + ${n.y}px)` }}
                >
                  <span className={s.mark}>
                    <span className={s.halo} style={{ animationDelay: `${i}s` }} />
                    <span className={s.dot} style={{ animationDelay: `${i}s` }} />
                  </span>
                  <span className={s.label} style={{ animationDelay: `${i}s` }}>{labels[i]}</span>
                </span>
              ))}
            </span>
          </div>

          <div className={s.foot}>
            <span className={s.footMono} dir="ltr">LYBI · REASONING</span>
            <span className={s.footText}>{title}</span>
          </div>
        </>
      )}
    </section>
  );
}
