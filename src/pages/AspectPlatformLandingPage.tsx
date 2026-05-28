import { useEffect, useState, useRef, type FormEvent, type ReactNode } from 'react';
import styles from './AspectPlatformLandingPage.module.css';

/* ===== Aspect Platform Landing =====
 * Single-page marketing landing for the Aspect analytics platform.
 * Reuses the Lybi landing design system (LybiLandingPage.module.css) in
 * its V3 variant so the visual style matches lybi.ai exactly:
 * two-column sections, bento cards, hero orbit graphic, dark CTA + footer.
 * Content answers the two key buyer objections: "why not just point Claude
 * at my data?" and "how do I measure the profit this gives me?".
 */

const WORDMARK = 'Aspect';

/* ===== Scroll Reveal Hook ===== */

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

/* ===== Shared Components ===== */

function Wordmark({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <a
      href="#top"
      className={className}
      style={{
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 700,
        fontSize: '24px',
        letterSpacing: '-0.01em',
        color: dark ? '#ffffff' : '#0F172A',
        textDecoration: 'none',
      }}
    >
      {WORDMARK}
      <span style={{ color: '#680662' }}>.</span>
    </a>
  );
}

function IconBadge({ children }: { children: ReactNode }) {
  return <span className={styles.iconBadge} aria-hidden="true">{children}</span>;
}

const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const icons = {
  sql: (
    <svg {...svgProps}>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3" />
      <path d="M20 5v5" />
      <path d="M4 11v6c0 1.7 3.6 3 8 3" />
      <path d="m14 17 2.5 2.5L21 15" />
    </svg>
  ),
  layers: (
    <svg {...svgProps}>
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </svg>
  ),
  bolt: (
    <svg {...svgProps}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  ),
  crew: (
    <svg {...svgProps}>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17.5" cy="10" r="2.2" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M16.5 15c2.5 0 4.5 1.8 4.5 5" />
    </svg>
  ),
  code: (
    <svg {...svgProps}>
      <path d="m9 8-4 4 4 4" />
      <path d="m15 8 4 4-4 4" />
    </svg>
  ),
  grid: (
    <svg {...svgProps}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M3 14.5h18M9 4.5v15" />
    </svg>
  ),
  gauge: (
    <svg {...svgProps}>
      <path d="M4.5 18a9 9 0 1 1 15 0" />
      <path d="m12 18 4-5" />
      <circle cx="12" cy="18" r="1.4" fill="currentColor" />
    </svg>
  ),
};

function HeroVisual() {
  const bars = [34, 46, 41, 58, 52, 71, 63, 88];
  return (
    <div className={styles.heroVisual} aria-hidden="true">
      <div className={styles.answerCard}>
        <div className={styles.answerHead}>
          <span className={styles.answerHeadDot} />
          Aspect
          <span className={styles.answerBadge}>Answer</span>
        </div>
        <p className={styles.answerQ}>"Show me income for the last two months"</p>
        <div className={styles.answerKpiRow}>
          <span className={styles.answerKpi}>$2.41M</span>
          <span className={styles.answerDelta}>&#9650; 18.2% MoM</span>
        </div>
        <svg className={styles.answerChart} viewBox="0 0 320 96" role="img">
          {bars.map((v, i) => {
            const bw = 30;
            const gap = 11;
            const x = i * (bw + gap) + 3;
            const h = (v / 100) * 82;
            const last = i === bars.length - 1;
            return (
              <rect
                key={i}
                x={x}
                y={88 - h}
                width={bw}
                height={h}
                rx="5"
                fill={last ? '#EA580C' : 'rgba(234,88,12,0.22)'}
              />
            );
          })}
        </svg>
        <p className={styles.answerNote}>
          Growth led by the North region — up 31% vs. the prior period.
        </p>
        <div className={styles.miniCard}>
          <span className={styles.miniCardLabel}>Churn risk<br />flagged</span>
          <span className={styles.miniCardValue}>3 accounts</span>
        </div>
      </div>
    </div>
  );
}

function Nav({ onOpenContact }: { onOpenContact: () => void }) {
  return (
    <nav className={styles.nav}>
      <div className={styles.navContent}>
        <Wordmark className={styles.navLogo} />
        <div className={styles.navRight}>
          <div className={styles.navLinks}>
            <a href="#analysis" className={styles.navLink}>What it does</a>
            <a href="#why-aspect" className={styles.navLink}>Why Aspect</a>
            <a href="#roi" className={styles.navLink}>The value</a>
            <a href="#how" className={styles.navLink}>How it works</a>
          </div>
          <button className={styles.navCta} onClick={onOpenContact}>
            Let's talk
          </button>
        </div>
      </div>
    </nav>
  );
}

