import { useEffect, useState, useRef, type FormEvent } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import styles from './LybiLandingPage.module.css';

/* ===== Scroll Reveal Hook (V3 only) ===== */

function useScrollReveal(version: string, pageKey: number) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (version !== 'v3') return;
    const container = containerRef.current;
    if (!container) return;

    // Small delay to let the new page DOM render
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

      elements.forEach((el) => {
        // Reset visibility for fresh page
        el.classList.remove(styles.revealVisible);
        observer.observe(el);
      });

      // Store observer for cleanup
      (container as any).__observer = observer;
    }, 50);

    return () => {
      clearTimeout(timer);
      const obs = (container as any).__observer;
      if (obs) obs.disconnect();
    };
  }, [version, pageKey]);

  return containerRef;
}

/* ===== Shared Components ===== */

function Logo({ className }: { className?: string }) {
  return (
    <Link to="/lybi" className={className}>
      <img src="/img/lybi-logo-transparent.png" alt="Lybi" className={styles.logoImg} />
    </Link>
  );
}

function Nav({ onOpenContact }: { onOpenContact: () => void }) {
  const location = useLocation();
  const path = location.pathname;

  return (
    <nav className={styles.nav}>
      <div className={styles.navContent}>
        <Logo className={styles.navLogo} />
        <div className={styles.navRight}>
          <div className={styles.navLinks}>
            <Link
              to="/lybi/belief"
              className={`${styles.navLink} ${path === '/lybi/belief' ? styles.active : ''}`}
            >
              Our Belief
            </Link>
            <Link
              to="/lybi/enable"
              className={`${styles.navLink} ${path === '/lybi/enable' ? styles.active : ''}`}
            >
              What We Enable
            </Link>
            <Link
              to="/lybi/about"
              className={`${styles.navLink} ${path === '/lybi/about' ? styles.active : ''}`}
            >
              About
            </Link>
          </div>
          <button className={styles.navCta} onClick={onOpenContact}>
            Let's talk
          </button>
        </div>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContent}>
        <div className={styles.footerLeft}>
          <Logo className={styles.footerLogo} />
          <p className={styles.footerCopyright}>
            &copy; {new Date().getFullYear()} LYBI.AI. All rights reserved.
          </p>
        </div>
        <div className={styles.footerCenter}>
          <Link to="/lybi/belief" className={styles.footerLink}>Our Belief</Link>
          <Link to="/lybi/enable" className={styles.footerLink}>What We Enable</Link>
          <Link to="/lybi/about" className={styles.footerLink}>About</Link>
        </div>
        <div className={styles.footerRight}>
          <a
            href="https://linkedin.com/company/lybi-ai"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.footerLink}
          >
            LinkedIn
          </a>
          <a href="#" className={styles.footerLink}>Privacy</a>
          <a href="#" className={styles.footerLink}>Terms</a>
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

  // Reset form when modal closes
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

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Client-side only for now — server integration later
    setSubmitted(true);
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
            <p className={styles.modalSubtitle}>We'd love to hear from you.</p>
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
                  placeholder="Tell us what you're looking for..."
                />
              </div>
              <button type="submit" className={styles.formSubmit}>Send</button>
            </form>
          </>
        )}
      </div>
    </>
  );
}

/* ===== Page 1: Home ===== */

