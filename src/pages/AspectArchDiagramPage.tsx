import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './AspectArchDiagramPage.module.css';

export function AspectArchDiagramPage() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    document.title = 'Aspect — System Architecture';
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
          <div className={styles.navLinks}>
            <a href="#flow">Request Flow</a>
            <a href="#billing">Accounts &amp; Billing</a>
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
        <h1>System <span>Architecture</span></h1>
        <p className={styles.heroSub}>
          How a business question becomes an actionable answer —
          from user query to data retrieval to natural-language response.
        </p>
      </header>

      {/* ─── REQUEST FLOW ─── */}
      <section id="flow" className={styles.flowSection}>
        <h2 className={styles.flowTitle}>Request Flow</h2>
        <p className={styles.flowSub}>End-to-end path of a single user query</p>

        <div className={styles.flow}>

          {/* Step 1 — User asks a question */}
          <div className={styles.stepRow}>
            <div className={styles.stepBoxBlue}>
              <div className={styles.stepHeader}>
                <div className={styles.stepNum}>1</div>
                <div className={styles.stepTitle}>User Asks a Question</div>
              </div>
              <p className={styles.stepDesc}>
                A business user types a question in natural language — Hebrew or English.
                For example: "What were the top 3 branches by revenue last quarter?"
              </p>
            </div>
          </div>

          <div className={styles.arrow}>
            <div className={styles.arrowLine} />
            <div className={styles.arrowLabel}>HTTPS</div>
            <div className={styles.arrowHead} />
          </div>

          {/* Step 2 — Server receives */}
          <div className={styles.stepRow}>
            <div className={styles.stepBoxGreen}>
              <div className={styles.stepHeader}>
                <div className={styles.stepNumGreen}>2</div>
                <div className={styles.stepTitle}>Aspect Server</div>
              </div>
              <p className={styles.stepDesc}>
                The request arrives at the Aspect application server.
                The server loads the customer's data schema and prepares the query context.
              </p>
            </div>
            <div className={styles.sideAnnotation}>
              <div className={styles.sideLabel}>Hosted on</div>
              <div className={styles.sideValueGreen}>Google Cloud Run</div>
            </div>
          </div>

          <div className={styles.arrow}>
            <div className={styles.arrowLine} />
            <div className={styles.arrowLabel}>Schema + question</div>
            <div className={styles.arrowHead} />
          </div>

          {/* Step 3 — Anthropic translates to SQL */}
          <div className={styles.stepRow}>
            <div className={styles.stepBoxAmber}>
              <div className={styles.stepHeader}>
                <div className={styles.stepNumAmber}>3</div>
                <div className={styles.stepTitle}>AI Translates to Data Query</div>
              </div>
              <p className={styles.stepDesc}>
                The business question — along with the customer's data schema —
                is sent to an AI model that translates the natural-language question
                into a precise data query (SQL).
              </p>
            </div>
            <div className={styles.sideAnnotation}>
              <div className={styles.sideLabel}>Provider</div>
              <div className={styles.sideValueAmber}>Anthropic Claude</div>
            </div>
          </div>

          <div className={styles.arrow}>
            <div className={styles.arrowLine} />
            <div className={styles.arrowLabel}>Generated SQL</div>
            <div className={styles.arrowHead} />
          </div>

          {/* Step 4 — Query customer data */}
          <div className={styles.stepRow}>
            <div className={styles.stepBoxGreen}>
              <div className={styles.stepHeader}>
                <div className={styles.stepNumGreen}>4</div>
                <div className={styles.stepTitle}>Fetch Business Data</div>
              </div>
              <p className={styles.stepDesc}>
                The generated query runs against the customer's data —
                aggregated business metrics stored in the platform's database.
                Results are numerical: totals, averages, comparisons.
              </p>
            </div>
            <div className={styles.sideAnnotation}>
              <div className={styles.sideLabel}>Stored on</div>
              <div className={styles.sideValueGreen}>Google Cloud SQL</div>
            </div>
          </div>

          <div className={styles.arrow}>
            <div className={styles.arrowLine} />
            <div className={styles.arrowLabel}>Query results + slow query indexing</div>
            <div className={styles.arrowHead} />
          </div>

          {/* Step 5 — Performance optimization */}
          <div className={styles.stepRow}>
            <div className={styles.stepBox}>
              <div className={styles.stepHeader}>
                <div className={styles.stepNum}>5</div>
                <div className={styles.stepTitle}>Query Optimization</div>
              </div>
              <p className={styles.stepDesc}>
                Slow queries are detected and indexed automatically.
                The system learns from query patterns and optimizes data access
                for frequently asked question types.
              </p>
            </div>
          </div>

          <div className={styles.arrow}>
            <div className={styles.arrowLine} />
            <div className={styles.arrowLabel}>Data + conversation history + instructions</div>
            <div className={styles.arrowHead} />
          </div>

          {/* Step 6 — OpenAI phrases the answer */}
          <div className={styles.stepRow}>
            <div className={styles.stepBoxPurple}>
              <div className={styles.stepHeader}>
                <div className={styles.stepNumPurple}>6</div>
                <div className={styles.stepTitle}>AI Composes the Answer</div>
              </div>
              <p className={styles.stepDesc}>
                The raw data, conversation history, and response instructions are sent
                to an AI model that composes a clear, human-readable answer with
                insights and recommendations — streamed in real-time.
              </p>
            </div>
            <div className={styles.sideAnnotation}>
              <div className={styles.sideLabel}>Provider</div>
              <div className={styles.sideValue}>OpenAI GPT</div>
            </div>
          </div>

          <div className={styles.arrow}>
            <div className={styles.arrowLine} />
            <div className={styles.arrowLabel}>Streamed response (SSE)</div>
            <div className={styles.arrowHead} />
          </div>

          {/* Step 7 — Answer delivered */}
          <div className={styles.stepRow}>
            <div className={styles.stepBoxBlue}>
              <div className={styles.stepHeader}>
                <div className={styles.stepNum}>7</div>
                <div className={styles.stepTitle}>Answer Delivered</div>
              </div>
              <p className={styles.stepDesc}>
                The user sees the answer appear in real-time — with data tables,
                trend analysis, and actionable recommendations.
                The full conversation is saved for context continuity.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ─── DATA SOURCES ─── */}
      <section className={styles.flowSection} style={{ paddingTop: 0 }}>
        <h2 className={styles.flowTitle}>Data Sources</h2>
        <p className={styles.flowSub}>How customer data enters the platform</p>

        <div className={styles.flow}>
          <div className={styles.stepRow}>
            <div className={styles.stepBox}>
              <div className={styles.stepHeader}>
                <div className={styles.stepNumGreen}>A</div>
                <div className={styles.stepTitle}>File Upload</div>
              </div>
              <p className={styles.stepDesc}>
                Customers upload business data files — CSV, Excel, XML, QVD —
                which are stored on cloud storage, parsed, normalized, and loaded
                into the customer's dedicated schema.
              </p>
            </div>
            <div className={styles.sideAnnotation}>
              <div className={styles.sideLabel}>Stored on</div>
              <div className={styles.sideValueGreen}>Google Cloud Storage</div>
            </div>
          </div>

          <div className={styles.arrow}>
            <div className={styles.arrowLine} />
            <div className={styles.arrowLabel}>Parse &amp; normalize</div>
            <div className={styles.arrowHead} />
          </div>

          <div className={styles.stepRow}>
            <div className={styles.stepBox}>
              <div className={styles.stepHeader}>
                <div className={styles.stepNumGreen}>B</div>
                <div className={styles.stepTitle}>Auto Schema Indexing</div>
              </div>
              <p className={styles.stepDesc}>
                The platform automatically discovers and indexes the customer's data
                schema — tables, columns, relationships — so the AI can generate
                accurate queries without manual configuration.
              </p>
            </div>
            <div className={styles.sideAnnotation}>
              <div className={styles.sideLabel}>Stored on</div>
              <div className={styles.sideValueGreen}>Google Cloud SQL</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── ACCOUNTS & BILLING ─── */}
      <section id="billing" className={styles.billingSection}>
        <h2 className={styles.flowTitle}>Accounts &amp; Billing</h2>
        <p className={styles.flowSub}>All services billed under a single company account</p>

        <div className={styles.billingGrid}>
          {/* GCP */}
          <div className={styles.billingCard}>
            <div className={styles.billingIcon}>☁️</div>
            <div className={styles.billingProvider}>Google Cloud Platform</div>
            <div className={styles.billingAccount}>info@aspect-tech.com</div>
            <ul className={styles.billingItems}>
              <li><span className={styles.billingDotGreen} /> Cloud Run — application server hosting</li>
              <li><span className={styles.billingDotGreen} /> Cloud SQL — PostgreSQL database</li>
              <li><span className={styles.billingDotGreen} /> Cloud Storage — file storage (CSV, Excel)</li>
              <li><span className={styles.billingDotGreen} /> Firebase Hosting — web client CDN</li>
            </ul>
          </div>

          {/* OpenAI */}
          <div className={styles.billingCard}>
            <div className={styles.billingIcon}>🟢</div>
            <div className={styles.billingProvider}>OpenAI</div>
            <div className={styles.billingAccount}>info@aspect-tech.com</div>
            <ul className={styles.billingItems}>
              <li><span className={styles.billingDot} /> API token usage — response generation</li>
              <li><span className={styles.billingDot} /> Chat message composition</li>
              <li><span className={styles.billingDot} /> Billed per token (input + output)</li>
            </ul>
          </div>

          {/* Anthropic */}
          <div className={styles.billingCard}>
            <div className={styles.billingIcon}>🟡</div>
            <div className={styles.billingProvider}>Anthropic</div>
            <div className={styles.billingAccount}>info@aspect-tech.com</div>
            <ul className={styles.billingItems}>
              <li><span className={styles.billingDotAmber} /> API token usage — SQL translation</li>
              <li><span className={styles.billingDotAmber} /> Natural language to data query</li>
              <li><span className={styles.billingDotAmber} /> Billed per token (input + output)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p className={styles.footerText}>
          Aspect Platform — System Architecture Overview
        </p>
      </footer>
    </div>
  );
}