function Footer({ onOpenContact }: { onOpenContact: () => void }) {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContent}>
        <div className={styles.footerLeft}>
          <Wordmark className={styles.footerLogo} dark />
          <p className={styles.footerCopyright}>
            &copy; {new Date().getFullYear()} Aspect. All rights reserved.
          </p>
        </div>
        <div className={styles.footerCenter}>
          <a href="#analysis" className={styles.footerLink}>What it does</a>
          <a href="#why-aspect" className={styles.footerLink}>Why Aspect</a>
          <a href="#how" className={styles.footerLink}>How it works</a>
        </div>
        <div className={styles.footerRight}>
          <button
            className={styles.footerLink}
            onClick={onOpenContact}
            style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}
          >
            Contact
          </button>
        </div>
      </div>
    </footer>
  );
}

/* ===== Contact Modal ===== */

function ContactModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setName('');
        setEmail('');
        setCompany('');
        setMessage('');
        setSubmitted(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSendError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/aspect/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, company, message }),
      });
      if (!res.ok) throw new Error('Failed to send');
      setSubmitted(true);
    } catch {
      setSendError('Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose} />
      <div className={styles.modalBox} role="dialog" aria-modal="true">
        <button className={styles.modalClose} onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {submitted ? (
          <div className={styles.modalSuccess}>
            <div className={styles.modalSuccessIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className={styles.modalSuccessText}>Thank you, we'll be in touch.</p>
          </div>
        ) : (
          <>
            <h2 className={styles.modalTitle}>Let's talk</h2>
            <p className={styles.modalSubtitle}>See Aspect run on your data.</p>
            <form className={styles.modalForm} onSubmit={handleSubmit}>
              <div className={styles.formField}>
                <label className={styles.formLabel} htmlFor="contact-name">Full name</label>
                <input
                  id="contact-name"
                  className={styles.formInput}
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel} htmlFor="contact-email">Email address</label>
                <input
                  id="contact-email"
                  className={styles.formInput}
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel} htmlFor="contact-company">
                  Company <span className={styles.formLabelOptional}>(optional)</span>
                </label>
                <input
                  id="contact-company"
                  className={styles.formInput}
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Company name"
                />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel} htmlFor="contact-message">
                  Message <span className={styles.formLabelOptional}>(optional)</span>
                </label>
                <textarea
                  id="contact-message"
                  className={`${styles.formInput} ${styles.formTextarea}`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us about your data and what you'd like to ask it..."
                />
              </div>
              {sendError && <p className={styles.formError}>{sendError}</p>}
              <button type="submit" className={styles.formSubmit} disabled={sending}>
                {sending ? 'Sending…' : 'Send'}
              </button>
            </form>
          </>
        )}
      </div>
    </>
  );
}

/* ===== Page ===== */