function HomePage({ onOpenContact }: { onOpenContact: () => void }) {
  return (
    <>
      {/* Section 1 — Hero */}
      <section className={styles.heroSection}>
        <div className={styles.heroContent}>
          <h1 className={styles.h1}>The Intelligent Relationship System</h1>
          <p className={styles.subtitle}>
            Built for organizations that can't afford to lose
            the connection with their customers.
          </p>
          <Link to="/lybi/belief" className={styles.primaryButton}>
            See how we think <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </section>

      {/* Section 2 — What's broken */}
      <section className={styles.sectionSecondary}>
        <div className={`${styles.sectionContent} ${styles.reveal}`}>
          <h2 className={styles.h2}>What's broken</h2>
          <p className={styles.bodyText}>
            The assumption underlying most engagement is flawed: that relationships
            can be managed like processes. That trust can be designed like interfaces.
            That connection can be optimized like conversion funnels.
          </p>
          <p className={styles.bodyText}>
            This has led us to treat engagement as a feature — something to be bolted
            on and measured in clicks. We've reduced human relationships to "journeys"
            that can be mapped and "touchpoints" that can be optimized.
          </p>
          <p className={styles.bodyText}>
            The result: experiences that feel engineered, communications that feel
            automated, relationships that feel hollow.
          </p>
        </div>
      </section>

      {/* Section 3 — Engagement at scale */}
      <section className={styles.sectionPrimary}>
        <div className={`${styles.sectionContent} ${styles.reveal}`}>
          <h2 className={styles.h2}>Engagement at scale</h2>
          <p className={styles.bodyText}>
            Digital platforms were built to manage processes, not relationships.
            They handle transactions, workflows, and data — but struggle to hold
            a relationship over time.
          </p>
          <p className={styles.bodyText}>
            Meanwhile, people's expectations have shifted completely. In two years,
            the way individuals relate to technology changed more than in the previous
            twenty. Conversational. Personal. Intelligent. Always present.
          </p>
          <p className={styles.bodyText}>
            The gap between what customers now expect — and what organizations can
            actually deliver — is growing faster than any platform can patch.
          </p>
          <p className={styles.bodyTextBold}>
            Engagement requires a system. Not an interface, not a journey, not a feature.
          </p>
        </div>
      </section>

      {/* Section 4 — What we believe */}
      <section className={styles.sectionPrimary}>
        <div className={`${styles.sectionContentWide} ${styles.reveal}`}>
          <h2 className={styles.h2centered}>What we believe</h2>
          <div className={styles.cardsGrid}>
            <div className={`${styles.card} ${styles.reveal} ${styles.revealDelay1}`}>
              <h3 className={styles.h3}>Engagement is not a feature</h3>
              <p className={styles.bodyText}>
                It cannot be bolted on, optimized through A/B tests, or measured
                in clicks. True engagement emerges from systemic design.
              </p>
            </div>
            <div className={`${styles.card} ${styles.reveal} ${styles.revealDelay2}`}>
              <h3 className={styles.h3}>Connection erodes gradually</h3>
              <p className={styles.bodyText}>
                Small, well-timed interactions build trust over time. The absence
                of the right action at the right moment is what slowly breaks a relationship.
              </p>
            </div>
            <div className={`${styles.card} ${styles.reveal} ${styles.revealDelay3}`}>
              <h3 className={styles.h3}>Judgment over automation</h3>
              <p className={styles.bodyText}>
                The value is in knowing when to act, how to respond, and what matters.
                Good systems enable good decisions — fast.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5 — Banner */}
      <section className={styles.bannerSection}>
        <div className={styles.reveal}>
          <p className={styles.bannerText}>
            Lybi enables organizations to operate engagement as a living system —
            adaptive, intelligent, and built for the complexity of real relationships.
          </p>
          <Link to="/lybi/belief" className={styles.textLink}>
            Read our belief <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </section>

      {/* Section 6 — Final CTA */}
      <section className={styles.ctaSection}>
        <div className={styles.reveal}>
          <p className={styles.ctaHeadline}>
            Your customers already live in the AI era.
          </p>
          <p className={styles.ctaSubheadline}>
            Their relationship with your organization doesn't have to stay behind.
          </p>
          <button className={styles.primaryButton} onClick={onOpenContact}>
            Let's talk <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </section>
    </>
  );
}

/* ===== Page 2: Our Belief ===== */

