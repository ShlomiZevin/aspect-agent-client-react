import { useEffect, useRef } from 'react';
import styles from './AspectMarketingSalesPage.module.css';

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const timer = setTimeout(() => {
      const els = container.querySelectorAll(`.${styles.reveal}`);
      if (!els.length) return;
      const obs = new IntersectionObserver(
        (entries) => entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add(styles.revealVisible);
            obs.unobserve(e.target);
          }
        }),
        { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
      );
      els.forEach((el) => obs.observe(el));
      (container as any).__obs = obs;
    }, 60);
    return () => {
      clearTimeout(timer);
      (ref.current as any)?.__obs?.disconnect();
    };
  }, []);
  return ref;
}

export function AspectMarketingSalesPage() {
  const revealRef = useScrollReveal();

  useEffect(() => {
    document.title = 'Aspect · Sales Battle Card';
    const els = [document.documentElement, document.body, document.getElementById('root')];
    els.forEach((el) => { if (el) { el.style.overflow = 'auto'; el.style.height = 'auto'; } });
    return () => {
      els.forEach((el) => { if (el) { el.style.overflow = ''; el.style.height = ''; } });
    };
  }, []);

  return (
    <div className={styles.page} ref={revealRef} id="top">

      {/* ===== NAV ===== */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <a href="#top" className={styles.navBrand}>
            <span className={styles.navBrandWord}>Aspect<span className={styles.navBrandDot}>.</span></span>
            <span className={styles.navBrandTag}>Sales Battle Card</span>
          </a>
          <div className={styles.navLinks}>
            <a href="#q1" className={`${styles.navLink} ${styles.navLinkAccent1}`}>Q1 · LLM Myth</a>
            <a href="#q2" className={`${styles.navLink} ${styles.navLinkAccent2}`}>Q2 · ROI</a>
            <a href="#scenario" className={styles.navLink}>Live Scenario</a>
            <a href="#engine" className={styles.navLink}>Under the Hood</a>
            <button className={styles.navPrint} onClick={() => window.print()}>Print</button>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroEyebrow}>
            <span className={styles.heroEyebrowDot} />
            Internal Use — Sales Enablement
          </div>
          <h1 className={styles.heroH1}>
            Two objections.<br />
            <em>Two ways to close.</em>
          </h1>
          <p className={styles.heroSub}>
            Every qualified prospect raises these exact two questions. Below is the framing,
            the talking points, and the rebuttals — everything you need to handle them in real time.
          </p>
          <div className={styles.heroCards}>
            <a href="#q1" className={`${styles.heroCard} ${styles.heroCardOrange}`}>
              <span className={`${styles.heroCardNum} ${styles.heroCardNumOrange}`}>01</span>
              <div>
                <div className={styles.heroCardLabel}>Objection · Claude</div>
                <div className={styles.heroCardTitle}>"Why pay you when I can just connect Claude to my database?"</div>
              </div>
            </a>
            <a href="#q2" className={`${styles.heroCard} ${styles.heroCardCyan}`}>
              <span className={`${styles.heroCardNum} ${styles.heroCardNumCyan}`}>02</span>
              <div>
                <div className={styles.heroCardLabel}>Objection · ROI</div>
                <div className={styles.heroCardTitle}>"How do I calculate the exact profit your platform gives me?"</div>
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* ===== OBJECTION 1 ===== */}
      <section id="q1" className={styles.section} style={{ scrollMarginTop: 72 }}>
        <div className={`${styles.sectionInner} ${styles.reveal}`}>

          <div className={styles.objectionLabel}>
            <span className={`${styles.objectionLabelBadge} ${styles.badgeOrange}`}>Objection 01</span>
            <span className={`${styles.objectionLabelLine} ${styles.lineOrange}`} />
          </div>

          <div className={`${styles.questionBlock} ${styles.questionBlockOrange}`}>
            <div className={`${styles.questionTag} ${styles.questionTagOrange}`}>The Prospect Says</div>
            <p className={styles.questionText}>
              "Why do I need you? I can just get Claude — or any LLM — and connect it directly to my database."
            </p>
          </div>

          <div className={styles.answerHeadline}>
            <div className={styles.answerHeadlineLabel}>Lead with this</div>
            <p className={styles.answerHeadlineText}>
              <strong>There is no "just connect."</strong> Claude is an engine — it's an amplifier, not a vehicle.
              Calling an API is free. The hard part is the production system that makes it trustworthy on real enterprise data.
              Anyone can always build anything — that was true before LLMs too. The question is whether you want
              to spend 18 months building infrastructure, or{' '}
              <strong>be live in 90 days on a system that's already proven on customer data.</strong>
            </p>
          </div>

          <div className={styles.twoCol}>
            <div>
              <div className={styles.tpLabel}>Talking Points</div>
              <ul className={styles.tpList}>
                <li className={styles.tpItem}>
                  <span className={`${styles.tpBullet} ${styles.bulletOrange}`} />
                  <span>
                    <strong>Access to the model was never the bottleneck.</strong>{' '}
                    Anyone can call Claude today. The bottleneck is the orchestration layer — schema
                    modeling, SQL correctness, query optimization, agent routing, and audit trails.
                  </span>
                </li>
                <li className={styles.tpItem}>
                  <span className={`${styles.tpBullet} ${styles.bulletOrange}`} />
                  <span>
                    <strong>A prompt to a database is a demo, not a product.</strong>{' '}
                    It will answer 70% of questions correctly and hallucinate confidently on the rest.
                    You can't run a P&amp;L review on a system that's right most of the time.
                  </span>
                </li>
                <li className={styles.tpItem}>
                  <span className={`${styles.tpBullet} ${styles.bulletOrange}`} />
                  <span>
                    <strong>We actually use Claude</strong> — as the underlying engine for language-to-SQL
                    translation. The model is one component. Swap it tomorrow and the product stands.
                    That's what a real platform means.
                  </span>
                </li>
                <li className={styles.tpItem}>
                  <span className={`${styles.tpBullet} ${styles.bulletOrange}`} />
                  <span>
                    <strong>Claude is an amplifier.</strong> Build well → 10× faster time-to-insight.
                    Build without the right architecture → you produce technical debt at 10× speed.
                  </span>
                </li>
                <li className={styles.tpItem}>
                  <span className={`${styles.tpBullet} ${styles.bulletOrange}`} />
                  <span>
                    <strong>The hidden cost is time.</strong> An internal team building from scratch:
                    12–18 months to a demo that still hallucinates on edge cases. You could be live next quarter.
                  </span>
                </li>
              </ul>
            </div>

            <div>
              <div className={styles.tpLabel}>What "Just Connecting" Actually Requires</div>
              <div className={styles.cardsGrid} style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className={styles.card}>
                  <div className={`${styles.cardTag} ${styles.tagOrange}`}>Module 01</div>
                  <div className={styles.cardTitle}>Language → Correct SQL</div>
                  <p className={styles.cardBody}>Joins, type casts, NULL handling, edge cases — accurate every time. That's months of engineering, not a system prompt.</p>
                </div>
                <div className={styles.card}>
                  <div className={`${styles.cardTag} ${styles.tagOrange}`}>Module 02</div>
                  <div className={styles.cardTitle}>Schema Built to Be Asked</div>
                  <p className={styles.cardBody}>Raw databases store data. They don't answer questions. We re-model the schema so language maps cleanly to structure.</p>
                </div>
                <div className={styles.card}>
                  <div className={`${styles.cardTag} ${styles.tagOrange}`}>Module 03</div>
                  <div className={styles.cardTitle}>Heavy Queries in Seconds</div>
                  <p className={styles.cardBody}>Multi-million-row analyses built into temporary warehouses on the fly. No timeout. No spinner for 3 minutes.</p>
                </div>
                <div className={styles.card}>
                  <div className={`${styles.cardTag} ${styles.tagOrange}`}>Module 04</div>
                  <div className={styles.cardTitle}>Crew of Specialist Agents</div>
                  <p className={styles.cardBody}>Analytics agent, data lookup agent, planning agent, orchestrator. One chatbot is not a product you can stake decisions on.</p>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.rebuttalsLabel}>If they push back</div>
          <div className={styles.rebuttals}>
            <div className={styles.rebuttal}>
              <div className={styles.rebuttalQ}>"Our IT team is sharp — they'll just spin it up."</div>
              <div className={styles.rebuttalA}>
                Sharp team, wrong problem. They'll have a working prototype in two weeks.
                They'll spend 18 months making it stop lying on edge cases.
                That gap — the production-grade, auditable, scalable gap — is exactly what you're paying us to skip.
                We're already running on live customer data. They haven't started yet.
              </div>
            </div>
            <div className={styles.rebuttal}>
              <div className={styles.rebuttalQ}>"Claude keeps getting better and cheaper every month."</div>
              <div className={styles.rebuttalA}>
                Correct — and we benefit from every model improvement for free.
                A faster engine makes our system faster. But a better engine doesn't{' '}
                <strong>build</strong> the schema, doesn't <strong>generate</strong> the correct SQL,
                doesn't <strong>orchestrate</strong> the agents, and doesn't <strong>build</strong> the warehouse.
                The platform is the value. The model is interchangeable.
              </div>
            </div>
            <div className={styles.rebuttal}>
              <div className={styles.rebuttalQ}>"Isn't this just an LLM wrapper? That's a commodity now."</div>
              <div className={styles.rebuttalA}>
                Swap the model out tomorrow — the product still stands. The schema builder, SQL generator,
                heavy-query optimizer, and agent orchestration are all ours. That's not a wrapper.
                A wrapper is a UI over an API call. This is the infrastructure layer that makes the API call trustworthy.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== OBJECTION 2 ===== */}
      <section id="q2" className={styles.section} style={{ scrollMarginTop: 72, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className={`${styles.sectionInner} ${styles.reveal}`}>

          <div className={styles.objectionLabel}>
            <span className={`${styles.objectionLabelBadge} ${styles.badgeCyan}`}>Objection 02</span>
            <span className={`${styles.objectionLabelLine} ${styles.lineCyan}`} />
          </div>

          <div className={`${styles.questionBlock} ${styles.questionBlockCyan}`}>
            <div className={`${styles.questionTag} ${styles.questionTagCyan}`}>The Prospect Says</div>
            <p className={styles.questionText}>
              "How can I calculate the exact profit your application will provide? I need a concrete number."
            </p>
          </div>

          <div className={styles.answerHeadline}>
            <div className={styles.answerHeadlineLabel}>Lead with this</div>
            <p className={styles.answerHeadlineText}>
              <strong>Don't fight the frame — reframe it.</strong> You can't wire a dollar sign
              directly to a question-answering system, and anyone who claims otherwise is selling you a fantasy.
              What you <em>can</em> measure is the cost of every answer today — in analyst hours, report cycles,
              and delayed decisions — and{' '}
              <strong>how much of that cost we remove.</strong>{' '}
              The profit is the spread. And we give you a query log so you're reading from a meter, not a slide.
            </p>
          </div>

          <div className={styles.twoCol}>
            <div>
              <div className={styles.tpLabel}>Talking Points</div>
              <ul className={styles.tpList}>
                <li className={styles.tpItem}>
                  <span className={`${styles.tpBullet} ${styles.bulletCyan}`} />
                  <span>
                    <strong>Reports on the fly, zero backlog.</strong>{' '}
                    Every ad-hoc analysis you used to scope, ticket, build, review, and revise is now
                    answered in seconds. The cost of that report just dropped to near zero.
                  </span>
                </li>
                <li className={styles.tpItem}>
                  <span className={`${styles.tpBullet} ${styles.bulletCyan}`} />
                  <span>
                    <strong>The questions nobody asked.</strong>{' '}
                    80% of potential analyses never happen — too small to justify the cost.
                    Drop the cost to seconds and your team suddenly explores 10× more of the data surface.
                    That's where non-obvious insights live.
                  </span>
                </li>
                <li className={styles.tpItem}>
                  <span className={`${styles.tpBullet} ${styles.bulletCyan}`} />
                  <span>
                    <strong>The system surfaces what the data won't volunteer.</strong>{' '}
                    Margin drift, dead SKUs, suspicious clusters, churning cohorts. The buyer didn't
                    know to ask — the agent flags it proactively. That's not retrieval. That's analysis.
                  </span>
                </li>
                <li className={styles.tpItem}>
                  <span className={`${styles.tpBullet} ${styles.bulletCyan}`} />
                  <span>
                    <strong>Speed of decisions compounds.</strong>{' '}
                    Days-to-answer becomes seconds across every team that touches data.
                    Every meeting that used to wait on a report now runs with the answer already in the room.
                  </span>
                </li>
              </ul>
            </div>
            <div>
              <div className={styles.tpLabel}>The Three ROI Levers (use on the call)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className={styles.card}>
                  <div className={`${styles.cardTag} ${styles.tagCyan}`}>Lever 1 · Cost Out</div>
                  <div className={styles.cardTitle}>Analyst &amp; BI Hours Displaced</div>
                  <p className={styles.cardBody}>
                    Report prep, weekly slide pulls, data-request backlog — work that took days now takes minutes.
                    Ask: how many analyst-hours per week go to report generation today?
                  </p>
                </div>
                <div className={styles.card}>
                  <div className={`${styles.cardTag} ${styles.tagCyan}`}>Lever 2 · Margin In</div>
                  <div className={styles.cardTitle}>Hidden Leaks Caught &amp; Fixed</div>
                  <p className={styles.cardBody}>
                    Margin drift, dead stock, mispriced items, churning cohorts — surfaced before they compound.
                    One caught leak often pays for the platform for the year.
                  </p>
                </div>
                <div className={styles.card}>
                  <div className={`${styles.cardTag} ${styles.tagCyan}`}>Lever 3 · Capacity</div>
                  <div className={styles.cardTitle}>Questions Actually Asked</div>
                  <p className={styles.cardBody}>
                    The 80% of analyses that never got scoped because the cost wasn't justified.
                    Now they run. New signal, new decisions, new advantage.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.rebuttalsLabel}>If they push back</div>
          <div className={styles.rebuttals}>
            <div className={styles.rebuttal}>
              <div className={styles.rebuttalQ}>"Those efficiency gains sound too clean — where's the proof?"</div>
              <div className={styles.rebuttalA}>
                Fair. After 30 days in your environment, you won't argue ROI from a slide.
                Every query in our platform is logged with its <strong>counterfactual cost</strong> — the estimated
                analyst hours and BI cycles it would have taken without Aspect. You read the value from the meter.
              </div>
            </div>
            <div className={styles.rebuttal}>
              <div className={styles.rebuttalQ}>"My analysts aren't getting fired — those hours don't become cash."</div>
              <div className={styles.rebuttalA}>
                They don't need to be fired. The same team answers{' '}
                <strong>6× more strategic questions per week.</strong>{' '}
                That's capacity created, not headcount cut. The margin and dead-stock recoveries are a{' '}
                <strong>separate</strong> line — real revenue impact, not labor savings.
              </div>
            </div>
            <div className={styles.rebuttal}>
              <div className={styles.rebuttalQ}>"We already have a BI dashboard that covers this."</div>
              <div className={styles.rebuttalA}>
                A dashboard answers the question someone predicted <em>last quarter.</em>{' '}
                We answer the question being asked <strong>right now</strong> — including the ones
                nobody built a chart for. The most valuable insights are always the ones you didn't know to ask for.
                No dashboard surfaces those.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SCENARIO ===== */}
      <section id="scenario" className={styles.scenarioBg} style={{ scrollMarginTop: 72 }}>
        <div className={styles.scenarioInner}>
          <div className={`${styles.scenarioHeader} ${styles.reveal}`}>
            <div className={styles.scenarioHeaderLeft}>
              <div className={styles.scenarioBadge}>
                <span className={styles.scenarioBadgeDot} />
                Live Scenario · Quotable Example
              </div>
              <h2 className={styles.scenarioH2}>
                How a logistics company found a{' '}
                <span>$280k/yr profit leak</span>{' '}
                in one conversation
              </h2>
              <p className={styles.scenarioSubtitle}>
                A real-world scenario showing how Aspect agents don't just retrieve data —
                they actively detect bottlenecks and suggest concrete resource reallocations.
              </p>
            </div>
            <div className={styles.scenarioContext}>
              <div className={styles.scenarioContextLine}>
                <span className={styles.scenarioContextKey}>Company</span>
                <span className={styles.scenarioContextVal}>NorthRoute Logistics</span>
              </div>
              <div className={styles.scenarioContextLine}>
                <span className={styles.scenarioContextKey}>Scale</span>
                <span className={styles.scenarioContextVal}>6 regional hubs, 340 drivers</span>
              </div>
              <div className={styles.scenarioContextLine}>
                <span className={styles.scenarioContextKey}>Problem</span>
                <span className={styles.scenarioContextVal}>Rising fuel cost, no clear cause</span>
              </div>
              <div className={styles.scenarioContextLine}>
                <span className={styles.scenarioContextKey}>Time to insight</span>
                <span className={styles.scenarioContextVal}>14 seconds</span>
              </div>
              <div className={styles.scenarioContextLine}>
                <span className={styles.scenarioContextKey}>BI backlog before</span>
                <span className={styles.scenarioContextVal}>8-day ticket queue</span>
              </div>
            </div>
          </div>

          <div className={`${styles.terminal} ${styles.reveal}`}>
            <div className={styles.terminalBar}>
              <span className={`${styles.terminalDot} ${styles.dotRed}`} />
              <span className={`${styles.terminalDot} ${styles.dotYellow}`} />
              <span className={`${styles.terminalDot} ${styles.dotGreen}`} />
              <span className={styles.terminalTitle}>Aspect · Analytics Agent — NorthRoute Logistics</span>
            </div>
            <div className={styles.terminalBody}>
              <div className={styles.terminalMsg}>
                <div className={`${styles.terminalAvatar} ${styles.avatarUser}`}>VP</div>
                <div className={`${styles.terminalBubble} ${styles.bubbleUser}`}>
                  Our fuel costs are up 18% vs last quarter but our fleet size didn't change. Show me what's driving it.
                </div>
              </div>
              <div className={`${styles.terminalMsg} ${styles.terminalMsgUser}`}>
                <div className={`${styles.terminalBubble} ${styles.bubbleAgent}`}>
                  Analyzing 94,000 routes across Q1–Q2. Cross-referencing vehicle telemetry, route assignments, and maintenance logs…
                  <br /><br />
                  <strong>Finding: 11 vehicles in Hub 3 and Hub 5 are averaging 23% more idle time per route than fleet baseline.</strong>
                  These 11 vehicles account for <em>61% of the excess fuel spend</em> despite representing only 3.2% of your fleet.
                  <br /><br />
                  Root cause signal: their route assignments have a high city-centre loading density with above-average wait windows (avg 28 min/stop vs 11 min fleet-wide). This is a dispatch scheduling issue, not a mechanical one.
                </div>
                <div className={`${styles.terminalAvatar} ${styles.avatarAgent}`}>AI</div>
              </div>
              <div className={styles.terminalMsg}>
                <div className={`${styles.terminalAvatar} ${styles.avatarUser}`}>VP</div>
                <div className={`${styles.terminalBubble} ${styles.bubbleUser}`}>
                  Can you model what happens if we reassign those 11 vehicles to the inter-hub runs instead?
                </div>
              </div>
              <div className={`${styles.terminalMsg} ${styles.terminalMsgUser}`}>
                <div className={`${styles.terminalBubble} ${styles.bubbleAgent}`}>
                  Modeling reallocation: 11 vehicles → inter-hub routes; city-centre loads covered by 14 smaller urban vehicles currently underutilised (avg 58% capacity utilization).
                  <br /><br />
                  <strong>Projected outcome:</strong>
                  <br />— Fuel cost reduction: <em>~$23,400/month</em> (~$280k annualized)
                  <br />— City-centre delivery time: improves by estimated 19% (smaller vehicles, faster urban navigation)
                  <br />— No additional headcount required
                  <br /><br />
                  I've flagged the 14 underutilised urban vehicles and prepared a dispatch reallocation template. Want me to export it to your fleet management system?
                </div>
                <div className={`${styles.terminalAvatar} ${styles.avatarAgent}`}>AI</div>
              </div>
            </div>
          </div>

          <div className={`${styles.metricsRow} ${styles.reveal}`}>
            <div className={styles.metric}>
              <div className={styles.metricTag}>Annual savings</div>
              <div className={`${styles.metricValue} ${styles.metricValueGreen}`}>$280k</div>
              <div className={styles.metricLabel}>Projected fuel cost reduction</div>
            </div>
            <div className={styles.metric}>
              <div className={styles.metricTag}>Time to insight</div>
              <div className={`${styles.metricValue} ${styles.metricValueCyan}`}>14s</div>
              <div className={styles.metricLabel}>vs 8-day BI ticket queue</div>
            </div>
            <div className={styles.metric}>
              <div className={styles.metricTag}>Delivery time</div>
              <div className={`${styles.metricValue} ${styles.metricValueOrange}`}>–19%</div>
              <div className={styles.metricLabel}>City-centre route improvement</div>
            </div>
            <div className={styles.metric}>
              <div className={styles.metricTag}>Extra headcount</div>
              <div className={`${styles.metricValue} ${styles.metricValueViolet}`}>0</div>
              <div className={styles.metricLabel}>No new hires required</div>
            </div>
          </div>

          <div className={`${styles.insightCallout} ${styles.reveal}`}>
            <div className={styles.insightCalloutLabel}>The Non-Obvious Insight — Use This Story</div>
            <p className={styles.insightCalloutText}>
              The VP came in asking about fuel costs. He expected a cost-per-km breakdown.
              What Aspect surfaced was a <strong>dispatch scheduling problem causing a $280k annual leak</strong> —
              one that nobody had a report for, and nobody would have thought to ask about specifically.
              The existing BI dashboard showed total fuel spend. It didn't show that{' '}
              <em>3.2% of the fleet was responsible for 61% of the overrun, and why.</em>{' '}
              That's the difference between a dashboard and an analyst-grade platform.{' '}
              <strong>That one conversation paid for the annual contract.</strong>
            </p>
          </div>
        </div>
      </section>

      {/* ===== UNDER THE HOOD ===== */}
      <section id="engine" className={styles.techBg} style={{ scrollMarginTop: 72 }}>
        <div className={`${styles.techInner} ${styles.reveal}`}>
          <div className={styles.techLabel}>Under the Hood</div>
          <h2 className={styles.techH2}>
            <strong>What makes it production-grade</strong> — the four modules your internal team would have to build
          </h2>
          <div className={styles.techGrid}>
            <div className={styles.techCard}>
              <div className={styles.techCardIndex}>01 ·</div>
              <div className={styles.techCardTitle}>Multi-Agent Crew</div>
              <p className={styles.techCardBody}>
                Specialized agents per domain — Analytics, Data Assistance, Planning, Orchestration.
                Each owns its context. Routes queries to the right expert automatically.
              </p>
            </div>
            <div className={styles.techCard}>
              <div className={styles.techCardIndex}>02 ·</div>
              <div className={styles.techCardTitle}>Natural Language → SQL</div>
              <p className={styles.techCardBody}>
                Translates complex plain-English questions into accurate, optimized SQL.
                Handles joins, type casts, NULL edge cases, and multi-table reasoning reliably.
              </p>
            </div>
            <div className={styles.techCard}>
              <div className={styles.techCardIndex}>03 ·</div>
              <div className={styles.techCardTitle}>Database Schema Builder</div>
              <p className={styles.techCardBody}>
                Automatically builds optimized data structures designed to be queried — not just stored.
                Raw databases store. This makes them answer.
              </p>
            </div>
            <div className={styles.techCard}>
              <div className={styles.techCardIndex}>04 ·</div>
              <div className={styles.techCardTitle}>Long Query Optimizer</div>
              <p className={styles.techCardBody}>
                Dynamically analyzes heavy queries and builds temporary data warehouses on the fly.
                Multi-million-row analyses in seconds, not minutes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CLOSER ===== */}
      <div className={styles.closer}>
        <div className={styles.closerInner}>
          <p className={styles.closerText}>
            <strong>You're not selling a chatbot.</strong>{' '}
            You're selling the answers their business is already paying for — at a fraction of the cost.
          </p>
          <div className={styles.closerMeta}>
            <div>aspect-marketing-sales</div>
            <div>Internal Use Only</div>
          </div>
        </div>
      </div>

    </div>
  );
}
