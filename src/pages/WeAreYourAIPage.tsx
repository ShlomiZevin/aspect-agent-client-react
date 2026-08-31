/**
 * "We Are Your AI" — the six-slide investor narrative.
 *
 * THE ACTOR IS THE AI, NEVER US. This is the load-bearing decision in the
 * copy. If "we" build what the customer asks for, an investor prices the
 * company as a services firm within thirty seconds of slide one and nothing
 * later undoes it. So the AI is the employee that does the work, and we are
 * the ones who make it capable of doing it — stated outright on slide 3.
 * Passive voice ("it gets built") quietly breaks the same rule.
 *
 * NO TWO SLIDES SHARE A LAYOUT. Each one is composed for the single thing it
 * has to do: the problem slide stacks its toll one line at a time, the offer
 * slide is a full-bleed orange release, the turn slide inverts to black and
 * splits old cost from new fact. See the stylesheet header for the art
 * direction this follows (GPT-5.6 review, docs/marketing/).
 *
 * The deck is its own scroller (position:fixed in the stylesheet), so this
 * route never has to unwind the app's global overflow:hidden the way the
 * other landing pages do.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './WeAreYourAIPage.module.css';

/** One blunt grotesk, two weights. No mono anywhere in this deck. */
const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;800&display=swap';

