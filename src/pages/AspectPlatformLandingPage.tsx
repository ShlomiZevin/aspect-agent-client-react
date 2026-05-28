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

function Nav({ onOpenContact }: { onOpenContact: () => void }) {
  return (
    <nav className={styles.nav}>
      <div className={styles.navContent}>
        <Wordmark className={styles.navLogo} />
        <div className={styles.navRight}>
          <div className={styles.navLinks}>
            <a href="#claude" className={styles.navLink}>The Claude question</a>
            <a href="#value" className={styles.navLink}>The value</a>
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
          <a href="#claude" className={styles.footerLink}>The Claude question</a>
          <a href="#value" className={styles.footerLink}>The value</a>
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
        {/* Intro — frames the brief; no marketing hero */}
        <section className={styles.sectionPrimary} style={{ paddingTop: '150px' }}>
          <div
            className={`${styles.sectionContentWide} ${styles.reveal}`}
            style={{ textAlign: 'center', maxWidth: '820px' }}
          >
            <p className={styles.eyebrow} style={{ justifyContent: 'center' }}>ASPECT — INVESTOR BRIEF</p>
            <h1 className={styles.h1} style={{ maxWidth: '780px', margin: '0 auto' }}>
              Two questions. Two straight answers.
            </h1>
            <p className={styles.subtitle} style={{ margin: '0 auto', maxWidth: '600px' }}>
              The two an investor actually asks about a product like ours — and exactly how
              we answer them.
            </p>
          </div>
        </section>

        {/* Section — Q1: the Claude question (card section) */}
        <section id="claude" className={styles.sectionSecondary} style={anchorOffset}>
          <div className={`${styles.sectionContentWide} ${styles.reveal}`}>
            <div style={{ maxWidth: '760px', margin: '0 auto 48px', textAlign: 'center' }}>
              <p className={styles.eyebrow} style={{ justifyContent: 'center' }}>THE CLAUDE QUESTION</p>
              <h2 className={styles.h2centered}>
                "Can't I just connect Claude to my data?"
              </h2>
              <p className={styles.bodyText} style={{ marginTop: '20px' }}>
                There's no such thing. "Connect Claude to your data" isn't a product — it's a
                sentence. Neither is "build a platform from a prompt."
              </p>
              <p className={styles.bodyText}>
                Claude is a tool, and tools were never the hard part — you could build
                anything before Claude too; it just took skill and time. What Claude changed
                is <em>speed, not capability</em>. It's an amplifier: know how to build systems and
                you ship 10x faster. Don't, and you ship garbage faster.
              </p>
            </div>

            <div className={styles.cardsGrid} style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className={styles.card} style={{ gridColumn: 'auto' }}>
                <IconBadge>{icons.code}</IconBadge>
                <h3 className={styles.h3}>Language &rarr; correct SQL</h3>
                <p className={styles.bodyText}>
                  We use Claude where it's genuinely strong: turning a human question into
                  SQL. Making it correct every time — joins, types, edge cases — is
                  engineering, not a prompt.
                </p>
              </div>
              <div className={styles.card}>
                <IconBadge>{icons.layers}</IconBadge>
                <h3 className={styles.h3}>A schema built to be asked</h3>
                <p className={styles.bodyText}>
                  Raw databases store; they don't answer. We model the data so questions map
                  cleanly — the difference between a right answer and a confident wrong one.
                </p>
              </div>
              <div className={styles.card}>
                <IconBadge>{icons.gauge}</IconBadge>
                <h3 className={styles.h3}>Heavy questions, instant</h3>
                <p className={styles.bodyText}>
                  Deep analysis can crush a naïve query. We decide what to pre-compute and
                  warehouse, so the hard questions still return in seconds.
                </p>
              </div>
              <div className={styles.card}>
                <IconBadge>{icons.crew}</IconBadge>
                <h3 className={styles.h3}>A system of agents</h3>
                <p className={styles.bodyText}>
                  Specialized agents own analytics, data, and orchestration. One model doing
                  everything is a generalist. A system of experts is a product.
                </p>
              </div>
            </div>

            <p
              className={styles.bodyTextBold}
              style={{ maxWidth: '760px', margin: '48px auto 0', textAlign: 'center' }}
            >
              The model is a component we command. The system around it is the moat — a year
              of engineering a prompt will never replace.
            </p>
          </div>
        </section>

        {/* Section — Q2: the value question (card section) */}
        <section id="value" className={styles.sectionPrimary} style={anchorOffset}>
          <div className={`${styles.sectionContentWide} ${styles.reveal}`}>
            <div style={{ maxWidth: '760px', margin: '0 auto 48px', textAlign: 'center' }}>
              <p className={styles.eyebrow} style={{ justifyContent: 'center' }}>THE VALUE QUESTION</p>
              <h2 className={styles.h2centered}>
                "How do we measure the benefit to the customer?"
              </h2>
              <p className={styles.bodyText} style={{ marginTop: '20px' }}>
                Precisely — on three axes, measurable from day one.
              </p>
            </div>

            <div className={styles.cardsGrid}>
              <div className={styles.card}>
                <IconBadge>{icons.gauge}</IconBadge>
                <h3 className={styles.h3}>Cycle time &rarr; near zero</h3>
                <p className={styles.bodyText}>
                  A question that took an analyst three days takes three seconds. That
                  before/after is the cleanest number a customer has — and we measure it
                  directly.
                </p>
              </div>
              <div className={styles.card}>
                <IconBadge>{icons.code}</IconBadge>
                <h3 className={styles.h3}>Questions actually asked</h3>
                <p className={styles.bodyText}>
                  Most questions never get asked — too expensive to answer. Drop that cost
                  to zero and decisions move from gut to data. We don't serve demand; we
                  unlock it.
                </p>
              </div>
              <div className={styles.card}>
                <IconBadge>{icons.crew}</IconBadge>
                <h3 className={styles.h3}>Analyst leverage</h3>
                <p className={styles.bodyText}>
                  One person now does what a team did. Capacity freed, reports retired,
                  dashboards nobody has to maintain.
                </p>
              </div>
            </div>

            <p
              className={styles.bodyTextBold}
              style={{ maxWidth: '760px', margin: '48px auto 0', textAlign: 'center' }}
            >
              We don't pitch a soft "insights" story. We collapse the cost and latency of
              every data question to near zero — and that compounds with every question
              asked.
            </p>
          </div>
        </section>

        {/* Section — Final CTA */}
        <section className={styles.ctaSection}>
          <div className={styles.reveal}>
            <p className={styles.ctaHeadline}>
              The model is the commodity. The system is the company.
            </p>
            <p className={styles.ctaSubheadline}>
              That's Aspect.
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