export function AspectPlatformLandingPage() {
  const [contactOpen, setContactOpen] = useState(false);
  const revealRef = useScrollReveal();

  const openContact = () => setContactOpen(true);
  const closeContact = () => setContactOpen(false);

  // Offset so anchor jumps clear the sticky nav.
  const anchorOffset = { scrollMarginTop: '96px' };

  useEffect(() => {
    document.title = 'Aspect — Your data, finally talking';

    // Enable scrolling for landing page (override global overflow:hidden)
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
      <Nav onOpenContact={openContact} />

      <div className={styles.v3PageContent}>
        {/* Section 1 — Hero */}
        <section className={styles.heroSection}>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>THE AI ANALYTICS PLATFORM</p>
            <h1 className={styles.h1}>Your data already has the answers. We make it talk.</h1>
            <p className={styles.subtitle}>
              Every company collects more data than ever — and still waits days for a
              straight answer. Aspect is the AI analyst layer that turns any database into
              plain-language insight: instant, explained, and reliable enough to bet a
              decision on.
            </p>
            <button className={styles.primaryButton} onClick={openContact}>
              Book a demo <span aria-hidden="true">&rarr;</span>
            </button>
          </div>
          <HeroVisual />
        </section>

        {/* Section — Why now / the opportunity */}
        <section className={styles.sectionSecondary}>
          <div className={`${styles.sectionContent} ${styles.reveal}`}>
            <h2 className={styles.h2}>Why now</h2>
            <div>
              <p className={styles.bodyText}>
                Two forces are colliding. Companies are drowning in data and starving for
                answers — every real question still routes through an analyst, a dashboard
                that's already stale, and a queue measured in days.
              </p>
              <p className={styles.bodyText}>
                And for the first time, AI can read a business question and answer it from
                the raw data. The capability threshold just moved — what needed a team and
                a quarter now takes a sentence and a few seconds.
              </p>
              <p className={styles.bodyTextBold}>
                The question was never whether AI touches analytics. It's who makes it
                trustworthy. Raw models hallucinate numbers; whoever turns them into an
                analyst you can rely on owns the category — and every organization with a
                database is a customer.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2 — It's analysis, not search */}
        <section id="analysis" className={styles.sectionPrimary} style={anchorOffset}>
          <div className={`${styles.sectionContent} ${styles.reveal}`}>
            <h2 className={styles.h2}>It's not search. It's analysis.</h2>
            <div>
              <p className={styles.bodyText}>
                Most "AI for your data" tools retrieve — they find the document, quote the
                row, summarize the page. That's a smarter search box.
              </p>
              <p className={styles.bodyText}>
                Aspect <em>reasons</em>. Ask it <em>"show me income for the last two months"</em> or
                <em> "analyze where we're losing potential profit,"</em> and it breaks the
                question into steps, pulls the right data, runs the math, checks its own
                result, and explains what it means — like a senior analyst who never sleeps
                and never waits for the next sprint.
              </p>
              <div className={styles.inlineMock} aria-hidden="true">
                <p className={styles.answerQ} style={{ marginBottom: '14px' }}>
                  "Where are we losing potential profit?"
                </p>
                <svg viewBox="0 0 300 72" style={{ display: 'block', width: '100%' }} role="img">
                  <defs>
                    <linearGradient id="aspArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(234,88,12,0.22)" />
                      <stop offset="100%" stopColor="rgba(234,88,12,0)" />
                    </linearGradient>
                  </defs>
                  <path d="M0 50 L40 44 L80 52 L120 30 L160 36 L200 18 L240 26 L300 10 L300 72 L0 72 Z" fill="url(#aspArea)" />
                  <path d="M0 50 L40 44 L80 52 L120 30 L160 36 L200 18 L240 26 L300 10" fill="none" stroke="#EA580C" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="120" cy="30" r="3.5" fill="#fff" stroke="#EA580C" strokeWidth="2" />
                  <circle cx="300" cy="10" r="3.5" fill="#EA580C" />
                </svg>
                <p className={styles.answerNote} style={{ marginTop: '12px' }}>
                  Margin leak isolated to 2 SKUs in Wholesale — flagged automatically.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3 — Objection 1: why not just use Claude (card section) */}
        <section id="why-aspect" className={styles.sectionSecondary} style={anchorOffset}>
          <div className={`${styles.sectionContentWide} ${styles.reveal}`}>
            <div style={{ maxWidth: '720px', margin: '0 auto 48px', textAlign: 'center' }}>
              <p className={styles.eyebrow} style={{ justifyContent: 'center' }}>WHY ASPECT</p>
              <h2 className={styles.h2centered}>
                "Why do I need you? I can just point Claude at my data."
              </h2>
              <p className={styles.bodyText} style={{ marginTop: '20px' }}>
                You can. And you'll learn — the expensive way — that the model was never
                the hard part. Claude is a brilliant engine. But an engine is not a car.
                Between the raw model and a system you can trust with a business question
                sits the work nobody sees:
              </p>
            </div>

            <div className={styles.cardsGrid} style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className={styles.card} style={{ gridColumn: 'auto' }}>
                <IconBadge>{icons.sql}</IconBadge>
                <h3 className={styles.h3}>Reliable SQL, every time</h3>
                <p className={styles.bodyText}>
                  One wrong join and the model hands you a confident, false number.
                  Trustworthy question-to-SQL is months of engineering — not a clever
                  prompt.
                </p>
              </div>
              <div className={styles.card}>
                <IconBadge>{icons.layers}</IconBadge>
                <h3 className={styles.h3}>A structure built for answers</h3>
                <p className={styles.bodyText}>
                  Raw schemas are built for storage, not analysis. Without a data model
                  shaped for real questions, the AI guesses — and guesses wrong.
                </p>
              </div>
              <div className={styles.card}>
                <IconBadge>{icons.bolt}</IconBadge>
                <h3 className={styles.h3}>Speed on heavy questions</h3>
                <p className={styles.bodyText}>
                  "Profit loss by segment across two months" can crush a naïve query.
                  Knowing when to pre-compute and warehouse is the gap between a 2-second
                  answer and a timeout.
                </p>
              </div>
              <div className={styles.card}>
                <IconBadge>{icons.crew}</IconBadge>
                <h3 className={styles.h3}>A crew, not one brain</h3>
                <p className={styles.bodyText}>
                  One model doing everything is a mediocre generalist. Specialized agents
                  — each owning analytics, data, its own domain — are what make the
                  answers genuinely good.
                </p>
              </div>
            </div>

            <p
              className={styles.bodyTextBold}
              style={{ maxWidth: '720px', margin: '48px auto 0', textAlign: 'center' }}
            >
              Point a raw model at your warehouse and you'll spend six months and real
              budget arriving at a worse version of what we already ship. We didn't sell
              you a model — we solved the part that takes a year.
            </p>
          </div>
        </section>

        {/* Section 4 — Objection 2: measuring ROI */}
        <section id="roi" className={styles.sectionPrimary} style={anchorOffset}>
          <div className={`${styles.sectionContent} ${styles.reveal}`}>
            <h2 className={styles.h2}>"How do I measure the profit this gives me?"</h2>
            <div>
            <p className={styles.bodyText}>
              Honestly? No one can hand you a number that says <em>"+$240,000 in
              revenue."</em> Distrust anyone who claims they can. Here's what actually
              moves the needle:
            </p>
            <ul className={styles.bulletList}>
              <li className={styles.bulletItem}>
                <span className={styles.bulletDot} />
                <span>
                  <strong>Reports on the fly, at zero build cost.</strong> Today every
                  report is a ticket, a queue, a wait. With Aspect the report <em>is</em> the
                  question — the cost of "I wonder if…" drops to nothing, so people finally
                  ask.
                </span>
              </li>
              <li className={styles.bulletItem}>
                <span className={styles.bulletDot} />
                <span>
                  <strong>Key indicators, surfaced — not buried.</strong> The metrics that
                  decide your quarter are in your data right now. Aspect makes them visible
                  on demand, not once a month in a slide nobody reads.
                </span>
              </li>
              <li className={styles.bulletItem}>
                <span className={styles.bulletDot} />
                <span>
                  <strong>Insights you didn't know to look for.</strong> The segment
                  quietly bleeding margin, the pattern that predicts churn — Aspect flags
                  what isn't obvious.
                </span>
              </li>
              <li className={styles.bulletItem}>
                <span className={styles.bulletDot} />
                <span>
                  <strong>Decisions, sooner.</strong> Value lives in the decision you make
                  a week earlier because the answer took seconds, not a sprint.
                </span>
              </li>
            </ul>
            <p className={styles.bodyTextBold}>
              The ROI isn't a line item. It's the analyst hours you stop burning and the
              blind spots you stop missing — compounding, every single day.
            </p>
            </div>
          </div>
        </section>

        {/* Section 5 — Under the hood */}
        <section id="how" className={styles.sectionSecondary} style={anchorOffset}>
          <div className={`${styles.sectionContent} ${styles.reveal}`}>
            <h2 className={styles.h2}>Under the hood</h2>
            <div>
              <div style={{ marginBottom: '32px' }}>
                <IconBadge>{icons.crew}</IconBadge>
                <h3 className={styles.h3}>Multi-agent crew</h3>
                <p className={styles.bodyText}>
                  Specialized AI agents, each an expert in its domain — analytics, data,
                  and more. The right specialist handles each part of every question.
                </p>
              </div>
              <div style={{ marginBottom: '32px' }}>
                <IconBadge>{icons.code}</IconBadge>
                <h3 className={styles.h3}>Question &rarr; SQL engine</h3>
                <p className={styles.bodyText}>
                  Turns plain-language questions into precise, correct queries against your
                  real database. The numbers come back right, not lucky.
                </p>
              </div>
              <div style={{ marginBottom: '32px' }}>
                <IconBadge>{icons.grid}</IconBadge>
                <h3 className={styles.h3}>Schema Builder</h3>
                <p className={styles.bodyText}>
                  Designs a data structure optimized for analysis, so answers come back
                  fast and accurate instead of approximate.
                </p>
              </div>
              <div>
                <IconBadge>{icons.gauge}</IconBadge>
                <h3 className={styles.h3}>Heavy-query optimizer</h3>
                <p className={styles.bodyText}>
                  Detects expensive analyses and builds the data warehouse behind them, so
                  even your deepest questions stay instant.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6 — Banner */}
        <section className={styles.bannerSection}>
          <div className={styles.reveal}>
            <p className={styles.bannerText}>
              Aspect turns your database into something you can simply ask — and trust
              the answer.
            </p>
            <button
              className={styles.textLink}
              onClick={openContact}
              style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}
            >
              See it on your data <span aria-hidden="true">&rarr;</span>
            </button>
          </div>
        </section>

        {/* Section 7 — Final CTA */}
        <section className={styles.ctaSection}>
          <div className={styles.reveal}>
            <p className={styles.ctaHeadline}>
              Your competitors are still waiting on next week's report.
            </p>
            <p className={styles.ctaSubheadline}>
              Stop querying your data. Start asking it.
            </p>
            <button className={styles.primaryButton} onClick={openContact}>
              Let's talk <span aria-hidden="true">&rarr;</span>
            </button>
          </div>
        </section>
      </div>

      <Footer onOpenContact={openContact} />
      <ContactModal isOpen={contactOpen} onClose={closeContact} />
    </div>
  );
}
