import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './KostaHandoffPage.module.css';

export function KostaHandoffPage() {
  const [theme, setTheme] = useState<'dark' | 'light'>('light');

  useEffect(() => {
    document.title = 'Aspect — Developer Ownership Handoff';
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
    document.documentElement.style.overflow = 'auto';
    document.documentElement.style.height = 'auto';
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
      document.body.style.overflow = '';
      document.body.style.height = '';
      if (root) {
        root.style.overflow = '';
        root.style.height = '';
      }
    };
  }, []);

  return (
    <div className={`${styles.container} ${theme === 'light' ? styles.light : ''}`}>
      {/* Nav */}
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <Link to="/" className={styles.navLogo}>
            <img src="/img/aspect-logo-regular.png" alt="Aspect" />
          </Link>
          <div className={styles.navRight}>
            <a href="#context">Context</a>
            <a href="#scope">Scope</a>
            <a href="#technical">Technical Scope</a>
            <a href="#responsibilities">Responsibilities</a>
            <a href="#timeline">Timeline</a>
            <button
              className={styles.themeToggle}
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className={styles.hero}>
        <h1>Aspect Project — <span>Ownership Handoff</span></h1>
        <p className={styles.heroSub}>
          Transitioning Kosta from task-level execution to full project ownership.
          This document outlines the scope, responsibilities, expectations, and timeline.
        </p>
        <div className={styles.heroMeta}>
          <span>Prepared for: Vova</span>
          <span>Effective: May 2026</span>
          <span>Review: Mid-May 2026</span>
        </div>
      </header>

      <div className={styles.document}>

        {/* ── CONTEXT ── */}
        <section id="context" className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Context</span>
            <h2 className={styles.sectionTitle}>Background</h2>
          </div>

          <p className={styles.p}>
            Aspect is a <strong>BI company</strong> that provides data analytics and business
            intelligence services to retail chains. I convinced Aspect's owner to add an{' '}
            <strong>AI agent layer</strong> on top of their existing BI infrastructure — allowing
            their customers to query business data using natural language instead of traditional
            dashboards and reports.
          </p>

          <p className={styles.p}>
            I built the platform and have been managing Kosta for day-to-day development tasks.
            Until now, I had to break down every requirement in detail, verify every result, and
            double-check that the agent actually works from a user's perspective. Due to budget
            changes from my customer, I need to reduce my involvement — but I want to keep Kosta
            on the project, provided he can take <strong>full production ownership</strong>.
          </p>

          <div className={styles.calloutBlue}>
            <strong>What stays the same:</strong> I will continue to provide goals, tasks, and
            requirements. I communicate with the customer and translate business needs into
            technical direction.
            <br /><br />
            <strong>What changes:</strong> The overall responsibility for the product to work
            as a <strong>production-ready product</strong> shifts to Vova / Kosta. I should not
            need to verify that things work — that's their job now.
          </div>
        </section>

        <hr className={styles.divider} />

        {/* ── PEOPLE ── */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Roles</span>
            <h2 className={styles.sectionTitle}>People &amp; Responsibilities</h2>
          </div>

          <div className={styles.peopleGrid}>
            <div className={styles.personCard}>
              <div className={styles.personRole}>Customer</div>
              <div className={styles.personName}>Itzik (Aspect)</div>
              <div className={styles.personDesc}>
                Aspect owner. BI company providing data services to retail chains.
                Sets business direction and priorities.
              </div>
            </div>
            <div className={styles.personCard}>
              <div className={styles.personRole}>Product &amp; Direction</div>
              <div className={styles.personName}>Shlomi (me)</div>
              <div className={styles.personDesc}>
                Built the platform. Communicates with the customer.
                Provides goals, tasks, and requirements.
                No longer responsible for verifying production quality.
              </div>
            </div>
            <div className={styles.personCard}>
              <div className={styles.personRole}>Developer (via Vova)</div>
              <div className={styles.personName}>Kosta</div>
              <div className={styles.personDesc}>
                Full production ownership.
                Responsible for the product working, end to end.
                Managed by Vova.
              </div>
            </div>
          </div>
        </section>

        <hr className={styles.divider} />

        {/* ── WHAT IS ASPECT ── */}
        <section id="scope" className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTagGreen}>Scope</span>
            <h2 className={styles.sectionTitle}>What Is the Aspect Agent</h2>
          </div>

          <p className={styles.p}>
            Aspect is a BI company that already manages data for retail chain customers.
            The <strong>agent</strong> is a new AI layer I built on top of that —
            it lets business users (CEOs, CFOs, store managers) ask questions about their
            data in natural language and get instant analyzed answers.
          </p>

          <p className={styles.p}>
            <strong>How it works per customer:</strong>
          </p>

          <ul className={styles.respList} style={{ marginBottom: '1.5rem' }}>
            <li><span className={styles.bulletGreen}>1.</span> Customer's business data is imported (CSV, Excel, QVD, etc.) and loaded into a dedicated schema</li>
            <li><span className={styles.bulletGreen}>2.</span> The platform auto-indexes the schema — tables, columns, relationships</li>
            <li><span className={styles.bulletGreen}>3.</span> User asks a question → AI translates it to SQL → query runs against the data → AI composes a clear answer</li>
            <li><span className={styles.bulletGreen}>4.</span> The system auto-improves over time — indexing slow queries, optimizing patterns, getting smarter per customer</li>
          </ul>

          <p className={styles.p}>
            <strong>Each customer</strong> gets their own data model and import process.
            The <strong>engine is shared</strong> — the same question-to-SQL-to-answer pipeline
            serves all customers. The platform should improve automatically with usage.
          </p>

          <div className={styles.calloutGreen}>
            <strong>Live example:</strong> Zer4U is an active customer with data already loaded.
            The agent can answer questions about their sales, inventory, branches, employees, and targets.
            This is the reference implementation Kosta should use to understand the full flow.
          </div>
        </section>

        <hr className={styles.divider} />

        {/* ── TECHNICAL SCOPE ── */}
        <section id="technical" className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTagGreen}>Technical</span>
            <h2 className={styles.sectionTitle}>Project Technical Scope</h2>
          </div>

          <p className={styles.p}>
            The Aspect agent project has three distinct phases per customer.
            Kosta must own all three — from initial data load to ongoing optimization.
          </p>

          {/* Phase 1 — Data Loading */}
          <div className={styles.respCard} style={{ marginBottom: '1.25rem' }}>
            <div className={styles.respCardTitle}>
              <span>📥</span> Phase 1 — Data Loading
            </div>
            <p className={styles.p} style={{ marginBottom: '0.75rem' }}>
              Customer data arrives as files (CSV, Excel, QVD). The goal is to load it
              into the customer's dedicated schema in our database. This must be
              efficient and reliable.
            </p>
            <ul className={styles.respList}>
              <li><span className={styles.bullet}>→</span> <strong>Target: total load time under 2-3 hours</strong> per full data refresh</li>
              <li><span className={styles.bullet}>→</span> Load data with indexes dropped first, rebuild indexes after load completes (already implemented for Zer4U — this pattern must be followed for every customer)</li>
              <li><span className={styles.bullet}>→</span> Validate row counts, data types, and schema integrity after each load</li>
              <li><span className={styles.bullet}>→</span> Handle edge cases: missing columns, encoding issues, partial files</li>
              <li><span className={styles.bullet}>→</span> Be able to run and monitor the full load process independently</li>
            </ul>
          </div>

          {/* Phase 2 — Index Creation & Schema Setup */}
          <div className={styles.respCard} style={{ marginBottom: '1.25rem' }}>
            <div className={styles.respCardTitle}>
              <span>🗂️</span> Phase 2 — Index Creation &amp; Schema Setup
            </div>
            <p className={styles.p} style={{ marginBottom: '0.75rem' }}>
              After data is loaded, the schema needs to be properly indexed so the AI-generated
              SQL queries run fast. This is critical for agent response time.
            </p>
            <ul className={styles.respList}>
              <li><span className={styles.bullet}>→</span> Create indexes on commonly queried columns (dates, branch IDs, product categories, etc.)</li>
              <li><span className={styles.bullet}>→</span> Auto-describe the schema so the AI understands table/column semantics</li>
              <li><span className={styles.bullet}>→</span> Verify that typical business questions generate fast queries (&lt;5s response time)</li>
              <li><span className={styles.bullet}>→</span> Test the agent end-to-end: ask questions as a user, verify answers make sense</li>
            </ul>
          </div>

          {/* Phase 3 — Ongoing Optimization */}
          <div className={styles.respCard} style={{ marginBottom: '1.25rem' }}>
            <div className={styles.respCardTitle}>
              <span>🔄</span> Phase 3 — Ongoing Optimization (Continuous)
            </div>
            <p className={styles.p} style={{ marginBottom: '0.75rem' }}>
              This is the ongoing process that makes the agent smarter and faster over time.
              It never stops — every slow query is an opportunity to improve.
            </p>
            <ul className={styles.respList}>
              <li><span className={styles.bullet}>→</span> <strong>Monitor slow queries</strong> — all queries are logged with execution time</li>
              <li><span className={styles.bullet}>→</span> <strong>Kill long-running queries</strong> — identify and terminate queries that take too long</li>
              <li><span className={styles.bullet}>→</span> <strong>Build targeted indexes</strong> — analyze slow query patterns and create indexes that eliminate them</li>
              <li><span className={styles.bullet}>→</span> <strong>Improve schema descriptions</strong> — when the AI generates bad SQL, improve the schema context so it generates better SQL next time</li>
              <li><span className={styles.bullet}>→</span> <strong>Track progress</strong> — everything is logged and visible in the admin dashboard (query times, error rates, most-asked questions)</li>
            </ul>
          </div>

          <div className={styles.calloutBlue}>
            <strong>The goal:</strong> the agent gets better every week without my involvement.
            Kosta monitors the dashboard, spots slow queries, adds indexes, improves schema
            descriptions, and verifies the agent answers correctly — as an ongoing process,
            not a one-time task. This is the core of what "ownership" means for this project.
          </div>
        </section>

        <hr className={styles.divider} />

        {/* ── RESPONSIBILITIES ── */}
        <section id="responsibilities" className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTagAmber}>Ownership</span>
            <h2 className={styles.sectionTitle}>What Kosta Owns</h2>
          </div>

          <div className={styles.calloutRed}>
            <strong>The #1 mindset shift:</strong> Kosta has to think like the <strong>customer
            </strong> — like the person who comes to work with the product every day —
            not like the person who developed it. A CEO doesn't care about the code.
            They care that when they type a question, they get a correct, useful answer.
            Kosta needs to sit in that chair, ask real business questions, and feel what
            works and what doesn't — from the user's perspective.
          </div>

          <p className={styles.p}>
            The core expectation: <strong>the product works in production, and Kosta can
            guarantee it.</strong> If something breaks, Kosta finds it and fixes it — I don't
            need to discover problems or verify the fix. I will still provide goals and tasks,
            but the responsibility for execution and quality is Kosta's.
          </p>

          <div className={styles.respGrid}>
            <div className={styles.respCard}>
              <div className={styles.respCardTitle}>
                <span>📊</span> Data Ownership
              </div>
              <ul className={styles.respList}>
                <li><span className={styles.bullet}>→</span> Understand the full data import process</li>
                <li><span className={styles.bullet}>→</span> Know how customer data is loaded, structured, and indexed</li>
                <li><span className={styles.bullet}>→</span> Be able to onboard a new customer's data independently</li>
                <li><span className={styles.bullet}>→</span> Monitor and fix data quality issues</li>
              </ul>
            </div>

            <div className={styles.respCard}>
              <div className={styles.respCardTitle}>
                <span>🤖</span> Agent Quality
              </div>
              <ul className={styles.respList}>
                <li><span className={styles.bullet}>→</span> Use the agent as a real user would (CEO, CFO, store manager)</li>
                <li><span className={styles.bullet}>→</span> Verify it returns correct, useful answers</li>
                <li><span className={styles.bullet}>→</span> If it can't answer — ensure it fails gracefully (e.g., "building index, try again shortly")</li>
                <li><span className={styles.bullet}>→</span> Continuously test and improve agent responses</li>
              </ul>
            </div>

            <div className={styles.respCard}>
              <div className={styles.respCardTitle}>
                <span>🚀</span> Production Readiness
              </div>
              <ul className={styles.respList}>
                <li><span className={styles.bullet}>→</span> The agent must be demo-ready and customer-ready at all times</li>
                <li><span className={styles.bullet}>→</span> No broken flows, no unanswered question types that should work</li>
                <li><span className={styles.bullet}>→</span> Proactively find and fix issues — don't wait for reports</li>
                <li><span className={styles.bullet}>→</span> Deploy and verify in production independently</li>
              </ul>
            </div>

            <div className={styles.respCard}>
              <div className={styles.respCardTitle}>
                <span>🧠</span> Product Understanding
              </div>
              <ul className={styles.respList}>
                <li><span className={styles.bullet}>→</span> Understand the customer's perspective, not just the code</li>
                <li><span className={styles.bullet}>→</span> Know what questions a business user would ask and why</li>
                <li><span className={styles.bullet}>→</span> Translate high-level goals into technical tasks independently</li>
                <li><span className={styles.bullet}>→</span> Think about auto-enhancement: indexing, optimization, smarter answers over time</li>
              </ul>
            </div>
          </div>
        </section>

        <hr className={styles.divider} />

        {/* ── WHAT CHANGES ── */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Before / After</span>
            <h2 className={styles.sectionTitle}>What Changes</h2>
          </div>

          <div className={styles.respGrid}>
            <div className={styles.respCard}>
              <div className={styles.respCardTitle}>
                <span>❌</span> Before (Until April)
              </div>
              <ul className={styles.respList}>
                <li><span className={styles.bullet}>•</span> I break down every task in detail for Kosta</li>
                <li><span className={styles.bullet}>•</span> I verify and double-check every result</li>
                <li><span className={styles.bullet}>•</span> Kosta executes specific instructions</li>
                <li><span className={styles.bullet}>•</span> I'm the one who knows if the agent works</li>
                <li><span className={styles.bullet}>•</span> I manage production quality</li>
              </ul>
            </div>

            <div className={styles.respCard}>
              <div className={styles.respCardTitle}>
                <span>✅</span> After (May Onwards)
              </div>
              <ul className={styles.respList}>
                <li><span className={styles.bulletGreen}>•</span> I provide goals, tasks, and high-level requirements</li>
                <li><span className={styles.bulletGreen}>•</span> Kosta breaks them down, executes, and verifies himself</li>
                <li><span className={styles.bulletGreen}>•</span> Kosta / Vova own production quality — if it breaks, they fix it</li>
                <li><span className={styles.bulletGreen}>•</span> Kosta can guarantee the agent is working at any moment</li>
                <li><span className={styles.bulletGreen}>•</span> My involvement drops to direction and customer communication</li>
              </ul>
            </div>
          </div>
        </section>

        <hr className={styles.divider} />

        {/* ── COMMUNICATION FLOW ── */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Flow</span>
            <h2 className={styles.sectionTitle}>Communication Chain</h2>
          </div>

          <div className={styles.calloutBlue}>
            <strong>Itzik</strong> (Aspect owner) → communicates business needs to →
            <strong> me</strong> → I provide goals, tasks, and requirements to →
            <strong> Kosta</strong> → owns execution, quality, and production readiness.
            <br /><br />
            <strong>Vova</strong> manages Kosta and shares responsibility for production
            ownership. This document defines the scope and expectations so Vova knows exactly
            what "full ownership" means for the Aspect project.
          </div>
        </section>

        <hr className={styles.divider} />

        {/* ── TIMELINE ── */}
        <section id="timeline" className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTagRed}>Timeline</span>
            <h2 className={styles.sectionTitle}>Trial Period &amp; Decision</h2>
          </div>

          <div className={styles.timeline}>
            <div className={styles.timelineItem}>
              <div className={styles.timelineDot}>
                <div className={styles.timelineDotCircle} />
                <div className={styles.timelineDotLine} />
              </div>
              <div className={styles.timelineContent}>
                <div className={styles.timelineDate}>May 1, 2026</div>
                <div className={styles.timelineLabel}>Trial Begins</div>
                <div className={styles.timelineDesc}>
                  Kosta starts operating under full ownership model.
                  I provide goals and tasks — Kosta / Vova own production quality.
                </div>
              </div>
            </div>

            <div className={styles.timelineItem}>
              <div className={styles.timelineDot}>
                <div className={styles.timelineDotCircle} />
                <div className={styles.timelineDotLine} />
              </div>
              <div className={styles.timelineContent}>
                <div className={styles.timelineDate}>Mid-May 2026</div>
                <div className={styles.timelineLabel}>Check-in</div>
                <div className={styles.timelineDesc}>
                  Two-week review. Is the agent production-ready? Is Kosta
                  self-sufficient? Can he guarantee quality without me verifying?
                </div>
              </div>
            </div>

            <div className={styles.timelineItem}>
              <div className={styles.timelineDot}>
                <div className={styles.timelineDotCircleGreen} />
                <div className={styles.timelineDotLine} />
              </div>
              <div className={styles.timelineContent}>
                <div className={styles.timelineDate}>End of May 2026</div>
                <div className={styles.timelineLabel}>Decision: Continue</div>
                <div className={styles.timelineDesc}>
                  If ownership model works — Kosta continues as the Aspect project owner.
                  Ongoing engagement, same model.
                </div>
              </div>
            </div>

            <div className={styles.timelineItem}>
              <div className={styles.timelineDot}>
                <div className={styles.timelineDotCircleRed} />
              </div>
              <div className={styles.timelineContent}>
                <div className={styles.timelineDate}>End of May 2026</div>
                <div className={styles.timelineLabel}>Decision: Terminate</div>
                <div className={styles.timelineDesc}>
                  If the ownership model doesn't work — engagement ends by end of May.
                </div>
              </div>
            </div>
          </div>

          <div className={styles.calloutAmber}>
            <strong>What "works" means:</strong> I give a high-level requirement
            (e.g., "make sure the Zer4U agent answers inventory questions accurately") and
            Kosta handles everything — understanding the data, testing as a user, fixing
            issues, deploying, and confirming it's production-ready — without me needing to
            check the result.
          </div>
        </section>

      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        <p className={styles.footerText}>
          Aspect Project — Ownership Handoff Document — April 2026
        </p>
      </footer>
    </div>
  );
}
