/**
 * "We Are Your AI" — the six-beat narrative for investor and marketing
 * conversations. Story only: no logos, no metrics, no proof numbers.
 *
 * THE ACTOR IS THE AI, NEVER US. This is the load-bearing decision in the
 * copy. If "we" build what the customer asks for, an investor prices the
 * company as a services firm within thirty seconds of slide one and nothing
 * later undoes it. So the AI is the employee that does the work, and we are
 * the ones who make it capable of doing it — stated outright on slide 3.
 * Every sentence here keeps that division; passive voice ("it gets built")
 * quietly breaks it, so don't reintroduce it.
 *
 * Reads as slides on a screen and as a one-pager on scroll — the deck is its
 * own scroller (position:fixed in the stylesheet), so this route never has to
 * unwind the app's global overflow:hidden the way the other landing pages do.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './WeAreYourAIPage.module.css';

/** Same faces the Intelligence client ships, plus a mono for the answers. */
const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Public+Sans:wght@400;500;600&family=Schibsted+Grotesk:wght@500;700;800&display=swap';

function ensureFontsLoaded() {
  if (document.querySelector(`link[href="${FONTS_HREF}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = FONTS_HREF;
  document.head.appendChild(link);
}

/** The story's beats, in order — the top bar reads the current one back. */
const BEATS = [
  'We are your AI',
  'Everything is a project',
  'What we do',
  'So ask',
  'Why now',
  'The test',
];

/** The offer, as an ask/answer ledger: the ask in the grotesque, the answer in mono. */
const LEDGER = ['A report?', 'A screen?', 'An automation?', 'A whole system?'];

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

    // Two thresholds, two jobs: content reveals as soon as a beat is properly
    // on screen, but the top bar only moves once a beat actually dominates the
    // viewport — otherwise the label flickers between two beats mid-scroll.
    const reveal = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const index = beats.indexOf(entry.target as HTMLElement);
          if (index >= 0) setSeen(prev => (prev[index] ? prev : prev.map((v, i) => (i === index ? true : v))));
        });
      },
      { root: deck, threshold: 0.22 },
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

  const beatClass = (index: number, extra?: string) =>
    [styles.beat, seen[index] ? styles.seen : '', extra ?? ''].filter(Boolean).join(' ');

  const setBeatRef = (index: number) => (el: HTMLElement | null) => { beatRefs.current[index] = el; };

  return (
    <div className={styles.deck} ref={deckRef}>
      <header className={styles.bar}>
        <span className={styles.barLabel}>You ask. <b>It builds.</b></span>
        <nav className={styles.ticks} aria-label="Sections">
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
      </header>

      <section className={beatClass(0, styles.beatHero)} ref={setBeatRef(0)}>
        <div className={styles.inner}>
          <p className={`${styles.eyebrow} ${styles.rise}`}>Your AI</p>
          <h1 className={`${styles.head} ${styles.headHero} ${styles.rise}`}>We are your <em>AI</em>.</h1>
          <p className={`${styles.lede} ${styles.rise}`}>
            <strong>Not a tool you learn. An AI that works for you.</strong> You talk to it. It builds what your
            business needs &mdash; on your data.
          </p>
          <p className={`${styles.cue} ${styles.rise}`}>Two minutes</p>
        </div>
      </section>

      <section className={beatClass(1)} ref={setBeatRef(1)}>
        <div className={styles.inner}>
          <p className={`${styles.eyebrow} ${styles.rise}`}>The old rule</p>
          <h2 className={`${styles.head} ${styles.rise}`}>Everything you need is a <em>project</em>.</h2>
          <p className={`${styles.copy} ${styles.rise}`}>
            A scope. A quote. A quarter. Your software only answers the questions it was built to answer. Everything
            else waits. <strong>So you stopped asking.</strong>
          </p>
        </div>
      </section>

      <section className={beatClass(2)} ref={setBeatRef(2)}>
        <div className={styles.inner}>
          <p className={`${styles.eyebrow} ${styles.rise}`}>What we do</p>
          <h2 className={`${styles.head} ${styles.headWide} ${styles.rise}`}>
            Before you ask, it <em>already knows</em> your data.
          </h2>
          <p className={`${styles.copy} ${styles.rise}`}>
            That is our job. We connect your AI to the business and teach it &mdash; your tables, your language, your
            exceptions, the way you actually count. Once, up front.{' '}
            <strong>We make it capable. It does the work.</strong>
          </p>
        </div>
      </section>

      <section className={beatClass(3)} ref={setBeatRef(3)}>
        <div className={styles.inner}>
          <p className={`${styles.eyebrow} ${styles.rise}`}>The idea</p>
          <h2 className={`${styles.head} ${styles.rise}`}>So <em>ask</em>.</h2>
          <p className={`${styles.lede} ${styles.rise}`}>
            <strong>Claude Code, for the business.</strong> Developers got an open-ended builder for their code. Your
            business gets one for its data.
          </p>
          <div className={styles.ledger}>
            {LEDGER.map(ask => (
              <div className={styles.line} key={ask}>
                <span className={styles.ask}>{ask}</span>
                <span className={styles.leader} />
                <span className={styles.said}>It builds it</span>
              </div>
            ))}
          </div>
          <p className={`${styles.kicker} ${styles.rise}`}>
            No catalog. No roadmap. <i>Just: what do you need?</i>
          </p>
        </div>
      </section>

      <section className={beatClass(4)} ref={setBeatRef(4)}>
        <div className={styles.inner}>
          <p className={`${styles.eyebrow} ${styles.rise}`}>Why now</p>
          <h2 className={`${styles.head} ${styles.rise}`}>Now, saying yes <em>scales</em>.</h2>
          <p className={`${styles.copy} ${styles.rise}`}>
            More requests used to mean more people, more months, less margin. So every vendor learned to say no and
            called it focus. <strong>The AI does the building now.</strong> And every build makes the next one faster.
          </p>
        </div>
      </section>

      <section className={beatClass(5, styles.beatClose)} ref={setBeatRef(5)}>
        <div className={styles.inner}>
          <p className={`${styles.eyebrow} ${styles.rise}`}>The test</p>
          <h2 className={`${styles.head} ${styles.headWide} ${styles.rise}`}>
            Ask it for something it has <em>never built</em>.
          </h2>
          <p className={`${styles.stamp} ${styles.rise}`}>
            Every other vendor sells you what they already built. Yours builds what you ask for.
          </p>
          <p className={`${styles.stampNote} ${styles.rise}`}>
            Bring one real question to the next meeting. It will answer on your data, in the room.
          </p>
        </div>
      </section>
    </div>
  );
}