function BeliefPage() {
  return (
    <>
      {/* Section 1 — Hero */}
      <section className={styles.heroSection}>
        <div className={styles.heroContentNarrow}>
          <p className={styles.eyebrow}>OUR BELIEF</p>
          <h1 className={styles.h1}>Rethinking digital engagement</h1>
          <p className={styles.subtitle}>
            A manifesto for building trust-driven relationships
            in a world optimized for transactions.
          </p>
        </div>
      </section>

      {/* Section 2 — The current reality */}
      <section className={styles.sectionSecondary}>
        <div className={`${styles.sectionContent} ${styles.reveal}`}>
          <h2 className={styles.h2}>The current reality</h2>
          <p className={styles.bodyText}>
            Organizations invest heavily in engagement — customer experience,
            employee programs, stakeholder relationships. Yet satisfaction declines.
            Trust erodes. Interactions feel increasingly hollow.
          </p>
          <p className={styles.bodyText}>
            The platforms built to manage these relationships were designed for
            efficiency, not connection. For transactions, not trust.
          </p>
        </div>
      </section>

      {/* Section 3 — What's broken */}
      <section className={styles.sectionPrimary}>
        <div className={`${styles.sectionContent} ${styles.reveal}`}>
          <h2 className={styles.h2}>What's broken</h2>
          <p className={styles.bodyText}>
            The assumption underlying most engagement is flawed: that relationships
            can be managed like processes. That trust can be designed like interfaces.
            That connection can be optimized like conversion funnels.
          </p>
          <p className={styles.bodyText}>
            This has led us to treat engagement as a feature — something to be bolted
            on and measured in clicks. We've reduced human relationships to "journeys"
            that can be mapped and "touchpoints" that can be optimized.
          </p>
          <p className={styles.bodyText}>
            The result: experiences that feel engineered, communications that feel
            automated, relationships that feel hollow.
          </p>
          <p className={styles.bodyText}>
            The assumption is that more technology will fix this. It won't — unless
            the thinking behind it changes first.
          </p>
        </div>
      </section>

      {/* Section 4 — Engagement as a system */}
      <section className={styles.sectionSecondary}>
        <div className={`${styles.sectionContent} ${styles.reveal}`}>
          <h2 className={styles.h2}>Engagement as a system</h2>
          <p className={styles.bodyText}>
            There is another way. Instead of treating engagement as a feature,
            we can approach it as a system — a living, adaptive architecture that
            operates with intelligence and speed.
          </p>
          <p className={styles.bodyText}>
            Systems think differently. They don't optimize for individual interactions;
            they optimize for relationship health over time. They don't maximize
            short-term metrics; they build conditions for long-term trust.
          </p>
          <p className={styles.bodyText}>
            A good system enables movement, not delay. It creates leverage through
            well-timed micro-interactions — small, purposeful actions that compound
            into meaningful change.
          </p>
        </div>
      </section>

      {/* Section 5 — Trust through action */}
      <section className={styles.sectionPrimary}>
        <div className={`${styles.sectionContent} ${styles.reveal}`}>
          <h2 className={styles.h2}>Trust through action</h2>
          <p className={styles.bodyText}>
            Trust is not something that can be manufactured or demanded. It accumulates
            through consistent, intelligent interaction — knowing when to act,
            how to respond, what matters.
          </p>
          <p className={styles.bodyText}>
            This requires judgment: the ability to understand context, anticipate needs,
            and respond with genuine relevance. Speed matters. Precision matters.
            The right action at the right moment creates disproportionate impact.
          </p>
          <p className={styles.bodyTextBold}>
            We believe the future belongs to organizations that understand this —
            that invest in systems that enable fast, intelligent, trust-building
            engagement at scale.
          </p>
          <hr className={styles.divider} />
          <Link to="/lybi/enable" className={styles.textLink}>
            What we enable <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </section>
    </>
  );
}

/* ===== Page 3: What We Enable ===== */

