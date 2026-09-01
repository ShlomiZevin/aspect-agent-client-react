/**
 * The ILLUSTRATED variant of the investor pitch (/aspect/investors-pitch-visual).
 *
 * WHAT THIS IS FOR. The real pitch at /aspect/investors-pitch has no imagery
 * on purpose — GPT-5.6 was asked directly and ruled it out, on the grounds
 * that abstract AI artwork would make it look like every other AI deck. That
 * decision stands and this page does not replace it. This variant exists to
 * show a marketing colleague the whole chain: the copy, the layout and the
 * artwork all produced end to end, with the pictures generated to the same
 * four-colour system rather than picked from a stock library.
 *
 * Structure, typography and the capability line are imported from the real
 * pitch's stylesheet, so the two cannot drift apart — only the image layers
 * live in this page's own module. Artwork is produced by
 * aspect-agent-server/scripts/generate-pitch-images.js into public/pitch/.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './WeAreYourAIPage.module.css';
import art from './WeAreYourAIVisual.module.css';

const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;700;800&display=swap';

function ensureFontsLoaded() {
  if (document.querySelector(`link[href="${FONTS_HREF}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = FONTS_HREF;
  document.head.appendChild(link);
}

const BEATS = ['We are your AI', 'The old rule', 'The foundation', 'So ask', 'Why now', 'The test'];

/** Slide 2 is the only bone-ground slide, so the ticks and label invert on it. */
const BONE_SLIDE = 1;

export function WeAreYourAIVisualPage() {
  const deckRef = useRef<HTMLDivElement | null>(null);
  const beatRefs = useRef<(HTMLElement | null)[]>([]);
  const [seen, setSeen] = useState<boolean[]>(() => BEATS.map(() => false));
  const [active, setActive] = useState(0);

  useEffect(() => {
    ensureFontsLoaded();
    const previousTitle = document.title;
    document.title = 'We are your AI — illustrated';
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

    const arrive = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const index = beats.indexOf(entry.target as HTMLElement);
          if (index >= 0) setSeen(prev => (prev[index] ? prev : prev.map((v, i) => (i === index ? true : v))));
        });
      },
      { root: deck, threshold: 0.3 },
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

    beats.forEach(beat => { arrive.observe(beat); track.observe(beat); });
    return () => { arrive.disconnect(); track.disconnect(); };
  }, []);

  const goTo = useCallback((index: number) => {
    beatRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const beatClass = (index: number, ...extra: (string | undefined)[]) =>
    [styles.beat, art.bg, seen[index] ? styles.seen : '', ...extra].filter(Boolean).join(' ');

  const setBeatRef = (index: number) => (el: HTMLElement | null) => { beatRefs.current[index] = el; };

  const ticksClass = [styles.ticks, active === BONE_SLIDE ? styles.ticksOnBone : ''].filter(Boolean).join(' ');

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


      {/* 1 — Identity. */}
      <section className={beatClass(0, art.bgHero)} ref={setBeatRef(0)}>
        <p className={styles.eyebrow}>Who we are</p>
        <h1 className={styles.heroSmall}>
          We are
          <span className={styles.heroBig}>your AI.</span>
        </h1>
        <p className={`${styles.copy} ${styles.heroBody}`}>
          Not a tool you learn. An AI that works for you. Tell it what the business needs. It builds the next
          report, screen, automation or internal system &mdash;{' '}
          <span className={styles.green}>on your data.</span>
        </p>
        <p className={`${styles.copy} ${styles.beachhead}`}>
          Retail first. The same wait exists anywhere a business runs on reports.
        </p>
        <div className={`${styles.line}`} />
      </section>

      {/* 2 — The old rule. */}
      <section className={beatClass(1, styles.onBone, art.bgWait)} ref={setBeatRef(1)}>
        <p className={styles.eyebrow}>The old rule</p>
        <h2 className={`${styles.head} ${styles.ruleHead}`}>Everything your business needs becomes a project.</h2>
        <p className={styles.alreadyBought}>You bought BI. You paid to customise software.</p>
        <p className={styles.cadence}>
          Still, every new need sends you back to a vendor or an analyst. A scope. A quote. A quarter.
        </p>
        <p className={styles.stopped}>So you stopped asking.</p>
        <p className={styles.waits}>WAITS.</p>
        <div className={`${styles.line} ${styles.lineStopped}`} />
      </section>

      {/* 3 — The foundation. */}
      <section className={beatClass(2, art.bgFoundation)} ref={setBeatRef(2)}>
        <p className={styles.eyebrow}>The foundation</p>
        <div className={styles.foundationTop}>
          <h2 className={`${styles.head} ${styles.foundationHead}`}>One foundation. Anything on top.</h2>
          <div className={styles.owned}>
            <span>Your tables.</span>
            <span>Your language.</span>
            <span>Your exceptions.</span>
            <span>The way you count.</span>
          </div>
        </div>
        <div className={styles.conclusion}>
          <p className={styles.once}>It learns the business once. Every build stands on that.</p>
          <p className={styles.split}>
            We make it capable.
            <b>It does the work.</b>
          </p>
        </div>
        <div className={`${styles.line} ${styles.lineHalf}`} />
      </section>

      {/* 4 — The release. */}
      <section className={beatClass(3, art.bgAsk)} ref={setBeatRef(3)}>
        <p className={styles.eyebrow}>The idea</p>
        <p className={styles.soAsk}>So ask.</p>
        <p className={styles.category}>Claude Code, for the business.</p>
        <p className={`${styles.copy} ${styles.widen}`}>
          AI changed the deal: ask for what you need and get it. It can build, not just answer. Your AI brings that
          freedom to the whole business &mdash; on its own data.
        </p>
        <p className={styles.examples}>A report. A screen. An automation. A whole system.</p>
        <p className={styles.demand}>
          No catalog. No roadmap. <b>What do you need?</b>
        </p>
        <div className={`${styles.line} ${styles.lineOpen}`} />
      </section>

      {/* 5 — Why now. */}
      <section className={beatClass(4, art.bgYes)} ref={setBeatRef(4)}>
        <p className={styles.eyebrow}>Why now</p>
        <div className={styles.whyNow}>
          <p className={`${styles.copy} ${styles.whyBody}`}>
            More requests used to mean more people, more months, less margin. So every vendor learned to say no and
            called it focus.
            <b>The AI does the building now.</b>
          </p>
          <div className={styles.yesWrap}>
            <span className={styles.yes}>YES</span>
            <p className={styles.scalesNow}>scales now.</p>
          </div>
        </div>
        <div className={`${styles.line} ${styles.lineOpen}`} />
      </section>

      {/* 6 — The dare. */}
      <section className={beatClass(5, art.bgDare)} ref={setBeatRef(5)}>
        <p className={styles.eyebrow}>The test</p>
        <h2 className={`${styles.head} ${styles.dareHead}`}>Ask it for something it has never built.</h2>
        <p className={`${styles.copy} ${styles.dareBody}`}>
          Every other vendor sells you what they already built. Yours builds what you ask for.
        </p>
        <p className={styles.bring}>Bring one real question.</p>
        <div className={`${styles.line} ${styles.lineOpen}`} />
      </section>
    </div>
  );
}
