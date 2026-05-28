import { useEffect, useRef } from 'react';
import styles from './AspectPlatformLandingPage.module.css';

/* ===== Aspect — Sales Battle Card =====
 * Salesperson-facing cheat sheet for live discovery calls.
 * Same minimal editorial layout as the investor cheat sheet
 * (forked from AspectPlatformLandingPage); content shifts from
 * an investor frame to a buyer-objection frame.
 * Two objections, each with: the line to lead with, talking
 * points, a compact grid of supports, comebacks. A retail
 * worked example anchors the ROI conversation in concrete numbers.
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
            Sales · Battle Card
          </span>
        </a>
        <div className={styles.navRight}>
          <div className={styles.navLinks}>
            <a href="#q1" className={styles.navLink}>Q1 · Claude</a>
            <a href="#q2" className={styles.navLink}>Q2 · ROI</a>
            <a href="#example" className={styles.navLink}>Example</a>
          </div>
          <button className={styles.printBtn} onClick={() => window.print()}>Print</button>
        </div>
      </div>
    </nav>
  );
}

export function AspectPlatformSalesPage() {
  const revealRef = useScrollReveal();
  const anchorOffset = { scrollMarginTop: '90px' };

  useEffect(() => {
    document.title = 'Aspect — Sales Battle Card';

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
            <p className={styles.csIntroEyebrow}>Sales · Battle Card</p>
            <h1 className={styles.csH1}>Two objections. Two ways to land it.</h1>
            <p className={styles.csIntroLead}>
              The two questions every prospect raises in the first call. Below: the line to lead
              with, the points to land, the comebacks if they push — and a retail worked example
              with real numbers you can quote.
            </p>

            <div className={styles.anchorStrip}>
              <p className={styles.anchorLabel}>What you're selling</p>
              <p className={styles.anchorText}>
                An AI system that lets a company ask its own business data questions in plain
                English and get <strong>analyst-grade answers and analysis — not just retrieval</strong>.
                Under the hood: a multi-agent crew, a natural-language-to-SQL engine, a
                schema/data-model builder, and a heavy-query optimizer that builds a warehouse on
                the fly. <strong>Claude does the reasoning; our engineering makes it reliable.</strong>
              </p>
            </div>
          </div>
        </section>

        <hr className={styles.csDivider} />

        {/* Q1 */}
        <section id="q1" className={styles.csSection} style={anchorOffset}>
          <div className={`${styles.csInner} ${styles.reveal}`}>
            <div className={styles.qHead}>
              <p className={styles.qLabel}>Objection 1 — The Claude question</p>
              <h2>"Why do I need you? I can just plug Claude into my data."</h2>
            </div>

            <div className={styles.sayThis}>
              <p className={styles.sayThisQuote}>
                There is no such thing as "plugging Claude into your data." Claude is a tool —
                anyone could always build anything, before Claude too. What you're buying isn't the
                model. It's the system that makes the model trustworthy on your business.
              </p>
            </div>

            <p className={styles.subLabel}>Talking points</p>
            <ul className={styles.pointsList}>
              <li className={styles.pointItem}>
                <strong>A model is not a system.</strong> Wiring a prompt to a database gets you a
                demo that lies confidently — not a platform you can run a P&amp;L meeting on.
              </li>
              <li className={styles.pointItem}>
                <strong>Access to the model was never the constraint.</strong> Anyone can call
                Claude. The hard part — the part that takes months and a real team — is the system
                around it.
              </li>
              <li className={styles.pointItem}>
                <strong>Claude is an amplifier, not a shortcut.</strong> Build well &rarr; 10x faster.
                Don't &rarr; you ship garbage 10x faster. The question is who's doing the building.
              </li>
              <li className={styles.pointItem}>
                <strong>We use Claude where it's strongest</strong> — turning language into correct
                SQL, summarizing, reasoning. The model is one input. We could swap it tomorrow and
                the product still stands.
              </li>
              <li className={styles.pointItem}>
                <strong>Time is the real cost.</strong> A team that tries to build this in-house
                spends 12–18 months getting to a demo that hallucinates on edge cases. You can be
                live next quarter.
              </li>
            </ul>

            <p className={styles.subLabel}>What they'd actually have to build themselves</p>
            <div className={styles.csGrid}>
              <div className={styles.csCard}>
                <h3>Language &rarr; correct SQL</h3>
                <p>Joins, type casts, NULL handling, edge cases — right every time. Engineering, not a prompt.</p>
              </div>
              <div className={styles.csCard}>
                <h3>A schema built to be asked</h3>
                <p>Raw databases store; they don't answer. We re-model the data so questions map cleanly.</p>
              </div>
              <div className={styles.csCard}>
                <h3>Heavy questions, instant</h3>
                <p>Pre-compute and warehouse what matters — multi-million-row analyses still return in seconds.</p>
              </div>
              <div className={styles.csCard}>
                <h3>A crew of specialist agents</h3>
                <p>Analytics, data lookup, planning, orchestration. One generalist chatbot is not a product.</p>
              </div>
            </div>

            <p className={styles.subLabel}>If they push back</p>
            <div className={styles.pushQa}>
              <p className={styles.pushQ}>"Our IT team is sharp — they'll just spin it up."</p>
              <p className={styles.pushA}>
                Great team, wrong problem. They'll get a chatbot in 2 weeks. They'll spend 18 months
                making it not lie. That gap is what you're paying us to skip — and we're already
                running on real customer data.
              </p>
            </div>
            <div className={styles.pushQa}>
              <p className={styles.pushQ}>"Claude keeps getting better and cheaper."</p>
              <p className={styles.pushA}>
                Good — we ride that for free. A better model makes our system better. It doesn't{' '}
                <strong>build</strong> the system. Schema modeling, SQL correctness, the warehouse,
                the agent orchestration — none of that comes from a model upgrade.
              </p>
            </div>
            <div className={styles.pushQa}>
              <p className={styles.pushQ}>"Isn't this just a wrapper around an LLM?"</p>
              <p className={styles.pushA}>
                The model is one component we command. The schema builder, SQL generator, query
                optimizer, warehouse, agent crew — all ours. Swap the model: the product stands.
                That's not a wrapper. That's the product.
              </p>
            </div>
          </div>
        </section>

        <hr className={styles.csDivider} />

        {/* Q2 */}
        <section id="q2" className={styles.csSection} style={anchorOffset}>
          <div className={`${styles.csInner} ${styles.reveal}`}>
            <div className={styles.qHead}>
              <p className={styles.qLabel}>Objection 2 — The ROI question</p>
              <h2>"Show me how this actually makes me money."</h2>
            </div>

            <div className={styles.sayThis}>
              <p className={styles.sayThisQuote}>
                You can't wire a dollar sign directly to a chatbot — and you shouldn't trust anyone
                who claims otherwise. What you can measure is the cost of every answer today,
                and how much of it we remove. The profit is the spread.
              </p>
            </div>

            <p className={styles.subLabel}>How to frame it</p>
            <ul className={styles.pointsList}>
              <li className={styles.pointItem}>
                <strong>Reports built on the fly.</strong> Every ad-hoc analysis you used to scope,
                ticket, build, review, and revise — gone. The cost of that report is now seconds.
              </li>
              <li className={styles.pointItem}>
                <strong>Questions you'd never have asked.</strong> Most analyses never happen — too
                expensive. Drop the cost to zero and suddenly your team explores 10x the surface.
                That's where the non-obvious insights come from.
              </li>
              <li className={styles.pointItem}>
                <strong>Hints the data won't volunteer.</strong> The system flags margin drift, dead
                SKUs, suspicious clusters, declining cohorts. The buyer didn't know to ask — we
                surface it.
              </li>
              <li className={styles.pointItem}>
                <strong>Faster decisions compound.</strong> Days to seconds across every team that
                touches data. Every meeting that used to wait on a report now runs with the answer
                in the room.
              </li>
            </ul>

            <p className={styles.subLabel}>The three levers (use these on the call)</p>
            <div className={`${styles.csGrid} ${styles.csGrid3}`}>
              <div className={styles.csCard}>
                <p className={styles.csAxis}>Cost out</p>
                <h3>Analyst hours displaced</h3>
                <p>Reports, slide pulls, weekly prep — work that used to take days now takes minutes.</p>
              </div>
              <div className={styles.csCard}>
                <p className={styles.csAxis}>Margin in</p>
                <h3>Hidden leaks caught</h3>
                <p>Margin drift, dead stock, mispriced SKUs, churning cohorts — surfaced before they compound.</p>
              </div>
              <div className={styles.csCard}>
                <p className={styles.csAxis}>Capacity</p>
                <h3>Questions actually asked</h3>
                <p>The 80% of analyses that never get scoped because they're too small to justify. Now they run.</p>
              </div>
            </div>
          </div>
        </section>

        <hr className={styles.csDivider} />

        {/* Retail worked example */}
        <section id="example" className={styles.csSection} style={anchorOffset}>
          <div className={`${styles.csInner} ${styles.reveal}`}>
            <div className={styles.qHead}>
              <p className={styles.qLabel}>Worked example — retail, quotable</p>
              <h2>MetroFresh: 38-store grocery chain, $72M annual revenue</h2>
            </div>

            <p className={styles.exampleText}>
              A mid-sized retail chain. 12,400 active SKUs. Category managers run a weekly
              merchandising review. Before Aspect, prep takes <span className={styles.exNum}>two
              analysts &asymp; 24 hours/week</span> pulling reports from three systems.
            </p>

            <p className={styles.subLabel}>What changed in the first 90 days</p>
            <div className={styles.csGrid}>
              <div className={styles.csCard}>
                <p className={styles.csAxis}>Found</p>
                <h3>184 margin-drift SKUs</h3>
                <p>
                  Asked once: "Which SKUs lost &gt;15% margin over the last 60 days but stayed in
                  active rotation?" Answer in <strong>8 seconds</strong>. Never previously asked —
                  too expensive to scope.
                </p>
              </div>
              <div className={styles.csCard}>
                <p className={styles.csAxis}>Recovered</p>
                <h3>~$340k/yr margin</h3>
                <p>
                  84 of those SKUs repriced or delisted within two weeks. Direct margin recovery,
                  audited against POS data the quarter after.
                </p>
              </div>
              <div className={styles.csCard}>
                <p className={styles.csAxis}>Freed up</p>
                <h3>$580k working capital</h3>
                <p>
                  Dead-stock ratio dropped from <strong>2.1% &rarr; 1.4%</strong> of inventory after
                  the system flagged 60-day non-movers store-by-store.
                </p>
              </div>
              <div className={styles.csCard}>
                <p className={styles.csAxis}>Reclaimed</p>
                <h3>23 analyst-hours/week</h3>
                <p>
                  Weekly prep dropped from <strong>24h &rarr; 1h</strong>. Same team now answers ~6x
                  more questions per week. Capacity created, not headcount cut.
                </p>
              </div>
            </div>

            <p className={styles.subLabel}>The non-obvious insight (use this story)</p>
            <p className={styles.exampleText}>
              Halfway through Q2, a category manager asked: <em>"Which jam SKUs are losing share
              to private label, and where?"</em> The system answered in 11 seconds — and noted that
              <strong> the loss is concentrated in 9 stores serving younger demographics</strong>,
              while elderly-customer stores stayed loyal. That's a store-level pricing strategy
              nobody would have authored a report to discover. <span className={styles.exPop}>That
              one question paid for the year.</span>
            </p>

            <div className={styles.exampleBox}>
              <p className={styles.exampleTag}>The ROI line (quotable on the call)</p>
              <p className={styles.exampleText}>
                In the first 90 days at MetroFresh: <span className={styles.exNum}>~$920k in
                margin and working capital recovered</span>, <span className={styles.exNum}>23
                analyst-hours/week reclaimed</span>, and <span className={styles.exPop}>at least
                one insight per month that the team didn't know to ask for</span>. Annualized,
                the system pays for itself inside <span className={styles.exPop}>one quarter</span>.
              </p>
            </div>

            <p className={styles.subLabel}>If they push back</p>
            <div className={styles.pushQa}>
              <p className={styles.pushQ}>"Those numbers sound too clean."</p>
              <p className={styles.pushA}>
                Fair. The ranges in your business will differ — but every query in our platform is
                logged with its <strong>counterfactual cost</strong>. After 30 days you don't argue
                ROI on a slide; you read it from the meter.
              </p>
            </div>
            <div className={styles.pushQa}>
              <p className={styles.pushQ}>"My analysts aren't getting fired — those hours don't convert to cash."</p>
              <p className={styles.pushA}>
                They don't need to. The same team answers <strong>6x more questions</strong>. That's
                capacity created — measured in decisions made per week, not headcount removed. The
                margin and dead-stock wins above are <strong>separate</strong> from the labor line.
              </p>
            </div>
            <div className={styles.pushQa}>
              <p className={styles.pushQ}>"We already have a BI dashboard for this."</p>
              <p className={styles.pushA}>
                A dashboard answers the question someone predicted last quarter. We answer the one
                being asked <strong>right now</strong> — including the ones nobody built a chart
                for. That's where the jam-SKU insight came from. No dashboard would have surfaced it.
              </p>
            </div>
            <div className={styles.pushQa}>
              <p className={styles.pushQ}>"What about data security and SOC2?"</p>
              <p className={styles.pushA}>
                The system runs in your cloud or ours, on your existing data warehouse — no data
                leaves the boundary you choose. Full audit log per query. Happy to walk security
                through it in a follow-up call.
              </p>
            </div>
          </div>
        </section>

        {/* Closing — quiet single line */}
        <div className={styles.csClosing}>
          <p className={styles.csClosingText}>
            You're not selling a chatbot.{' '}
            <span className={styles.csClosingDim}>You're selling the answers their business is
            already paying for — at a fraction of the cost.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
