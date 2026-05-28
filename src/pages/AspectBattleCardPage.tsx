import { useEffect, useRef } from 'react';
import styles from './AspectBattleCardPage.module.css';

/* ===== Aspect Platform — Digital Battle Card =====
 * Internal sales-enablement page at /aspect-marketing.
 * Audience: account executives, solution engineers, sales leadership.
 * Purpose: a cheat-sheet that arms the seller to close the deal by
 * neutralizing the two objections that actually kill enterprise AI deals.
 *
 * This is NOT a consumer-facing marketing page. The two objection blocks
 * are the focal point of the page — everything else exists to support them.
 */

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = root.querySelectorAll(`.${styles.reveal}`);
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add(styles.revealIn);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

/* ===== Reusable bits ===== */

function ClassifiedBadge() {
  return (
    <div className={styles.classified}>
      <span className={styles.classifiedDot} />
      <span className={styles.classifiedText}>SALES ENABLEMENT &middot; INTERNAL USE</span>
    </div>
  );
}

function SectionLabel({ index, label }: { index: string; label: string }) {
  return (
    <div className={styles.sectionLabel}>
      <span className={styles.sectionIndex}>{index}</span>
      <span className={styles.sectionLine} />
      <span className={styles.sectionTitle}>{label}</span>
    </div>
  );
}

/* ===== Nav ===== */

function Nav() {
  return (
    <nav className={styles.nav}>
      <div className={styles.navInner}>
        <a href="#top" className={styles.brand}>
          <span className={styles.brandMark}>
            <span className={styles.brandDotA} />
            <span className={styles.brandDotB} />
          </span>
          <span className={styles.brandText}>
            <span className={styles.brandName}>Aspect</span>
            <span className={styles.brandSub}>Battle Card</span>
          </span>
        </a>
        <div className={styles.navLinks}>
          <a href="#objections" className={styles.navLink}>The Two Objections</a>
          <a href="#scenario" className={styles.navLink}>Live Scenario</a>
          <a href="#platform" className={styles.navLink}>Platform</a>
          <a href="#cheat" className={styles.navLink}>Cheat Sheet</a>
        </div>
      </div>
    </nav>
  );
}

/* ===== Hero ===== */

function Hero() {
  return (
    <header id="top" className={styles.hero}>
      <div className={styles.heroGrid} aria-hidden="true" />
      <div className={styles.heroGlow} aria-hidden="true" />
      <div className={styles.heroInner}>
        <ClassifiedBadge />
        <h1 className={styles.heroTitle}>
          <span className={styles.heroLine1}>The Aspect Platform</span>
          <span className={styles.heroLine2}>Battle Card</span>
        </h1>
      </div>
    </header>
  );
}

/* ===== The Two Objections (focal point of the page) ===== */

