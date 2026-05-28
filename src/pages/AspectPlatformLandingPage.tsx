import { useEffect, useRef } from 'react';
import styles from './AspectPlatformLandingPage.module.css';

/* ===== Aspect — Investor Q&A Cheat Sheet =====
 * Presenter-facing reference Itzik keeps open during investor calls.
 * Minimal editorial layout: white background, single sparse orange
 * accent, hierarchy carried by typography rather than card chrome.
 * Two questions, each with: a lead line to say out loud, talking
 * points, a compact grid of advantages, and comebacks if pushed.
 */

function useScrollReveal() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const timer = setTimeout(() => {
      const elements = container.querySelectorAll(`.${styles.reveal}`);
      if (elements.length === 0) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add(styles.revealVisible);
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
      );

      elements.forEach((el) => observer.observe(el));
      (container as unknown as { __observer?: IntersectionObserver }).__observer = observer;
    }, 50);

    return () => {
      clearTimeout(timer);
      const obs = (container as unknown as { __observer?: IntersectionObserver }).__observer;
      if (obs) obs.disconnect();
    };
  }, []);

  return containerRef;
}

function Nav() {
  return (
    <nav className={styles.nav}>
      <div className={styles.navContent}>
        <a
          href="#top"
          className={styles.navLogo}
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 700,
            fontSize: '20px',
            color: '#0F172A',
            textDecoration: 'none',
            lineHeight: 1.1,
          }}
        >
          Aspect<span style={{ color: '#EA580C' }}>.</span>
          <span
            style={{
              display: 'block',
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#94A3B8',
              marginTop: '2px',
            }}
          >
            Investor · Cheat Sheet
          </span>
        </a>
        <div className={styles.navRight}>
          <div className={styles.navLinks}>
            <a href="#q1" className={styles.navLink}>Q1 · Claude</a>
            <a href="#q2" className={styles.navLink}>Q2 · Value</a>
          </div>
          <button className={styles.printBtn} onClick={() => window.print()}>Print</button>
        </div>
      </div>
    </nav>
  );
}