function ensureFontsLoaded() {
  if (document.querySelector(`link[href="${FONTS_HREF}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = FONTS_HREF;
  document.head.appendChild(link);
}

const BEATS = ['We are your AI', 'The problem', 'What we do', 'So ask', 'Why now', 'The test'];

/** Slides 4 and 5 change ground colour, so the fixed ticks must change with them. */
const TONE: Record<number, 'orange' | 'dark'> = { 3: 'orange', 4: 'dark' };

export function WeAreYourAIPage() {
  const deckRef = useRef<HTMLDivElement | null>(null);
  const beatRefs = useRef<(HTMLElement | null)[]>([]);
  const [seen, setSeen] = useState<boolean[]>(() => BEATS.map(() => false));
  const [active, setActive] = useState(0);

  useEffect(() => {
    ensureFontsLoaded();
    const previousTitle = document.title;
    document.title = 'We are your AI';
    return () => { document.title = previousTitle; };
  }, []);

  useEffect(() => {
    const deck = deckRef.current;
    const beats = beatRefs.current.filter(Boolean) as HTMLElement[];
    if (!deck || beats.length === 0) return;

    if (!('IntersectionObserver' in window)) {
      setSeen(BEATS.map(() => true));
      return;
    }

    // Two thresholds, two jobs: the slide's own sequence starts as soon as it
    // is properly on screen, but the ticks and the ground colour only follow
    // once a slide dominates the viewport — otherwise both flicker mid-scroll.
    const reveal = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const index = beats.indexOf(entry.target as HTMLElement);
          if (index >= 0) setSeen(prev => (prev[index] ? prev : prev.map((v, i) => (i === index ? true : v))));
        });
      },
      { root: deck, threshold: 0.25 },
    );

    const track = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const index = beats.indexOf(entry.target as HTMLElement);
          if (index >= 0) setActive(index);
        });
      },
      { root: deck, threshold: 0.55 },
    );

    beats.forEach(beat => { reveal.observe(beat); track.observe(beat); });
    return () => { reveal.disconnect(); track.disconnect(); };
  }, []);

  const goTo = useCallback((index: number) => {
    beatRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const beatClass = (index: number, ...extra: (string | undefined)[]) =>
    [styles.beat, seen[index] ? styles.seen : '', ...extra].filter(Boolean).join(' ');

  const setBeatRef = (index: number) => (el: HTMLElement | null) => { beatRefs.current[index] = el; };

  const tone = TONE[active];
  const ticksClass = [
    styles.ticks,
    tone === 'orange' ? styles.ticksOnOrange : '',
    tone === 'dark' ? styles.ticksOnDark : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={styles.deck} ref={deckRef}>
      <nav className={ticksClass} aria-label="Slides">
        {BEATS.map((label, i) => (
          <button
            key={label}
            type="button"
            className={styles.tick}
            aria-label={label}
            aria-current={active === i ? 'true' : 'false'}
            onClick={() => goTo(i)}
          />
        ))}
      </nav>

      {/* 1 — Hero. Almost empty on purpose. The headline is the slide. */}
      <section className={beatClass(0)} ref={setBeatRef(0)}>
        <div className={styles.rule} />
        <p className={`${styles.eyebrow} ${styles.rise}`}>Your AI</p>
        <h1 className={`${styles.head} ${styles.headHero} ${styles.rise}`}>We are your <em>AI</em>.</h1>
        <p className={`${styles.heroLede} ${styles.rise}`}>
          <strong>Not a tool you learn. An AI that works for you.</strong> You talk to it. It builds what your
          business needs.
        </p>
        <p className={styles.cue}>Two minutes</p>
      </section>

      {/* 2 — The problem. The toll lands one line at a time; the verdict sits
          alone at the bottom in orange. The bureaucracy is the picture. */}
      <section className={beatClass(1)} ref={setBeatRef(1)}>
        <div className={styles.rule} />
        <p className={`${styles.eyebrow} ${styles.rise}`}>The problem</p>
        <h2 className={`${styles.head} ${styles.rise}`}>You asked for a report. You got a <em>project</em>.</h2>
        <div className={styles.toll}>
          <span className={styles.tollLine}>A scope.</span>
          <span className={styles.tollLine}>A quote.</span>
          <span className={styles.tollLine}>A quarter.</span>
        </div>
        <p className={styles.verdict}>So you stopped asking.</p>
      </section>

      {/* 3 — What we do. "YOUR DATA." is the largest thing on screen, and the
          four things it learned hold up the slide from the bottom rule. */}
      <section className={beatClass(2)} ref={setBeatRef(2)}>
        <div className={styles.rule} />
        <p className={`${styles.eyebrow} ${styles.rise}`}>What we do</p>
        <h2 className={`${styles.head} ${styles.headFoundation} ${styles.rise}`}>
          Before you ask, it already knows <span className={styles.biggest}>your data.</span>
        </h2>
        <p className={`${styles.copy} ${styles.rise}`}>
          That is our job, and we do it once. <strong>We make it capable. It does the work.</strong>
        </p>
        <div className={styles.footing}>
          <span>Tables</span>
          <span>Language</span>
          <span>Exceptions</span>
          <span>The way you count</span>
        </div>
      </section>

      {/* 4 — The release. Full-bleed orange, black type, one BUILT. */}
      <section className={beatClass(3, styles.onOrange)} ref={setBeatRef(3)}>
        <div className={styles.rule} />
        <p className={`${styles.eyebrow} ${styles.rise}`}>The idea</p>
        <h2 className={`${styles.head} ${styles.headBlast} ${styles.rise}`}>So ask.</h2>
        <p className={`${styles.asks} ${styles.rise}`}>
          A report. A screen. An automation. A whole system.
        </p>
        <p className={styles.built}>It builds it.</p>
        <p className={styles.kicker}>
          No catalog. No roadmap. <b>Just: what do you need?</b>
        </p>
      </section>

      {/* 5 — The turn. Inverted to black; the old cost sits low and grey on the
          left, the new fact answers it in orange on the right. */}
      <section className={beatClass(4, styles.onDark)} ref={setBeatRef(4)}>
        <div className={styles.rule} />
        <p className={`${styles.eyebrow} ${styles.rise}`}>Why now</p>
        <h2 className={`${styles.head} ${styles.rise}`}>Now, saying yes <em>scales</em>.</h2>
        <div className={styles.turn}>
          <div className={styles.wasCost}>
            <span>Headcount.</span>
            <span>Months.</span>
            <span>Margin death.</span>
          </div>
          <p className={styles.nowFact}>The AI does the building now.</p>
        </div>
      </section>

      {/* 6 — The finale. The emptiest slide in the deck. Hold it. */}
      <section className={beatClass(5, styles.beatFinale)} ref={setBeatRef(5)}>
        <div className={styles.rule} />
        <p className={`${styles.eyebrow} ${styles.rise}`}>The test</p>
        <h2 className={`${styles.head} ${styles.headFinale} ${styles.rise}`}>
          Ask it for something it has <em>never built</em>.
        </h2>
        <p className={styles.closer}>
          Bring one real question to the next meeting. It will answer on your data, in the room.
        </p>
      </section>
    </div>
  );
}