function ObjectionsBlock() {
  return (
    <section id="objections" className={`${styles.section} ${styles.objectionsSection}`}>
      <SectionLabel index="01" label="The Two Objections That Close The Deal" />

      <div className={styles.objections}>
        {/* OBJECTION 1 */}
        <article className={`${styles.objection} ${styles.reveal}`}>
          <div className={styles.objHeader}>
            <span className={styles.objNum}>01</span>
            <span className={styles.objTag}>The &ldquo;just buy Claude&rdquo; objection</span>
          </div>

          <h2 className={styles.objQuestion}>
            &ldquo;Why do I need you when I can just get Claude
            and connect it to my database?&rdquo;
          </h2>

          <div className={styles.objHeadlineAnswer}>
            <span className={styles.answerKicker}>Land this in 15 seconds</span>
            <p className={styles.answerHeadline}>
              Claude is an engine. It is not a vehicle.
              An engine bolted to a database without architecture
              is not a product &mdash; it is technical debt with a chat interface.
            </p>
          </div>

          <div className={styles.objBody}>
            <div className={styles.talkingPoints}>
              <h4 className={styles.tpTitle}>Talking points</h4>
              <ul className={styles.tpList}>
                <li>
                  <strong>The &ldquo;AI magic&rdquo; myth.</strong> There is no prompt that
                  safely connects an LLM to enterprise data. Schemas drift, joins explode,
                  PII leaks, costs balloon. The hard part is everything that surrounds the model.
                </li>
                <li>
                  <strong>We use Claude too.</strong> Aspect runs on Claude for the heavy lifting
                  &mdash; including natural-language-to-SQL. We are not competing with the model.
                  We are the production stack that makes the model safe to point at a real business.
                </li>
                <li>
                  <strong>Build vs. buy math.</strong> An internal team can absolutely wire a
                  chat box to Postgres in a weekend. Scaling that to 200 tables, real users,
                  governance, latency budgets, and trustworthy answers is an 18-month rebuild
                  &mdash; and most teams ship version one as unmaintainable tech debt.
                </li>
                <li>
                  <strong>Aspect is the orchestration layer.</strong> Multi-agent routing,
                  schema understanding, query planning, performance caching, audit, guardrails.
                  Teams ship in weeks instead of quarters, and answers stay accurate as the
                  business evolves.
                </li>
              </ul>
            </div>

            <div className={styles.proofCard}>
              <span className={styles.proofKicker}>Reframe in the room</span>
              <p className={styles.proofQuote}>
                &ldquo;Sure &mdash; and you could also pour jet fuel into a sedan.
                The fuel is not the problem. We sell the airplane that knows
                how to use it without crashing into your data warehouse.&rdquo;
              </p>
              <div className={styles.proofGrid}>
                <div>
                  <span className={styles.proofStat}>10&times;</span>
                  <span className={styles.proofLabel}>faster to first answer</span>
                </div>
                <div>
                  <span className={styles.proofStat}>0</span>
                  <span className={styles.proofLabel}>prompts to maintain</span>
                </div>
                <div>
                  <span className={styles.proofStat}>~18 mo</span>
                  <span className={styles.proofLabel}>internal rebuild avoided</span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.objFooter}>
            <span className={styles.objFooterLabel}>If they push back</span>
            <p className={styles.objFooterText}>
              Ask them: <em>&ldquo;Who on your team owns the schema graph,
              the query optimizer, and the agent routing &mdash; today, in production?&rdquo;</em>
              Silence is the answer. That silence is what Aspect is.
            </p>
          </div>
        </article>

        {/* OBJECTION 2 */}
        <article className={`${styles.objection} ${styles.reveal}`}>
          <div className={styles.objHeader}>
            <span className={styles.objNum}>02</span>
            <span className={styles.objTag}>The &ldquo;prove the ROI&rdquo; objection</span>
          </div>

          <h2 className={styles.objQuestion}>
            &ldquo;How can I calculate or measure
            the exact profit your application will provide?&rdquo;
          </h2>

          <div className={styles.objHeadlineAnswer}>
            <span className={styles.answerKicker}>Land this in 15 seconds</span>
            <p className={styles.answerHeadline}>
              Measure time-to-insight and the cost of the analyst hours
              you are <em>not</em> burning. Then add the value of the insights
              you would never have found at all.
            </p>
          </div>

          <div className={styles.objBody}>
            <div className={styles.talkingPoints}>
              <h4 className={styles.tpTitle}>Talking points</h4>
              <ul className={styles.tpList}>
                <li>
                  <strong>Direct attribution is the wrong lens.</strong> Nobody can directly
                  attribute a quarter of revenue to a single dashboard. That has never been
                  the question for BI. It is not the question for AI either.
                </li>
                <li>
                  <strong>Measure resource deflection.</strong> Every report Aspect answers
                  on the fly is a ticket that did not go to BI, engineering, or data science.
                  Most customers see 60&ndash;80% of routine ad-hoc requests resolved without
                  filing a ticket.
                </li>
                <li>
                  <strong>Measure time-to-insight.</strong> Five-day analyst turnaround becomes
                  forty-five seconds. The CFO who can ask a question and get an answer in the
                  same meeting makes different decisions than the CFO who has to wait until
                  Tuesday.
                </li>
                <li>
                  <strong>Measure inferred value.</strong> The multi-agent crew surfaces profit
                  leaks, anomalies, and second-order patterns no one was looking for.
                  You cannot pre-calculate the ROI on an insight you did not know existed
                  &mdash; but you can absolutely book the savings once it does.
                </li>
              </ul>
            </div>

            <div className={styles.proofCard}>
              <span className={styles.proofKicker}>Reframe in the room</span>
              <p className={styles.proofQuote}>
                &ldquo;If I asked you to ROI your BI team line by line,
                you couldn&rsquo;t either &mdash; but you would never fire them.
                Aspect compounds that same team. The math is the same;
                the multiplier is bigger.&rdquo;
              </p>
              <div className={styles.proofGrid}>
                <div>
                  <span className={styles.proofStat}>45s</span>
                  <span className={styles.proofLabel}>vs. 5-day BI ticket</span>
                </div>
                <div>
                  <span className={styles.proofStat}>70%</span>
                  <span className={styles.proofLabel}>fewer ad-hoc tickets</span>
                </div>
                <div>
                  <span className={styles.proofStat}>&infin;</span>
                  <span className={styles.proofLabel}>insights you&rsquo;d never ask for</span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.objFooter}>
            <span className={styles.objFooterLabel}>If they push back</span>
            <p className={styles.objFooterText}>
              Offer the 30-day baseline: <em>&ldquo;Pick three questions your business
              actually waited on last quarter. We&rsquo;ll answer them in front of you.
              You tell us what that would have cost without us.&rdquo;</em>
              They quote you the ROI themselves.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}