export function AspectPlatformLandingPage() {
  const revealRef = useScrollReveal();
  const anchorOffset = { scrollMarginTop: '90px' };

  useEffect(() => {
    document.title = 'Aspect — Investor Q&A Cheat Sheet';

    document.documentElement.style.overflow = 'auto';
    document.documentElement.style.height = 'auto';
    document.documentElement.style.scrollBehavior = 'smooth';
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    const root = document.getElementById('root');
    if (root) {
      root.style.overflow = 'auto';
      root.style.height = 'auto';
    }

    return () => {
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
      document.documentElement.style.scrollBehavior = '';
      document.body.style.overflow = '';
      document.body.style.height = '';
      if (root) {
        root.style.overflow = '';
        root.style.height = '';
      }
    };
  }, []);

  return (
    <div className={`${styles.container} ${styles.v3}`} ref={revealRef} id="top">
      <Nav />

      <div className={styles.v3PageContent}>
        {/* Intro */}
        <section className={styles.csSection}>
          <div className={`${styles.csInner} ${styles.reveal}`}>
            <p className={styles.csIntroEyebrow}>Investor · Cheat Sheet</p>
            <h1 className={styles.csH1}>Two questions. Two straight answers.</h1>
            <p className={styles.csIntroLead}>
              The two an investor actually asks about a product like ours. Below: the line to lead
              with, the points to land, and the comebacks if they push.
            </p>

            <div className={styles.anchorStrip}>
              <p className={styles.anchorLabel}>What it is</p>
              <p className={styles.anchorText}>
                An AI system that lets a company ask its own business data questions in plain
                English and get <strong>analyst-grade answers and analysis — not just retrieval</strong>.
                Under the hood: a multi-agent crew, a natural-language-to-SQL engine, a
                schema/data-model builder, and a heavy-query optimizer that builds a warehouse.{' '}
                <strong>Claude does the hard reasoning; our engineering makes it reliable.</strong>
              </p>
            </div>
          </div>
        </section>

        <hr className={styles.csDivider} />

        {/* Q1 */}
        <section id="q1" className={styles.csSection} style={anchorOffset}>
          <div className={`${styles.csInner} ${styles.reveal}`}>
            <div className={styles.qHead}>
              <p className={styles.qLabel}>Q1 — The Claude question</p>
              <h2>"Can't I just connect Claude to my own data?"</h2>
            </div>

            <div className={styles.sayThis}>
              <p className={styles.sayThisQuote}>
                There is no such thing as "connecting Claude to your data." Claude is a tool —
                anyone could always build anything, before Claude too. The moat is the system, not
                the model.
              </p>
            </div>

            <p className={styles.subLabel}>Talking points</p>
            <ul className={styles.pointsList}>
              <li className={styles.pointItem}>
                <strong>A model is not a system.</strong> Wiring a prompt to a database gets you a
                demo that lies confidently — not a platform you can run a company on.
              </li>
              <li className={styles.pointItem}>
                <strong>Access to the model was never the constraint.</strong> The system is. That
                was true before LLMs existed.
              </li>
              <li className={styles.pointItem}>
                <strong>Claude is an amplifier, not a shortcut.</strong> Build well &rarr; 10x faster.
                Don't &rarr; garbage 10x faster.
              </li>
              <li className={styles.pointItem}>
                <strong>We use Claude where it's strongest</strong> — turning language into correct
                SQL. The model is an input; we could swap it tomorrow.
              </li>
            </ul>

            <p className={styles.subLabel}>What they'd actually have to build</p>
            <div className={styles.csGrid}>
              <div className={styles.csCard}>
                <h3>Language &rarr; correct SQL</h3>
                <p>Joins, types, edge cases — right every time. Engineering, not a prompt.</p>
              </div>
              <div className={styles.csCard}>
                <h3>A schema built to be asked</h3>
                <p>Raw databases store; they don't answer. We model the data so questions map cleanly.</p>
              </div>
              <div className={styles.csCard}>
                <h3>Heavy questions, instant</h3>
                <p>Pre-compute and warehouse what matters — hard analyses still return in seconds.</p>
              </div>
              <div className={styles.csCard}>
                <h3>A system of agents</h3>
                <p>Specialists for analytics, data, orchestration. One generalist is not a product.</p>
              </div>
            </div>

            <p className={styles.subLabel}>If they push back</p>
            <div className={styles.pushQa}>
              <p className={styles.pushQ}>"The model keeps getting better and cheaper."</p>
              <p className={styles.pushA}>
                Good — we ride that for free. A better model makes our system better. It doesn't{' '}
                <strong>build</strong> the system.
              </p>
            </div>
            <div className={styles.pushQa}>
              <p className={styles.pushQ}>"Couldn't a big team just build this themselves?"</p>
              <p className={styles.pushA}>
                Yes — in a year or two. That year <strong>is</strong> the moat, and we're already
                running it on real customer data.
              </p>
            </div>
            <div className={styles.pushQa}>
              <p className={styles.pushQ}>"Isn't this just a wrapper around an LLM?"</p>
              <p className={styles.pushA}>
                The reasoning is one component we command. Schema modeling, SQL correctness, the
                query optimizer, the warehouse, the agent orchestration — all ours. Swap the model:
                the company stands.
              </p>
            </div>
          </div>
        </section>

        <hr className={styles.csDivider} />

        {/* Q2 */}
        <section id="q2" className={styles.csSection} style={anchorOffset}>
          <div className={`${styles.csInner} ${styles.reveal}`}>
            <div className={styles.qHead}>
              <p className={styles.qLabel}>Q2 — The value question</p>
              <h2>"How do we measure the value to the customer?"</h2>
            </div>

            <div className={styles.sayThis}>
              <p className={styles.sayThisQuote}>
                We sell answers. The value is the spread between what an answer costs today and what
                it costs with us — measured per question, from day one.
              </p>
            </div>

            <p className={styles.subLabel}>Three axes</p>
            <div className={`${styles.csGrid} ${styles.csGrid3}`}>
              <div className={styles.csCard}>
                <p className={styles.csAxis}>Money</p>
                <h3>Cost displaced</h3>
                <p>$120–180k/yr analyst, hours-to-days per question → seconds at near-zero marginal cost.</p>
              </div>
              <div className={styles.csCard}>
                <p className={styles.csAxis}>Speed</p>
                <h3>Decision velocity</h3>
                <p>Days to seconds. Faster decisions compound across every team that touches data.</p>
              </div>
              <div className={styles.csCard}>
                <p className={styles.csAxis}>Leverage</p>
                <h3>Questions actually asked</h3>
                <p>Most never get asked — too expensive. Drop the cost to zero → 10x more. Not substitution. Expansion.</p>
              </div>
            </div>

            <div className={styles.exampleBox}>
              <p className={styles.exampleTag}>Worked example — quotable</p>
              <p className={styles.exampleText}>
                A <span className={styles.exNum}>10-analyst team &asymp; $1.5M/yr</span> answers{' '}
                <span className={styles.exNum}>~40 substantive questions a week</span> with days of
                latency. Free 40% of that capacity &rarr; <span className={styles.exPop}>~$600k/yr displaced</span>{' '}
                + <span className={styles.exPop}>10x throughput</span>, latency cut to seconds.
              </p>
            </div>

            <p className={styles.subLabel}>The kicker</p>
            <p className={styles.exampleText}>
              Every query is logged with its <strong style={{ color: '#0F172A' }}>counterfactual cost</strong>.
              We don't argue ROI on a slide — we show the customer a <strong style={{ color: '#0F172A' }}>live ROI meter</strong>.
              Usage is the proof.
            </p>

            <p className={styles.subLabel}>If they push back</p>
            <div className={styles.pushQa}>
              <p className={styles.pushQ}>"Soft savings — analysts don't actually get fired."</p>
              <p className={styles.pushA}>
                They don't need to. The same team answers 10x more questions. That's{' '}
                <strong>capacity created</strong>, measured in questions per week — visible in the meter.
              </p>
            </div>
            <div className={styles.pushQa}>
              <p className={styles.pushQ}>"How is this different from a BI dashboard?"</p>
              <p className={styles.pushA}>
                A dashboard answers the question someone predicted last quarter. We answer the one
                being asked right now — including the ones nobody built a chart for.
              </p>
            </div>
          </div>
        </section>

        {/* Closing — quiet single line */}
        <div className={styles.csClosing}>
          <p className={styles.csClosingText}>
            The model is the commodity.{' '}
            <span className={styles.csClosingDim}>The system is the company.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
