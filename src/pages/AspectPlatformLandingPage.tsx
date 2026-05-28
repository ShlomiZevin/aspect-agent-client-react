import { useEffect, useRef, useState } from 'react';
import styles from './AspectPlatformLandingPage.module.css';

/* ===== Aspect — Operational Intelligence Platform =====
 * Sales-enablement page at /aspect-platform.
 * Audience: enterprise sales, solution consultants, technical sales.
 * Tone: calm, operational, technically credible. No hype, no "AI magic".
 * Inspiration: lybi.ai/lybi (warm off-white, serif headlines, generous spacing).
 */

/* ===== Scroll-reveal hook ===== */

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

/* ===== Nav ===== */

function Nav({ onTalk }: { onTalk: () => void }) {
  return (
    <nav className={styles.nav}>
      <div className={styles.navContent}>
        <a href="#top" className={styles.navLogo}>
          <span className={styles.wordmark}>Aspect</span>
          <span className={styles.wordmarkSub}>Operational Intelligence</span>
        </a>
        <div className={styles.navRight}>
          <div className={styles.navLinks}>
            <a href="#platform" className={styles.navLink}>Platform</a>
            <a href="#why-not-llm" className={styles.navLink}>Why not just an LLM</a>
            <a href="#roi" className={styles.navLink}>ROI</a>
            <a href="#scenarios" className={styles.navLink}>Scenarios</a>
            <a href="#objections" className={styles.navLink}>Objections</a>
          </div>
          <button className={styles.navCta} onClick={onTalk}>Talk to our team</button>
        </div>
      </div>
    </nav>
  );
}

/* ===== Footer ===== */

function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContent}>
        <div className={styles.footerLeft}>
          <p className={styles.footerWordmark}>Aspect</p>
          <p className={styles.footerNote}>
            Operational intelligence for organizations that decide on data.
          </p>
          <p className={styles.footerCopyright}>
            &copy; {new Date().getFullYear()} Aspect. All rights reserved.
          </p>
        </div>
        <div className={styles.footerRight}>
          <a href="#platform" className={styles.footerLink}>Platform</a>
          <a href="#why-not-llm" className={styles.footerLink}>Why not just an LLM</a>
          <a href="#roi" className={styles.footerLink}>ROI</a>
          <a href="#scenarios" className={styles.footerLink}>Scenarios</a>
          <a href="#objections" className={styles.footerLink}>Objections</a>
          <a href="#differentiators" className={styles.footerLink}>Differentiators</a>
        </div>
      </div>
    </footer>
  );
}

/* ===== Contact modal — minimal placeholder ===== */

function TalkModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal="true">
        <button className={styles.modalClose} onClick={onClose} aria-label="Close">×</button>
        <p className={styles.eyebrow}>TALK TO OUR TEAM</p>
        <h2 className={styles.modalTitle}>Let's see if Aspect fits your operation.</h2>
        <p className={styles.modalBody}>
          We work with a small number of enterprise teams at a time. A first conversation
          is usually 30–45 minutes — we focus on your analytical workflows, current
          bottlenecks, and where Aspect could meaningfully compress decision time.
        </p>
        <a href="mailto:hello@aspect.ai?subject=Aspect%20platform%20–%20intro%20call" className={styles.modalCta}>
          Email hello@aspect.ai
        </a>
      </div>
    </>
  );
}

/* ===== Main page ===== */