function EnablePage() {
  return (
    <>
      {/* Section 1 — Hero */}
      <section className={styles.heroSection}>
        <div className={styles.heroContentNarrow}>
          <p className={styles.eyebrow}>WHAT WE ENABLE</p>
          <h1 className={styles.h1}>Intelligent Relationships</h1>
          <p className={styles.subtitle}>
            Lybi enables organizations to build and sustain high-stakes, ongoing
            relationships with their customers — at the speed and scale that
            modern organizations demand.
          </p>
        </div>
      </section>

      {/* Section 2 — Three pillars */}
      <section className={styles.sectionSecondary}>
        <div className={`${styles.sectionContentWide} ${styles.reveal}`}>
          <div className={styles.cardsGrid}>
            <div className={styles.pillarCard}>
              <h3 className={styles.h3}>Systemic engagement</h3>
              <ul className={styles.bulletList}>
                <li className={styles.bulletItem}>
                  <span className={styles.bulletDot} />
                  <span>Continuous, not campaign-based</span>
                </li>
                <li className={styles.bulletItem}>
                  <span className={styles.bulletDot} />
                  <span>Driven by empathy, not just rules</span>
                </li>
                <li className={styles.bulletItem}>
                  <span className={styles.bulletDot} />
                  <span>Responsive to context, not just triggers</span>
                </li>
                <li className={styles.bulletItem}>
                  <span className={styles.bulletDot} />
                  <span>Relational, not transactional</span>
                </li>
              </ul>
            </div>
            <div className={styles.pillarCard}>
              <h3 className={styles.h3}>Built for complexity</h3>
              <ul className={styles.bulletList}>
                <li className={styles.bulletItem}>
                  <span className={styles.bulletDot} />
                  <span>Scales from thousands to millions</span>
                </li>
                <li className={styles.bulletItem}>
                  <span className={styles.bulletDot} />
                  <span>Operates in regulated environments</span>
                </li>
                <li className={styles.bulletItem}>
                  <span className={styles.bulletDot} />
                  <span>Integrates with existing operations</span>
                </li>
                <li className={styles.bulletItem}>
                  <span className={styles.bulletDot} />
                  <span>Works across channels and stakeholders</span>
                </li>
              </ul>
            </div>
            <div className={styles.pillarCard}>
              <h3 className={styles.h3}>One system, many expressions</h3>
              <ul className={styles.bulletList}>
                <li className={styles.bulletItem}>
                  <span className={styles.bulletDot} />
                  <span>Customer engagement</span>
                </li>
                <li className={styles.bulletItem}>
                  <span className={styles.bulletDot} />
                  <span>Customer communication</span>
                </li>
                <li className={styles.bulletItem}>
                  <span className={styles.bulletDot} />
                  <span>Customer relationships</span>
                </li>
                <li className={styles.bulletItem}>
                  <span className={styles.bulletDot} />
                  <span>Customer-facing journeys</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3 — How we think */}
      <section className={styles.sectionPrimary}>
        <div className={`${styles.sectionContent} ${styles.reveal}`}>
          <h2 className={styles.h2}>How we think</h2>
          <p className={styles.bodyText}>
            We believe that meaningful change happens through leverage — small,
            well-placed actions that compound into significant impact. Systems don't
            have to be heavy to be powerful.
          </p>
          <p className={styles.bodyText}>
            The best engagement is responsive and intelligent: it reads context, makes
            good decisions in real time, and creates momentum. Depth comes from
            precision, not from slowness.
          </p>
          <p className={styles.bodyText}>
            We work with organizations that understand this — that see engagement as
            a source of strategic advantage, not as overhead. Organizations ready to
            move with intention and speed.
          </p>
        </div>
      </section>

      {/* Section 4 — Banner */}
      <section className={styles.bannerSection}>
        <p className={styles.ctaHeadline}>Products evolve. Systems endure.</p>
        <div style={{ marginTop: '32px' }}>
          <Link to="/lybi/about" className={styles.primaryButton}>
            Learn more about us <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </section>
    </>
  );
}

/* ===== Page 4: About ===== */

