import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './AboutShlomiPage.module.css';

export function AboutShlomiPage() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    document.title = 'Shlomi Zevin — CTO | Lybi';
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    return () => { document.documentElement.style.overflow = ''; document.body.style.overflow = ''; };
  }, []);

  return (
    <div className={`${styles.page} ${dark ? styles.dark : styles.light}`}>
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <Link to="/lybi" className={styles.navLogo}>
            <img src="/img/lybi-logo-transparent.png" alt="Lybi" />
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className={styles.themeToggle} onClick={() => setDark(!dark)}>
              {dark ? '☀️' : '🌙'}
            </button>
            <span className={styles.navBadge}>Our Team</span>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>Technology Lead</p>
          <h1 className={styles.h1}>Shlomi Zevin</h1>
          <p className={styles.heroSub}>
            20+ years building systems end-to-end — from neural network research and algorithm design
            to production platforms. Now architecting AI agents with deep understanding
            of what makes them work and what makes them fail.
          </p>
          <div className={styles.heroStats}>
            <div className={styles.stat}>
              <span className={styles.statNum}>20+</span>
              <span className={styles.statLabel}>Years in tech</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>2+</span>
              <span className={styles.statLabel}>Years in AI agents</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>100x</span>
              <span className={styles.statLabel}>AI-powered dev</span>
            </div>
          </div>
        </div>
      </header>

      {/* ===== QUOTE ===== */}
      <div className={styles.quote}>
        <p className={styles.quoteText}>
          I built neural networks, trained models, debugged why they predict what they predict.
          That background is why I know <em>when an LLM will work and when it won't</em> —
          and how to build agents that handle both.
        </p>
      </div>

      {/* ===== 3 PILLARS ===== */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.pillarGrid}>
            <div className={styles.pillar}>
              <div className={styles.pillarIcon}>🔬</div>
              <h3>Research → AI agents</h3>
              <p>
                Neural networks, decision trees, genetic algorithms, prediction models —
                hands-on research that now translates directly to knowing where LLMs are strong,
                where they'll hallucinate, and how to architect around it.
              </p>
            </div>
            <div className={styles.pillar}>
              <div className={styles.pillarIcon}>🌐</div>
              <h3>All-around player</h3>
              <p>
                Client, server, DB, cloud, DevOps, Unix, networking — every layer.
                Not a specialist in one thing. A technology authority who sees the whole system.
              </p>
            </div>
            <div className={styles.pillar}>
              <div className={styles.pillarIcon}>⚡</div>
              <h3>AI builds the AI</h3>
              <p>
                The dev process itself is AI-powered. Claude Code handles code, tests, deployment.
                Shlomi directs the AI with 20 years of knowing what to build. Months → days.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== DOMAINS ===== */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>Domains</p>
          <div className={styles.domainGrid}>
            <div className={styles.domainFeatured}>
              <div className={styles.domainFeaturedCard}>
                <div className={styles.domainFeaturedIcon}>🤖</div>
                <h3>AI Agents</h3>
                <p>
                  Started building AI chat agents before the term "agent" existed. Mystic AI was one of the
                  first consumer AI apps — fortune telling, astrology, palm reading via chat. Then banking
                  onboarding, sales negotiation, wellness companions. Now — multi-crew agent architectures
                  with chain reactions, triggered context, and memory systems.
                </p>
                <div className={styles.domainFeaturedMeta}>2+ years deep</div>
              </div>
              <div className={styles.domainFeaturedCard}>
                <div className={styles.domainFeaturedIcon}>📊</div>
                <h3>Algo Trading & Research</h3>
                <p>
                  Personal algo-trading project in crypto and stocks. Started with decision trees, evolved
                  to neural networks. Built the models, trained them, evaluated performance, traded real money.
                  This is where the deep understanding of how neural networks actually work comes from —
                  not a course, actual research with real stakes.
                </p>
                <div className={styles.domainFeaturedMeta}>Neural networks, real money</div>
              </div>
            </div>

            <div className={styles.domainFeatured}>
              <div className={styles.domainFeaturedCard}>
                <div className={styles.domainFeaturedIcon}>⚽</div>
                <div className={styles.domainHeader}>
                  <h3>Sports</h3>
                  <span className={styles.domainBadge}>Product sold to NI</span>
                </div>
                <p>
                  Two products. <strong>Octopol</strong> — sports betting prediction algorithm, built a full
                  prediction model for match outcomes. <strong>Sidelines</strong> — fantasy football optimization
                  tool using genetic algorithms to build the strongest possible team from the player pool.
                  Built both from scratch. Sidelines was acquired by NI.
                </p>
                <div className={styles.domainFeaturedMeta}>Genetic algorithms, prediction models</div>
              </div>
              <div className={styles.domainFeaturedCard}>
                <div className={styles.domainFeaturedIcon}>🧒</div>
                <h3>Health & Therapy</h3>
                <p>
                  Doing App — AI-powered platform for autistic children. Behavior analysis with AI,
                  therapy session management for therapists, visual communication boards for kids,
                  AI-based counseling support. The whole thing AI-driven — from the analysis to the
                  recommendations to the daily tools.
                </p>
                <div className={styles.domainFeaturedMeta}>AI in sensitive domains</div>
              </div>
            </div>

            <div className={styles.domainFeatured}>
              <div className={styles.domainFeaturedCard}>
                <div className={styles.domainFeaturedIcon}>🏠</div>
                <h3>Real Estate</h3>
                <p>
                  Co-founded as CTO. Built a brokerage platform from zero — listings, matching,
                  agent management. Full stack, full product, zero to production.
                </p>
                <div className={styles.domainFeaturedMeta}>Co-founder & CTO</div>
              </div>
              <div className={styles.domainFeaturedCard}>
                <div className={styles.domainFeaturedIcon}>🚚</div>
                <h3>Logistics</h3>
                <p>
                  Same-day delivery route optimization. Built an evolutionary algorithm that improves
                  generation by generation — finding the best routes across hundreds of delivery points.
                </p>
                <div className={styles.domainFeaturedMeta}>Evolutionary algorithms</div>
              </div>
            </div>

            <div className={styles.domainFeatured}>
              <div className={styles.domainFeaturedCard}>
                <div className={styles.domainFeaturedIcon}>📚</div>
                <h3>EdTech</h3>
                <p>
                  ML-powered campaign optimization — predicting which campaigns convert
                  and allocating budget automatically. Full platform development end to end.
                </p>
                <div className={styles.domainFeaturedMeta}>ML optimization</div>
              </div>
              <div className={styles.domainFeaturedCard}>
                <div className={styles.domainFeaturedIcon}>🔮</div>
                <h3>Consumer AI</h3>
                <p>
                  Mystic AI — coffee reading, palm reading, astrology, all via AI chat.
                  One of the first consumer AI apps, built before ChatGPT made it mainstream.
                </p>
                <div className={styles.domainFeaturedMeta}>Early AI consumer product</div>
              </div>
            </div>

            <div className={styles.domainFeatured}>
              <div className={styles.domainFeaturedCard}>
                <div className={styles.domainFeaturedIcon}>🔒</div>
                <h3>Privacy Tech</h3>
                <p>
                  Compliance platforms for GDPR and data privacy. Data management,
                  consent flows, audit trails. Enterprise-grade, regulation-driven.
                </p>
                <div className={styles.domainFeaturedMeta}>Enterprise compliance</div>
              </div>
              <div className={styles.domainFeaturedCard}>
                <div className={styles.domainFeaturedIcon}>🎬</div>
                <h3>Creative Tools</h3>
                <p>
                  Storyboard platforms for visual storytelling. B2B SaaS —
                  used by creative teams to plan and present visual narratives.
                </p>
                <div className={styles.domainFeaturedMeta}>B2B SaaS</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== JOURNEY TIMELINE ===== */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>The journey</p>
          <h2 className={styles.h2}>From algorithms to AI agents</h2>

          <div className={styles.timeline}>
            <div className={styles.timelineItem}>
              <div className={styles.timelineDot} />
              <div className={styles.timelineEra}>Early career</div>
              <div className={styles.timelineTitle}>Full-stack systems, complex algorithms</div>
              <div className={styles.timelineDesc}>
                Web platforms, B2B/B2C SaaS, always end-to-end. Founded a real estate brokerage startup.
                Co-founded several startups as CTO (including acquisitions). Always the tech lead —
                hands-on in code, architecture, servers, and product.
              </div>
              <div className={styles.timelineTags}>
                {['React', 'Node.js', 'Python', 'PostgreSQL', 'AWS', 'Docker'].map(t =>
                  <span key={t} className={styles.timelineTag}>{t}</span>
                )}
              </div>
            </div>

            <div className={styles.timelineItem}>
              <div className={styles.timelineDot} />
              <div className={styles.timelineEra}>Research & ML</div>
              <div className={styles.timelineTitle}>Neural networks, prediction, optimization</div>
              <div className={styles.timelineDesc}>
                Algo-trading in crypto & stocks — decision trees, then neural networks. Real money, real models.
                Sports prediction research for algo-betting. Fantasy football optimization using genetic algorithms —
                product acquired by NI. ML-based campaign optimization in EdTech.
                Evolutionary algorithms for same-day delivery route optimization.
              </div>
              <div className={styles.timelineTags}>
                {['Neural Networks', 'Genetic Algorithms', 'Prediction Models', 'Optimization', 'ML'].map(t =>
                  <span key={t} className={styles.timelineTag}>{t}</span>
                )}
              </div>
            </div>

            <div className={styles.timelineItem}>
              <div className={styles.timelineDot} />
              <div className={styles.timelineEra}>AI agents era</div>
              <div className={styles.timelineTitle}>Building agents before they were called agents</div>
              <div className={styles.timelineDesc}>
                Mystic AI — one of the first consumer AI chat apps (coffee reading, astrology).
                Then: banking onboarding agents, sales negotiation, wellness companions.
                Doing app — AI-powered autism therapy with behavior analysis and treatment management.
                Always connecting AI capabilities to real product value.
              </div>
              <div className={styles.timelineTags}>
                {['LLM Agents', 'OpenAI', 'Claude', 'Gemini', 'RAG', 'Multi-agent'].map(t =>
                  <span key={t} className={styles.timelineTag}>{t}</span>
                )}
              </div>
            </div>

            <div className={styles.timelineItem}>
              <div className={styles.timelineDot} />
              <div className={styles.timelineEra}>Now</div>
              <div className={styles.timelineTitle}>AI-powered everything</div>
              <div className={styles.timelineDesc}>
                Don't manage developers — manage AI that develops. Claude Code handles code, tests, deployment.
                The entire dev process is AI-driven. Combined with a fast agent conversion infrastructure
                and deep LLM understanding, this is where 20 years of experience meets exponential speed.
              </div>
              <div className={styles.timelineTags}>
                {['Claude Code', 'AI Dev', '100x Speed', 'Agent Architecture'].map(t =>
                  <span key={t} className={styles.timelineTag}>{t}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TECH STACK ===== */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>Technical depth</p>
          <h2 className={styles.h2}>Stack</h2>

          <div className={styles.stackFlow}>
            {[
              { cat: 'AI / ML', tags: ['LLM Agents', 'RAG', 'OpenAI', 'Claude', 'Gemini', 'Neural Networks', 'Genetic Algorithms', 'Prediction Models', 'Model Evaluation'] },
              { cat: 'Research', tags: ['Algorithm Design', 'Optimization', 'Statistical Modeling', 'Decision Trees', 'Evolutionary Algorithms'] },
              { cat: 'Backend', tags: ['Node.js', 'Python', 'Express', 'REST', 'GraphQL', 'WebSockets', 'SSE', 'Microservices'] },
              { cat: 'Frontend', tags: ['React', 'TypeScript', 'Next.js', 'Real-time UI'] },
              { cat: 'Database', tags: ['PostgreSQL', 'MongoDB', 'Redis', 'Query Optimization', 'Indexing', 'NoSQL', 'BI'] },
              { cat: 'Cloud', tags: ['AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'CI/CD', 'Firebase', 'Unix', 'Networking'] },
              { cat: 'Product', tags: ['UX', 'Spec', 'Architecture', 'Mockups', 'Payments (Stripe)'] },
            ].map(s => (
              <div key={s.cat} className={styles.stackLine}>
                <span className={styles.stackCat}>{s.cat}</span>
                <div className={styles.stackTags}>
                  {s.tags.map(t => <span key={t} className={styles.stackTag}>{t}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== APPROACH ===== */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.sectionInner}>
          <div className={styles.approachRow}>
            <div className={styles.approachItem}>
              <strong>Hands-on</strong>
              <span>Writes code, designs architecture, makes product decisions. Owns the tech.</span>
            </div>
            <div className={styles.approachItem}>
              <strong>Startup DNA</strong>
              <span>Lives the pace. AI-powered dev. Months → days. No process overhead.</span>
            </div>
            <div className={styles.approachItem}>
              <strong>Right-sized</strong>
              <span>Architecture matched to stage. No over-engineering for 100 users.</span>
            </div>
            <div className={styles.approachItem}>
              <strong>Transparent</strong>
              <span>Works alongside founders. Every decision shared — tradeoffs, costs, alternatives.</span>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>Lybi — Technology Team</footer>
    </div>
  );
}