export function AspectPlatformLandingPage() {
  const revealRef = useScrollReveal();
  const [talkOpen, setTalkOpen] = useState(false);

  useEffect(() => {
    document.title = 'Aspect — Operational Intelligence Platform';

    document.documentElement.style.overflow = 'auto';
    document.documentElement.style.height = 'auto';
    document.documentElement.style.scrollBehavior = 'smooth';
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    const root = document.getElementById('root');
    if (root) { root.style.overflow = 'auto'; root.style.height = 'auto'; }

    return () => {
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
      document.documentElement.style.scrollBehavior = '';
      document.body.style.overflow = '';
      document.body.style.height = '';
      if (root) { root.style.overflow = ''; root.style.height = ''; }
    };
  }, []);

  return (
    <div className={styles.container} ref={revealRef} id="top">
      <Nav onTalk={() => setTalkOpen(true)} />

      {/* ============== HERO ============== */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>OPERATIONAL INTELLIGENCE PLATFORM</p>
          <h1 className={styles.h1}>
            Analytics infrastructure
            <br />that thinks operationally.
          </h1>
          <p className={styles.heroLede}>
            Aspect is an adaptive analytics layer for enterprises — a coordinated crew of
            analytical agents, a query reasoning engine, and a dynamic warehousing module
            that turn business questions into validated operational insight.
          </p>
          <div className={styles.heroActions}>
            <button className={styles.primaryButton} onClick={() => setTalkOpen(true)}>
              Talk to our team <span aria-hidden="true">→</span>
            </button>
            <a href="#platform" className={styles.ghostButton}>
              How the platform works
            </a>
          </div>

          <div className={styles.heroBadges}>
            <span className={styles.heroBadge}>Operational Intelligence Platform</span>
            <span className={styles.heroBadgeDot} aria-hidden="true">•</span>
            <span className={styles.heroBadge}>Adaptive Analytics Infrastructure</span>
            <span className={styles.heroBadgeDot} aria-hidden="true">•</span>
            <span className={styles.heroBadge}>AI Decision Support Layer</span>
          </div>
        </div>
      </section>

      {/* ============== WHAT THE PLATFORM DOES ============== */}
      <section id="platform" className={styles.sectionSecondary}>
        <div className={`${styles.sectionWide} ${styles.reveal}`}>
          <p className={styles.eyebrow}>WHAT THE PLATFORM ACTUALLY DOES</p>
          <h2 className={styles.h2}>Four operational layers, working as one system.</h2>
          <p className={styles.lede}>
            Aspect is not a chat interface over a database. It is a coordinated set of
            analytical components designed to operate the way an enterprise data team
            operates — with structure, validation, and shared context.
          </p>

          <div className={styles.layersGrid}>
            <article className={styles.layerCard}>
              <p className={styles.layerNumber}>01</p>
              <h3 className={styles.h3}>Multi-Agent Analytical Crew</h3>
              <p className={styles.bodyText}>
                A coordinated system of specialized agents — analytics, operational
                reasoning, forecasting, reporting, optimization — each responsible for a
                specific domain. They collaborate the way a real analytical team does:
                hand off context, challenge each other's outputs, and converge on an
                answer that holds up.
              </p>
            </article>

            <article className={styles.layerCard}>
              <p className={styles.layerNumber}>02</p>
              <h3 className={styles.h3}>Query-to-SQL Transformation Engine</h3>
              <p className={styles.bodyText}>
                Translates human business questions into structured analytical queries.
                The engine carries schema awareness, business definitions, and validation
                rules — so the SQL it generates is not just syntactically correct but
                operationally meaningful inside your data model.
              </p>
            </article>

            <article className={styles.layerCard}>
              <p className={styles.layerNumber}>03</p>
              <h3 className={styles.h3}>Dynamic Schema Builder</h3>
              <p className={styles.bodyText}>
                Continuously builds and optimizes analytical structures around the
                questions the organization is actually asking. Tables, indexes, and
                relationships are shaped by real workload, not a static dimensional
                model that ages out of relevance.
              </p>
            </article>

            <article className={styles.layerCard}>
              <p className={styles.layerNumber}>04</p>
              <h3 className={styles.h3}>Long Query Assistance Module</h3>
              <p className={styles.bodyText}>
                Decomposes complex analytical requests and automatically creates
                warehouse-style optimization layers for heavy or repeated workloads.
                Slow investigations become fast operational queries the next time the
                same question is asked.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ============== Q1 — WHY NOT JUST AN LLM ============== */}
      <section id="why-not-llm" className={styles.sectionPrimary}>
        <div className={`${styles.section} ${styles.reveal}`}>
          <p className={styles.eyebrow}>OBJECTION · ONE</p>
          <h2 className={styles.h2}>
            "Why do we need this when we can use Claude or ChatGPT with our data?"
          </h2>
          <p className={styles.lede}>
            Because large language models are reasoning engines, not operational systems.
            Connecting an LLM directly to a warehouse does not produce reliable analytics
            — it produces fluent guesses on top of unstructured access.
          </p>

          <div className={styles.compareGrid}>
            <div className={styles.compareCol}>
              <p className={styles.compareHeader}>An LLM connected to your data gives you</p>
              <ul className={styles.minusList}>
                <li><span className={styles.minusMark} aria-hidden="true">−</span> Free-form access without a stable analytical model</li>
                <li><span className={styles.minusMark} aria-hidden="true">−</span> Plausible answers with no validation path</li>
                <li><span className={styles.minusMark} aria-hidden="true">−</span> No memory of how the business actually defines metrics</li>
                <li><span className={styles.minusMark} aria-hidden="true">−</span> No coordination across analytical domains</li>
                <li><span className={styles.minusMark} aria-hidden="true">−</span> No warehousing strategy for recurring workloads</li>
                <li><span className={styles.minusMark} aria-hidden="true">−</span> Inconsistent results between two runs of the same question</li>
              </ul>
            </div>
            <div className={`${styles.compareCol} ${styles.compareColHighlight}`}>
              <p className={styles.compareHeader}>What an enterprise analytical system requires</p>
              <ul className={styles.plusList}>
                <li><span className={styles.plusMark} aria-hidden="true">+</span> A deliberate architecture with bounded responsibilities</li>
                <li><span className={styles.plusMark} aria-hidden="true">+</span> Schema engineering that reflects how the business reasons</li>
                <li><span className={styles.plusMark} aria-hidden="true">+</span> Query optimization and decomposition for complex investigations</li>
                <li><span className={styles.plusMark} aria-hidden="true">+</span> Validation layers that catch unsafe or unsupported queries</li>
                <li><span className={styles.plusMark} aria-hidden="true">+</span> Analytical orchestration across specialized agents</li>
                <li><span className={styles.plusMark} aria-hidden="true">+</span> A warehousing strategy that compounds over time</li>
                <li><span className={styles.plusMark} aria-hidden="true">+</span> Business-context infrastructure that survives team turnover</li>
              </ul>
            </div>
          </div>

          <div className={styles.pullQuote}>
            <p>
              Modern AI models dramatically accelerate analytical work. They do not
              replace the operational architecture around them. The quality of a final
              system depends on the operational design, not on the model.
            </p>
            <p className={styles.pullQuoteEmphasis}>
              AI models are amplification tools. Aspect is the operational intelligence
              layer that turns amplification into reliable enterprise output.
            </p>
          </div>
        </div>
      </section>

      {/* ============== Q2 — ROI ============== */}
      <section id="roi" className={styles.sectionSecondary}>
        <div className={`${styles.section} ${styles.reveal}`}>
          <p className={styles.eyebrow}>OBJECTION · TWO</p>
          <h2 className={styles.h2}>
            "How do we measure the financial or operational ROI?"
          </h2>
          <p className={styles.lede}>
            We don't promise direct revenue lift. We compress the distance between a
            business question and a business action — and we measure ROI through the
            operational efficiencies that compression produces.
          </p>

          <div className={styles.roiGrid}>
            <div className={styles.roiItem}>
              <p className={styles.roiLabel}>Analyst workload</p>
              <p className={styles.roiValue}>Reduced</p>
              <p className={styles.roiNote}>Routine investigations no longer queue against the analytical team.</p>
            </div>
            <div className={styles.roiItem}>
              <p className={styles.roiLabel}>Engineering dependency</p>
              <p className={styles.roiValue}>Reduced</p>
              <p className={styles.roiNote}>New questions don't always require a new data engineering ticket.</p>
            </div>
            <div className={styles.roiItem}>
              <p className={styles.roiLabel}>Report generation</p>
              <p className={styles.roiValue}>Faster</p>
              <p className={styles.roiNote}>Recurring reports are produced on demand against the live model.</p>
            </div>
            <div className={styles.roiItem}>
              <p className={styles.roiLabel}>Dashboard backlog</p>
              <p className={styles.roiValue}>Reduced</p>
              <p className={styles.roiNote}>Many one-off dashboards become ad-hoc analytical conversations.</p>
            </div>
            <div className={styles.roiItem}>
              <p className={styles.roiLabel}>Time-to-insight</p>
              <p className={styles.roiValue}>Compressed</p>
              <p className={styles.roiNote}>From days of analyst work to a working answer the same hour.</p>
            </div>
            <div className={styles.roiItem}>
              <p className={styles.roiLabel}>Operational investigations</p>
              <p className={styles.roiValue}>Accelerated</p>
              <p className={styles.roiNote}>Anomaly and root-cause work moves at the speed of the question.</p>
            </div>
            <div className={styles.roiItem}>
              <p className={styles.roiLabel}>Forecasting visibility</p>
              <p className={styles.roiValue}>Improved</p>
              <p className={styles.roiNote}>Continuous forecasting assistance, not quarterly modeling cycles.</p>
            </div>
            <div className={styles.roiItem}>
              <p className={styles.roiLabel}>Decision velocity</p>
              <p className={styles.roiValue}>Increased</p>
              <p className={styles.roiNote}>Operators decide on evidence, in meeting time, not next week.</p>
            </div>
          </div>

          <div className={styles.compressionCallout}>
            <p className={styles.compressionEyebrow}>THE CORE VALUE</p>
            <h3 className={styles.h3Large}>Decision Compression.</h3>
            <p className={styles.compressionLine}>
              The time between <span className={styles.flowWord}>Question</span>
              <span className={styles.flowArrow}>→</span>
              <span className={styles.flowWord}>Insight</span>
              <span className={styles.flowArrow}>→</span>
              <span className={styles.flowWord}>Action</span>
              {' '}is the single hardest metric to move inside an enterprise.
              Aspect is built to move it.
            </p>
            <p className={styles.compressionTail}>
              The most underrated ROI mechanism: generating dynamic reports and
              analytical investigations on demand, without spinning up an engineering
              or BI project every time a leader has a question.
            </p>
          </div>
        </div>
      </section>

      {/* ============== SCENARIOS ============== */}
      <section id="scenarios" className={styles.sectionPrimary}>
        <div className={`${styles.sectionWide} ${styles.reveal}`}>
          <p className={styles.eyebrow}>EXAMPLE OPERATIONAL SCENARIOS</p>
          <h2 className={styles.h2}>How Aspect behaves in real operational situations.</h2>
          <p className={styles.lede}>
            These are illustrative — drawn from how analytical teams typically work
            through an investigation. The point is the shape of the workflow, not the
            specific numbers.
          </p>

          <div className={styles.scenarios}>
            <article className={styles.scenarioCard}>
              <p className={styles.scenarioTag}>Profitability investigation</p>
              <h3 className={styles.h3}>Margin in one product line is sliding. The CFO wants to know why before the next board meeting.</h3>
              <p className={styles.bodyText}>
                Aspect's analytics agent decomposes the question across price, cost,
                mix, and channel. The reasoning agent surfaces that 64% of the decline
                concentrates in a single geography during the last six weeks. The
                schema builder caches the resulting analytical layer, so the same
                investigation runs in seconds next quarter.
              </p>
              <p className={styles.scenarioOutcome}>
                Time-to-answer: minutes, not the usual cross-team analyst cycle.
              </p>
            </article>

            <article className={styles.scenarioCard}>
              <p className={styles.scenarioTag}>Supply chain anomaly</p>
              <h3 className={styles.h3}>Lead times are quietly drifting upward across a category. No one has flagged it yet.</h3>
              <p className={styles.bodyText}>
                The operational reasoning agent notices the drift in routine
                monitoring and asks the forecasting assistant whether the trend
                projects into a stockout. The long-query module materializes a
                supplier-level optimization layer, exposing two suppliers responsible
                for most of the drift.
              </p>
              <p className={styles.scenarioOutcome}>
                Outcome: a procurement conversation that starts with evidence, not suspicion.
              </p>
            </article>

            <article className={styles.scenarioCard}>
              <p className={styles.scenarioTag}>Margin compression analysis</p>
              <h3 className={styles.h3}>The COO wants to understand why operating margin is compressing despite stable revenue.</h3>
              <p className={styles.bodyText}>
                The reporting agent assembles a multi-dataset view across cost lines,
                headcount, and unit economics. The optimization agent identifies that
                fulfilment cost per unit has moved 9% in the wrong direction. The
                analyst keeps the workflow as a saved analytical structure for monthly
                review.
              </p>
              <p className={styles.scenarioOutcome}>
                A recurring investigation becomes a permanent operational instrument.
              </p>
            </article>

            <article className={styles.scenarioCard}>
              <p className={styles.scenarioTag}>Dynamic reporting</p>
              <h3 className={styles.h3}>Three regional VPs each want a custom monthly report. The BI backlog is two months out.</h3>
              <p className={styles.bodyText}>
                Aspect's reporting agent generates each report on demand against the
                existing operational model. The schema builder retains the structure
                so the next month's report is one click. None of these requests ever
                enter the BI roadmap.
              </p>
              <p className={styles.scenarioOutcome}>
                The dashboard backlog stops being where operational questions go to die.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ============== TRUST / VALIDATION ============== */}
      <section className={styles.sectionTrust}>
        <div className={`${styles.section} ${styles.reveal}`}>
          <p className={styles.eyebrow}>ENTERPRISE-GRADE BY DESIGN</p>
          <h2 className={styles.h2}>Built for organizations that cannot afford an incorrect answer.</h2>
          <p className={styles.lede}>
            Enterprise buyers have learned to be skeptical of analytical AI —
            hallucinations, broken SQL, plausible-looking insights with no grounding.
            Aspect's architecture is the answer to that skepticism, not a marketing
            line about it.
          </p>

          <div className={styles.trustGrid}>
            <div className={styles.trustItem}>
              <p className={styles.trustHeader}>Validation layer</p>
              <p className={styles.trustBody}>
                Every generated query passes structural and semantic validation before
                it ever reaches the database.
              </p>
            </div>
            <div className={styles.trustItem}>
              <p className={styles.trustHeader}>Controlled analytical workflows</p>
              <p className={styles.trustBody}>
                Agents operate inside defined responsibilities. They cannot improvise
                outside the analytical contract.
              </p>
            </div>
            <div className={styles.trustItem}>
              <p className={styles.trustHeader}>Explainable reasoning</p>
              <p className={styles.trustBody}>
                Each answer comes with the underlying query, the data path, and the
                reasoning trace. Auditable end to end.
              </p>
            </div>
            <div className={styles.trustItem}>
              <p className={styles.trustHeader}>Query control</p>
              <p className={styles.trustBody}>
                Cost ceilings, timeout boundaries, and scoped data permissions are
                enforced at the platform level — not left to the model.
              </p>
            </div>
            <div className={styles.trustItem}>
              <p className={styles.trustHeader}>Operational safeguards</p>
              <p className={styles.trustBody}>
                Schema changes, optimization layers, and warehousing actions are
                staged, reviewed, and reversible.
              </p>
            </div>
            <div className={styles.trustItem}>
              <p className={styles.trustHeader}>Production orientation</p>
              <p className={styles.trustBody}>
                Designed as an operational system from the start — observability,
                logging, and recovery are first-class concerns, not afterthoughts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============== OBJECTIONS ============== */}
      <section id="objections" className={styles.sectionSecondary}>
        <div className={`${styles.sectionWide} ${styles.reveal}`}>
          <p className={styles.eyebrow}>OBJECTION HANDLING</p>
          <h2 className={styles.h2}>The questions enterprise buyers actually ask.</h2>
          <p className={styles.lede}>
            Direct answers to the recurring objections we hear in evaluation
            conversations. Read these the way a buyer would.
          </p>

          <div className={styles.objections}>
            <div className={styles.objection}>
              <p className={styles.objectionQ}>"Can't we just build this internally?"</p>
              <p className={styles.objectionA}>
                You can. The question is whether your team should spend the next 18–24
                months building analytical orchestration, schema intelligence, query
                validation, and a warehousing strategy — or whether they should spend
                those months solving your business problems on top of an operational
                layer that already exists. Aspect is what an internal build looks like
                after several years of iteration.
              </p>
            </div>

            <div className={styles.objection}>
              <p className={styles.objectionQ}>"Why not Power BI, Tableau, or Looker?"</p>
              <p className={styles.objectionA}>
                Those are visualization layers. They display the answers analysts and
                engineers prepare in advance. Aspect is the layer underneath — the
                system that produces the analytical answer in the first place,
                dynamically, against questions that were not pre-modeled. The two
                coexist; they solve different problems.
              </p>
            </div>

            <div className={styles.objection}>
              <p className={styles.objectionQ}>"How accurate are the generated insights?"</p>
              <p className={styles.objectionA}>
                Accuracy comes from the architecture, not the model. Aspect validates
                queries, enforces schema and metric definitions, decomposes complex
                requests, and surfaces the reasoning behind every answer. Where an
                answer cannot be defended, the platform says so rather than producing
                a confident-sounding guess.
              </p>
            </div>

            <div className={styles.objection}>
              <p className={styles.objectionQ}>"Does this replace our analysts?"</p>
              <p className={styles.objectionA}>
                No. It removes the work that analysts wish they didn't have to do —
                ad-hoc pulls, repeat reports, basic operational questions — and frees
                them for the work only analysts can do. The teams that adopt Aspect
                tend to expand the analytical surface area of the business, not
                shrink the team.
              </p>
            </div>

            <div className={styles.objection}>
              <p className={styles.objectionQ}>"Why not use ChatGPT directly against our warehouse?"</p>
              <p className={styles.objectionA}>
                Because a chat window over a warehouse is not an analytical system.
                It is unstructured access wrapped in plausible language. The risk is
                not that you get no answer — the risk is that you get a confident
                answer that is wrong, and act on it. Aspect is the orchestration,
                validation, and operational discipline around the model.
              </p>
            </div>

            <div className={styles.objection}>
              <p className={styles.objectionQ}>"How do you handle hallucinations?"</p>
              <p className={styles.objectionA}>
                Structurally, not optimistically. Generated SQL is validated against
                the schema; metrics resolve against business definitions; reasoning
                steps are traceable; queries that fail safety checks are not run. The
                model is treated as a powerful component inside a controlled system,
                not as a source of truth.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============== TECHNICAL DIFFERENTIATORS ============== */}
      <section id="differentiators" className={styles.sectionPrimary}>
        <div className={`${styles.sectionWide} ${styles.reveal}`}>
          <p className={styles.eyebrow}>TECHNICAL DIFFERENTIATORS</p>
          <h2 className={styles.h2}>What the platform does that a generic AI assistant cannot.</h2>

          <div className={styles.diffGrid}>
            <article className={styles.diffCard}>
              <p className={styles.diffNumber}>01</p>
              <h3 className={styles.h3}>Multi-agent orchestration</h3>
              <p className={styles.bodyText}>
                Specialized agents — analytics, reasoning, forecasting, reporting,
                optimization, data assistance — operate inside an orchestration layer
                with explicit responsibilities, handoffs, and validation.
              </p>
            </article>
            <article className={styles.diffCard}>
              <p className={styles.diffNumber}>02</p>
              <h3 className={styles.h3}>Dynamic analytics</h3>
              <p className={styles.bodyText}>
                The analytical model is not frozen at design time. Aspect adapts to
                the questions the business is actually asking, surfacing structure
                that was never pre-modeled.
              </p>
            </article>
            <article className={styles.diffCard}>
              <p className={styles.diffNumber}>03</p>
              <h3 className={styles.h3}>Adaptive warehousing</h3>
              <p className={styles.bodyText}>
                Heavy and recurring workloads automatically receive warehouse-style
                optimization layers. Slow investigations turn into fast operational
                queries the next time they're asked.
              </p>
            </article>
            <article className={styles.diffCard}>
              <p className={styles.diffNumber}>04</p>
              <h3 className={styles.h3}>Analytical optimization</h3>
              <p className={styles.bodyText}>
                The platform observes its own query patterns, finds the expensive
                ones, and rewrites them as durable analytical structures. Performance
                compounds with use, instead of degrading.
              </p>
            </article>
            <article className={styles.diffCard}>
              <p className={styles.diffNumber}>05</p>
              <h3 className={styles.h3}>Query reasoning</h3>
              <p className={styles.bodyText}>
                Business questions are decomposed into validated analytical steps
                before any SQL is generated. The reasoning is exposed, so analysts
                can inspect and correct it.
              </p>
            </article>
            <article className={styles.diffCard}>
              <p className={styles.diffNumber}>06</p>
              <h3 className={styles.h3}>Schema intelligence</h3>
              <p className={styles.bodyText}>
                Aspect carries a living understanding of relationships, definitions,
                and business meaning across the warehouse — beyond what column names
                or static documentation provide.
              </p>
            </article>
            <article className={styles.diffCard}>
              <p className={styles.diffNumber}>07</p>
              <h3 className={styles.h3}>Long-query decomposition</h3>
              <p className={styles.bodyText}>
                Complex multi-step investigations are broken into a coordinated
                workflow of smaller analytical operations — each independently
                validated, optimized, and cached.
              </p>
            </article>
            <article className={styles.diffCard}>
              <p className={styles.diffNumber}>08</p>
              <h3 className={styles.h3}>Operational discipline</h3>
              <p className={styles.bodyText}>
                Observability, cost control, permission boundaries, and recovery
                paths are first-class components — the kind of thing that turns an AI
                demo into a production analytical system.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ============== CLOSING ============== */}
      <section className={styles.closing}>
        <div className={`${styles.section} ${styles.reveal}`}>
          <p className={styles.closingLine}>
            Built for organizations that need to decide faster than they can hire.
          </p>
          <p className={styles.closingSub}>
            If your operational questions are stuck inside the BI backlog, the
            engineering queue, or a chat window with no structure underneath it —
            that is the gap Aspect was built to close.
          </p>
          <div className={styles.closingActions}>
            <button className={styles.primaryButton} onClick={() => setTalkOpen(true)}>
              Talk to our team <span aria-hidden="true">→</span>
            </button>
            <a href="#platform" className={styles.ghostButton}>
              Re-read the platform overview
            </a>
          </div>
        </div>
      </section>

      <Footer />
      <TalkModal open={talkOpen} onClose={() => setTalkOpen(false)} />
    </div>
  );
}
