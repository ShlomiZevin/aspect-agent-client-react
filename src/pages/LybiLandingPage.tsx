import { useEffect, useState } from 'react';
import styles from './LybiLandingPage.module.css';

export function LybiLandingPage() {
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    document.title = 'LYBI - Engagement as a System';

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
      // Reset on unmount
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
    <div className={styles.container}>
      {/* Navigation */}
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <div className={styles.navLogo}>
            <img src="/img/lybi-logo-transparent.png" alt="LYBI" />
          </div>
          <div className={styles.navLinks}>
            <a href="#beliefs">What We Believe</a>
            <a href="#system">The System</a>
            <a href="#demo">See It Live</a>
            <button onClick={() => setChatOpen(true)} className={styles.navCta}>
              Try Freeda
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Engagement
            <br />
            <span className={styles.highlight}>as a System</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Building trust-driven digital relationships at scale.
          </p>
          <div className={styles.heroCta}>
            <a href="#system" className={styles.primaryButton}>
              Learn More
            </a>
            <button onClick={() => setChatOpen(true)} className={styles.secondaryButton}>
              See It in Action
            </button>
          </div>
        </div>
      </header>

      {/* Problem Statement */}
      <section className={styles.problemSection}>
        <div className={styles.problemContent}>
          <h2>Engagement at scale</h2>
          <p className={styles.leadText}>
            Digital platforms were built to manage processes, not relationships.
            They excel at transactions, workflows, and data — but struggle to create genuine connection.
          </p>
          <p>
            At scale, engagement breaks. What works for hundreds fails for millions.
            Personalization becomes noise. Communication becomes friction.
          </p>
          <p className={styles.emphasis}>
            Engagement requires a <strong>system</strong> — not an interface, not a journey, not a feature.
          </p>
        </div>
      </section>

      {/* Beliefs Section */}
      <section id="beliefs" className={styles.beliefsSection}>
        <h2>What we believe</h2>
        <div className={styles.beliefsGrid}>
          <div className={styles.beliefCard}>
            <h3>Engagement is not a feature</h3>
            <p>
              It cannot be bolted on, optimized through A/B tests, or measured in clicks.
              True engagement emerges from systemic design.
            </p>
          </div>
          <div className={styles.beliefCard}>
            <h3>Trust compounds through action</h3>
            <p>
              Small, well-timed interactions accumulate into lasting relationships.
              Speed and precision matter more than scale alone.
            </p>
          </div>
          <div className={styles.beliefCard}>
            <h3>Judgment over automation</h3>
            <p>
              The value is in knowing when to act, how to respond, and what matters.
              Good systems enable good decisions — fast.
            </p>
          </div>
        </div>
        <p className={styles.beliefSummary}>
          LYBI enables organizations to operate engagement as a living system —
          adaptive, intelligent, and built for the complexity of real relationships.
        </p>
      </section>

      {/* System Section */}
      <section id="system" className={styles.systemSection}>
        <div className={styles.systemContent}>
          <h2>Engagement as a system</h2>
          <p className={styles.leadText}>
            There is another way. Instead of treating engagement as a feature,
            we approach it as a system — a living, adaptive architecture that operates
            with intelligence and speed.
          </p>

          <div className={styles.systemGrid}>
            <div className={styles.systemCard}>
              <h3>Systems think differently</h3>
              <p>
                They don't optimize for individual interactions; they optimize for
                relationship health over time. They don't maximize short-term metrics;
                they build conditions for long-term trust.
              </p>
            </div>
            <div className={styles.systemCard}>
              <h3>Movement, not delay</h3>
              <p>
                A good system enables movement. It creates leverage through well-timed
                micro-interactions — small, purposeful actions that compound into
                meaningful change.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className={styles.trustSection}>
        <div className={styles.trustContent}>
          <h2>Trust through action</h2>
          <p>
            Trust is not something that can be manufactured or demanded.
            It accumulates through consistent, intelligent interaction —
            knowing when to act, how to respond, what matters.
          </p>
          <p>
            This requires <strong>judgment</strong>: the ability to understand context,
            anticipate needs, and respond with genuine relevance.
          </p>
          <p className={styles.emphasis}>
            Speed matters. Precision matters.
            The right action at the right moment creates disproportionate impact.
          </p>
          <p>
            We believe the future belongs to organizations that understand this —
            that invest in systems that enable fast, intelligent, trust-building
            engagement at scale.
          </p>
        </div>
      </section>

      {/* What We Enable Section */}
      <section className={styles.enableSection}>
        <h2>What We Enable</h2>
        <p className={styles.enableSubtitle}>
          We enable organizations to operate engagement as a system —
          responsive, intelligent, and built for speed at scale.
        </p>

        <div className={styles.enableGrid}>
          <div className={styles.enableCard}>
            <h3>Systemic engagement</h3>
            <ul>
              <li>Responsive to context in real time</li>
              <li>Continuous, not campaign-based</li>
              <li>Driven by empathy, not just rules</li>
              <li>Relational, not transactional</li>
            </ul>
          </div>
          <div className={styles.enableCard}>
            <h3>Built for complexity</h3>
            <ul>
              <li>Scales from thousands to millions</li>
              <li>Operates in regulated environments</li>
              <li>Integrates with existing operations</li>
              <li>Works across channels and stakeholders</li>
            </ul>
          </div>
          <div className={styles.enableCard}>
            <h3>One system, many expressions</h3>
            <ul>
              <li>Customer engagement</li>
              <li>Customer communication</li>
              <li>Customer relationships</li>
              <li>Customer-facing journeys</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Demo Section - Freeda */}
      <section id="demo" className={styles.demoSection}>
        <div className={styles.demoContent}>
          <h2>See It Live: Freeda</h2>
          <p className={styles.demoSubtitle}>
            Freeda is our first implementation of engagement as a system —
            a wellness companion that builds trust through intelligent,
            empathetic interaction.
          </p>

          <div className={styles.demoPreview}>
            <div className={styles.demoChat}>
              <div className={styles.demoChatHeader}>
                <span className={styles.demoChatIcon}>🌸</span>
                <span>Freeda</span>
              </div>
              <div className={styles.demoChatMessages}>
                <div className={styles.chatBubbleBot}>
                  <p>Hi! I'm Freeda, your wellness companion. I'm here to help you navigate your health journey with understanding and support.</p>
                </div>
                <div className={styles.chatBubbleUser}>
                  <p>I've been feeling really tired lately, especially in the mornings.</p>
                </div>
                <div className={styles.chatBubbleBot}>
                  <p>I hear you. Morning fatigue can be really frustrating. Let me ask a few questions to understand better what might be going on.</p>
                  <p className={styles.insightText}>Has this tiredness been consistent, or does it come and go? And how's your sleep been lately?</p>
                </div>
                <div className={styles.chatBubbleUser}>
                  <p>It comes and goes. Some days are better than others. Sleep has been okay, I think.</p>
                </div>
                <div className={styles.chatBubbleBot}>
                  <div className={styles.insight}>
                    <span className={styles.insightIcon}>💡</span>
                    <p>Intermittent fatigue can have several causes. Based on what you're describing, I'd like to explore a few areas with you — your energy patterns, any recent changes in your routine, and how you're feeling overall.</p>
                  </div>
                  <p>Would you be open to tracking your energy levels for a few days? It would help us spot patterns together.</p>
                </div>
              </div>
            </div>
            <div className={styles.demoDescription}>
              <h3>What makes Freeda different?</h3>
              <ul>
                <li><strong>Context-aware:</strong> Remembers your history and adapts</li>
                <li><strong>Empathy-driven:</strong> Responds with understanding, not scripts</li>
                <li><strong>Action-oriented:</strong> Guides toward meaningful next steps</li>
                <li><strong>Trust-building:</strong> Every interaction strengthens the relationship</li>
              </ul>
              <button onClick={() => setChatOpen(true)} className={styles.primaryButton}>
                Try Freeda Now
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.ctaSection}>
        <h2>Products evolve. Systems endure.</h2>
        <p>
          We work with organizations that see engagement as a source of strategic advantage —
          not as a cost center or a compliance requirement.
        </p>
        <div className={styles.ctaButtons}>
          <button onClick={() => setChatOpen(true)} className={styles.primaryButton}>
            Experience Freeda
          </button>
          <a href="mailto:hello@lybi.io" className={styles.secondaryButton}>
            Get in Touch
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerLogo}>
            <img src="/img/lybi-logo-transparent.png" alt="LYBI" />
          </div>
          <p className={styles.footerTagline}>
            Engagement as a System
          </p>
          <div className={styles.footerLinks}>
            <a href="mailto:hello@lybi.io">Contact</a>
          </div>
          <p className={styles.footerCopyright}>
            © {new Date().getFullYear()} LYBI. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Floating Chat Button */}
      {!chatOpen && (
        <button
          className={styles.floatingChatButton}
          onClick={() => setChatOpen(true)}
          aria-label="Open chat"
        >
          <span className={styles.floatingChatIcon}>🌸</span>
          <span className={styles.floatingChatText}>Try Freeda</span>
        </button>
      )}

      {/* Chat Widget Overlay */}
      {chatOpen && (
        <div className={styles.chatOverlay}>
          <div className={styles.chatWidget}>
            <div className={styles.chatWidgetHeader}>
              <div className={styles.chatWidgetTitle}>
                <span className={styles.chatWidgetIcon}>🌸</span>
                <span>Freeda</span>
              </div>
              <button
                className={styles.chatCloseButton}
                onClick={() => setChatOpen(false)}
                aria-label="Close chat"
              >
                ✕
              </button>
            </div>
            <iframe
              src="/freeda?embed=true"
              className={styles.chatIframe}
              title="Freeda Chat"
            />
          </div>
        </div>
      )}
    </div>
  );
}