/* ===== Scenario ===== */

function ScenarioBlock() {
  return (
    <section id="scenario" className={`${styles.section} ${styles.scenarioSection}`}>
      <SectionLabel index="02" label="Live Scenario &mdash; Friday, 4:47 PM" />

      <div className={`${styles.scenarioFrame} ${styles.reveal}`}>
        <div className={styles.scenarioHeader}>
          <div className={styles.scenarioMeta}>
            <span className={styles.scenarioTag}>Mid-market retailer &middot; 41 stores &middot; 3 DCs</span>
            <span className={styles.scenarioTag}>VP Operations &middot; Slack DM to CFO</span>
          </div>
          <p className={styles.scenarioPrompt}>
            &ldquo;Why are returns spiking in the Southwest region this week?
            I need an answer before Monday&rsquo;s board call.&rdquo;
          </p>
        </div>

        <div className={styles.scenarioCompare}>
          <div className={styles.scenarioCol}>
            <div className={styles.scenarioColHead}>
              <span className={styles.scenarioColLabel}>Without Aspect</span>
              <span className={styles.scenarioColStatus}>BI ticket, manual pull</span>
            </div>
            <ol className={styles.scenarioSteps}>
              <li>
                <span className={styles.stepTime}>Friday 5:02 PM</span>
                <span className={styles.stepText}>Analyst files a Jira ticket against the data team.</span>
              </li>
              <li>
                <span className={styles.stepTime}>Monday 9:30 AM</span>
                <span className={styles.stepText}>Ticket triaged. Slot found Wednesday.</span>
              </li>
              <li>
                <span className={styles.stepTime}>Wednesday</span>
                <span className={styles.stepText}>Analyst writes joins across orders, returns, SKUs, DCs, suppliers.</span>
              </li>
              <li>
                <span className={styles.stepTime}>Thursday</span>
                <span className={styles.stepText}>First chart lands. VP asks the obvious follow-up. Loop again.</span>
              </li>
              <li>
                <span className={styles.stepTime}>Following Monday</span>
                <span className={styles.stepText}>Board meeting. Answer is partial. Decision is deferred.</span>
              </li>
            </ol>
            <div className={styles.scenarioCost}>
              <span className={styles.costLabel}>Cost</span>
              <span className={styles.costVal}>~14 analyst hours &middot; 1 week of bleed</span>
            </div>
          </div>

          <div className={`${styles.scenarioCol} ${styles.scenarioColAspect}`}>
            <div className={styles.scenarioColHead}>
              <span className={styles.scenarioColLabel}>With Aspect</span>
              <span className={styles.scenarioColStatus}>Multi-agent crew, 47 seconds</span>
            </div>
            <ol className={styles.scenarioSteps}>
              <li>
                <span className={styles.stepTime}>0s</span>
                <span className={styles.stepText}>
                  <strong>Analytics Agent</strong> parses the question, identifies the metric,
                  delegates the data pull.
                </span>
              </li>
              <li>
                <span className={styles.stepTime}>4s</span>
                <span className={styles.stepText}>
                  <strong>Schema Builder</strong> resolves a return-rate view across orders,
                  returns, SKUs, DCs &mdash; no hand-written joins.
                </span>
              </li>
              <li>
                <span className={styles.stepTime}>11s</span>
                <span className={styles.stepText}>
                  <strong>NL&rarr;SQL</strong> produces the query.
                  <strong> Long Query Assistance</strong> stages a temporary warehouse
                  so the scan finishes in seconds, not minutes.
                </span>
              </li>
              <li>
                <span className={styles.stepTime}>28s</span>
                <span className={styles.stepText}>
                  Spike isolated to <strong>one SKU</strong> at <strong>DC-West</strong>.
                  Cross-referenced with supplier batch <code>#A-2241</code> &mdash; a packaging defect.
                </span>
              </li>
              <li>
                <span className={styles.stepTime}>47s</span>
                <span className={styles.stepText}>
                  <strong>Data Assistance Agent</strong> recommends rerouting that SKU
                  through DC-Central until batch <code>#A-2241</code> is exhausted.
                  Estimated avoided loss: <strong>$48K / week</strong>.
                </span>
              </li>
            </ol>
            <div className={styles.scenarioCost}>
              <span className={styles.costLabel}>Outcome</span>
              <span className={styles.costVal}>14 analyst hours saved &middot; $48K/week bleed stopped &middot; decision made Friday</span>
            </div>
          </div>
        </div>

        <div className={styles.scenarioPunchline}>
          <span className={styles.punchKicker}>The point</span>
          <p>
            Aspect did not just retrieve data. It <em>planned</em> &mdash; it noticed
            a bottleneck, traced it to a root cause, and suggested a resource reallocation.
            That is the difference between a chat box and an operational intelligence platform.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ===== Platform / Modules ===== */

function PlatformBlock() {
  const modules = [
    {
      tag: 'MODULE 01',
      name: 'Multi-Agent Crew',
      desc: 'Specialized agents &mdash; Analytics, Data Assistance, and domain-specific roles &mdash; that delegate, debate, and compose answers. One question, many minds.',
    },
    {
      tag: 'MODULE 02',
      name: 'Natural Language to SQL',
      desc: 'Translates business questions into accurate, production-grade SQL. Type-aware, join-aware, dialect-aware. Powered by Claude under the hood; tuned by Aspect on top.',
    },
    {
      tag: 'MODULE 03',
      name: 'Database Schema Builder',
      desc: 'Builds an optimized retrieval graph over the live schema &mdash; relationships, semantics, sensitive columns. The model never sees raw DDL; it sees something better.',
    },
    {
      tag: 'MODULE 04',
      name: 'Long Query Assistance',
      desc: 'Dynamically analyzes complex queries and provisions temporary on-the-fly data warehouses so heavy analyses return in seconds, not coffee breaks.',
    },
  ];

  return (
    <section id="platform" className={`${styles.section} ${styles.platformSection}`}>
      <SectionLabel index="03" label="What&rsquo;s actually under the hood" />
      <p className={`${styles.sectionLede} ${styles.reveal}`}>
        Aspect is not a wrapper. It is an operational intelligence platform with
        four production modules that together turn a model into a system the business can rely on.
      </p>

      <div className={styles.modules}>
        {modules.map((m) => (
          <article key={m.name} className={`${styles.module} ${styles.reveal}`}>
            <span className={styles.moduleTag}>{m.tag}</span>
            <h3 className={styles.moduleName}>{m.name}</h3>
            <p className={styles.moduleDesc} dangerouslySetInnerHTML={{ __html: m.desc }} />
          </article>
        ))}
      </div>

      <div className={`${styles.platformNote} ${styles.reveal}`}>
        <span className={styles.noteKicker}>Position it like this</span>
        <p>
          &ldquo;Aspect feels like a next-generation RAG, but it doesn&rsquo;t just retrieve &mdash;
          it analyzes, plans, and recommends. Ask it for the last two months of income
          and it answers. Ask it where you&rsquo;re bleeding profit and it goes looking.&rdquo;
        </p>
      </div>
    </section>
  );
}

/* ===== Cheat sheet (quick-fire one-liners) ===== */

function CheatSheet() {
  const lines = [
    {
      q: '&ldquo;Isn&rsquo;t this just ChatGPT for our database?&rdquo;',
      a: 'ChatGPT is the spark plug. Aspect is the car. The plug is not the problem.',
    },
    {
      q: '&ldquo;Why can&rsquo;t our data team build this?&rdquo;',
      a: 'They can &mdash; in eighteen months, on the third rewrite. We sell you those eighteen months.',
    },
    {
      q: '&ldquo;What if Claude changes their pricing or model?&rdquo;',
      a: 'Aspect is model-routed. Swap the engine without touching the airplane.',
    },
    {
      q: '&ldquo;How accurate is the SQL?&rdquo;',
      a: 'Schema-grounded, type-checked, and validated before execution. We don&rsquo;t hallucinate joins &mdash; we don&rsquo;t need to.',
    },
    {
      q: '&ldquo;What about governance and PII?&rdquo;',
      a: 'Column-level policy lives in the schema graph, not the prompt. The model never sees what it&rsquo;s not allowed to see.',
    },
    {
      q: '&ldquo;Can it handle huge queries?&rdquo;',
      a: 'Long Query Assistance spins up temporary warehouses on the fly. Heavy analyses return in seconds.',
    },
  ];

  return (
    <section id="cheat" className={`${styles.section} ${styles.cheatSection}`}>
      <SectionLabel index="04" label="Cheat sheet &mdash; one-liners for the room" />
      <div className={styles.cheatGrid}>
        {lines.map((l, i) => (
          <div key={i} className={`${styles.cheatItem} ${styles.reveal}`}>
            <p className={styles.cheatQ} dangerouslySetInnerHTML={{ __html: l.q }} />
            <p className={styles.cheatA} dangerouslySetInnerHTML={{ __html: l.a }} />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ===== Closing call-to-action ===== */

function ClosingBlock() {
  return (
    <section className={`${styles.section} ${styles.closingSection}`}>
      <div className={`${styles.closingCard} ${styles.reveal}`}>
        <span className={styles.closingKicker}>Before you walk into the meeting</span>
        <h2 className={styles.closingTitle}>
          Two answers. Sixty seconds each.
          That&rsquo;s the deal.
        </h2>
        <p className={styles.closingBody}>
          If you remember nothing else: Claude is the engine, Aspect is the vehicle.
          ROI is measured in deflected tickets, time-to-insight, and the questions
          your customer didn&rsquo;t even know to ask. Lead with that. Everything else is detail.
        </p>
        <div className={styles.closingActions}>
          <a className={styles.closingPrimary} href="#objections">Re-read the objections</a>
          <a className={styles.closingSecondary} href="#scenario">Open the scenario</a>
        </div>
      </div>
    </section>
  );
}

/* ===== Footer ===== */

function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerLeft}>
          <span className={styles.footerBrand}>Aspect Platform</span>
          <span className={styles.footerNote}>Operational Intelligence &middot; Internal sales reference</span>
        </div>
        <div className={styles.footerRight}>
          <span className={styles.footerMeta}>v1.0 &middot; Battle Card</span>
        </div>
      </div>
    </footer>
  );
}

/* ===== Page ===== */

export function AspectBattleCardPage() {
  const ref = useReveal();
  return (
    <div ref={ref} className={styles.page}>
      <Nav />
      <Hero />
      <main className={styles.main}>
        <ObjectionsBlock />
        <ScenarioBlock />
        <PlatformBlock />
        <CheatSheet />
        <ClosingBlock />
      </main>
      <Footer />
    </div>
  );
}

export default AspectBattleCardPage;