function AboutPage() {
  return (
    <>
      {/* Section 1 — Hero */}
      <section className={styles.heroSection}>
        <div className={styles.heroContentNarrow}>
          <p className={styles.eyebrow}>ABOUT LYBI</p>
          <h1 className={styles.h1}>Operating engagement at scale</h1>
          <p className={styles.subtitle}>
            We help organizations rebuild trust with their customers — through systems
            that understand context, hold memory, and act with judgment.
          </p>
        </div>
      </section>

      {/* Section 2 — Who we are */}
      <section className={styles.sectionSecondary}>
        <div className={`${styles.sectionContent} ${styles.reveal}`}>
          <h2 className={styles.h2}>Who we are</h2>
          <p className={styles.bodyText}>
            LYBI approaches engagement as a discipline — one that requires judgment,
            operating rigor, and a deep understanding of how trust accumulates over time.
          </p>
          <p className={styles.bodyText}>
            We work with organizations navigating complexity: large-scale operations,
            high-stakes decisions, and relationships that matter. Our focus is on
            enabling these organizations to engage meaningfully — at speed and at scale.
          </p>
          <p className={styles.bodyText}>
            Our team brings experience from leading complex organizations, operating
            under constraints, and making decisions with real consequences. We understand
            what it means to be accountable for long-term outcomes.
          </p>
        </div>
      </section>

      {/* Section 3 — How we think */}
      <section className={styles.sectionPrimary}>
        <div className={`${styles.sectionContent} ${styles.reveal}`}>
          <h2 className={styles.h2}>How we think</h2>
          <p className={styles.bodyText}>
            We believe that meaningful change happens through leverage — small,
            well-placed actions that compound into significant impact. Systems don't
            have to be heavy to be powerful.
          </p>
          <p className={styles.bodyText}>
            The best engagement is responsive and intelligent: it reads context, makes
            good decisions in real time, and creates momentum. Depth comes from
            precision, not from slowness.
          </p>
          <p className={styles.bodyText}>
            We work with organizations that see engagement as a source of strategic
            advantage — not as overhead. Organizations ready to move with intention
            and speed.
          </p>
        </div>
      </section>

      {/* Section 4 — Our Team */}
      <section className={styles.sectionSecondary}>
        <div className={`${styles.sectionContentWide} ${styles.reveal}`}>
          <h2 className={styles.h2centered}>Our Team</h2>
          <div className={styles.teamGrid}>
            {/* Team Member 1 */}
            <div className={styles.teamCard}>
              <hr className={styles.teamCardDivider} />
              <div className={styles.teamPhoto} />
              <hr className={styles.teamCardDivider} />
              <p className={styles.teamName}>Noa Assouline</p>
              <p className={styles.teamRole}>Founder</p>
              <p className={styles.teamBio}>Bio coming soon.</p>
              <a href="#" className={styles.teamLinkedin}>
                <svg className={styles.teamLinkedinIcon} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
            </div>

            {/* Team Member 2 */}
            <div className={styles.teamCard}>
              <hr className={styles.teamCardDivider} />
              <div className={styles.teamPhoto} />
              <hr className={styles.teamCardDivider} />
              <p className={styles.teamName}>Hila Carmel</p>
              <p className={styles.teamRole}>Founder</p>
              <p className={styles.teamBio}>Bio coming soon.</p>
              <a href="#" className={styles.teamLinkedin}>
                <svg className={styles.teamLinkedinIcon} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
            </div>

            {/* Team Member 3 */}
            <div className={styles.teamCard}>
              <hr className={styles.teamCardDivider} />
              <div className={styles.teamPhoto} />
              <hr className={styles.teamCardDivider} />
              <p className={styles.teamName}>Shlomi Zevin</p>
              <p className={styles.teamRole}>Chief Technology Officer</p>
              <p className={styles.teamBio}>Bio coming soon.</p>
              <a href="#" className={styles.teamLinkedin}>
                <svg className={styles.teamLinkedinIcon} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
            </div>
          </div>

          <Link to="/lybi/belief" className={styles.textLink}>
            Read our belief <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </section>
    </>
  );
}

/* ===== Main Layout Wrapper ===== */

export function LybiLandingPage() {
  const location = useLocation();
  const [version, setVersion] = useState<'v1' | 'v2' | 'v3'>('v1');
  const [pageKey, setPageKey] = useState(0);
  const [contactOpen, setContactOpen] = useState(false);
  const revealRef = useScrollReveal(version, pageKey);

  const openContact = () => setContactOpen(true);
  const closeContact = () => setContactOpen(false);

  useEffect(() => {
    document.title = 'Lybi — The Intelligent Relationship System';

    // Enable scrolling for landing page (override global overflow:hidden)
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

  // Scroll to top on route change + trigger page enter animation
  useEffect(() => {
    window.scrollTo(0, 0);
    setPageKey((k) => k + 1);
  }, [location.pathname]);

  const containerClass = [
    styles.container,
    version === 'v2' ? styles.v2 : '',
    version === 'v3' ? styles.v3 : '',
  ].filter(Boolean).join(' ');

  const pageContentClass = version === 'v3' ? styles.v3PageContent : undefined;

  return (
    <div className={containerClass} ref={revealRef}>
      <Nav onOpenContact={openContact} />
      <div key={pageKey} className={pageContentClass}>
        <Routes>
          <Route index element={<HomePage onOpenContact={openContact} />} />
          <Route path="belief" element={<BeliefPage />} />
          <Route path="enable" element={<EnablePage />} />
          <Route path="about" element={<AboutPage />} />
        </Routes>
      </div>
      <Footer />
      <ContactModal isOpen={contactOpen} onClose={closeContact} />

      {/* Version Toggle */}
      <div className={styles.versionToggle}>
        <button
          className={`${styles.toggleOption} ${version === 'v1' ? styles.toggleActive : ''}`}
          onClick={() => setVersion('v1')}
        >
          Classic
        </button>
        <button
          className={`${styles.toggleOption} ${version === 'v2' ? styles.toggleActive : ''}`}
          onClick={() => setVersion('v2')}
        >
          Dark
        </button>
        <button
          className={`${styles.toggleOption} ${version === 'v3' ? styles.toggleActive : ''}`}
          onClick={() => setVersion('v3')}
        >
          Techy
        </button>
      </div>
    </div>
  );
}
