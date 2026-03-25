import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './ArchitecturePage.module.css';

export function ArchitecturePage() {
  useEffect(() => {
    document.title = 'Aspect — Platform Architecture';
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
    <div className={styles.container}>
      {/* Nav */}
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <Link to="/" className={styles.navLogo}>
            <img src="/img/aspect-logo-regular.png" alt="Aspect" />
          </Link>
          <div className={styles.navLinks}>
            <a href="#overview">Overview</a>
            <a href="#frontend">Frontend</a>
            <a href="#backend">Backend</a>
            <a href="#llm">LLM Providers</a>
            <a href="#crew">Crew System</a>
            <a href="#streaming">Streaming</a>
            <a href="#infra">Infrastructure</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className={styles.hero}>
        <h1>
          Platform <span>Architecture</span>
        </h1>
        <p className={styles.heroSub}>
          A multi-agent AI chat platform built on a streaming-first architecture with
          multi-provider LLM orchestration, a crew-based agent system, and real-time SSE delivery.
        </p>
      </header>

      {/* ── HIGH-LEVEL OVERVIEW ── */}
      <section id="overview" className={styles.section}>
        <h2 className={styles.sectionTitle}>High-Level Overview</h2>
        <p className={styles.sectionSub}>End-to-end request flow from client to response</p>

        <div className={styles.diagram}>
          {/* Row 1 — Client */}
          <div className={styles.diagramRow}>
            <div className={styles.diagramBoxAccent}>
              <div className={styles.diagramBoxIcon}>🖥️</div>
              <div className={styles.diagramBoxTitle}>React Client</div>
              <div className={styles.diagramBoxDetail}>React 19 · TypeScript · Vite · CSS Modules</div>
            </div>
          </div>

          <div className={styles.diagramArrow}>
            <div className={styles.arrowLine} />
            <div className={styles.arrowLabel}>HTTPS / SSE Stream</div>
            <div className={styles.arrowLine} />
            <div className={styles.arrowHead} />
          </div>

          {/* Row 2 — Firebase + Server */}
          <div className={styles.diagramRow}>
            <div className={styles.diagramBoxAmber}>
              <div className={styles.diagramBoxIcon}>🔥</div>
              <div className={styles.diagramBoxTitle}>Firebase Hosting</div>
              <div className={styles.diagramBoxDetail}>SPA hosting · CDN · Cache headers</div>
            </div>
            <div className={styles.diagramHConnector}><div className={styles.hLine} /></div>
            <div className={styles.diagramBoxGreen}>
              <div className={styles.diagramBoxIcon}>⚡</div>
              <div className={styles.diagramBoxTitle}>Express Server</div>
              <div className={styles.diagramBoxDetail}>Node.js 22 · Express 5 · REST + SSE</div>
            </div>
          </div>

          <div className={styles.diagramArrow}>
            <div className={styles.arrowLine} />
            <div className={styles.arrowLabel}>Dispatcher Routes to Crew</div>
            <div className={styles.arrowLine} />
            <div className={styles.arrowHead} />
          </div>

          {/* Row 3 — Crew + Micro-Agents */}
          <div className={styles.diagramRow}>
            <div className={styles.diagramBoxPurple}>
              <div className={styles.diagramBoxIcon}>🤖</div>
              <div className={styles.diagramBoxTitle}>Crew System</div>
              <div className={styles.diagramBoxDetail}>Dispatcher · Crew Members · Transitions</div>
            </div>
            <div className={styles.diagramHConnector}><div className={styles.hLine} /></div>
            <div className={styles.diagramBox}>
              <div className={styles.diagramBoxIcon}>🧬</div>
              <div className={styles.diagramBoxTitle}>Micro-Agents</div>
              <div className={styles.diagramBoxDetail}>Profiler · Fields Extractor · Thinking Advisor</div>
            </div>
          </div>

          <div className={styles.diagramArrow}>
            <div className={styles.arrowLine} />
            <div className={styles.arrowLabel}>Provider-Agnostic LLM Call</div>
            <div className={styles.arrowLine} />
            <div className={styles.arrowHead} />
          </div>

          {/* Row 4 — LLM Providers */}
          <div className={styles.diagramRow}>
            <div className={styles.diagramBoxGreen}>
              <div className={styles.diagramBoxIcon}>🟢</div>
              <div className={styles.diagramBoxTitle}>OpenAI</div>
              <div className={styles.diagramBoxDetail}>GPT-4o · GPT-5 · Whisper</div>
            </div>
            <div className={styles.diagramBoxAmber}>
              <div className={styles.diagramBoxIcon}>🟡</div>
              <div className={styles.diagramBoxTitle}>Anthropic</div>
              <div className={styles.diagramBoxDetail}>Claude Sonnet 4</div>
            </div>
            <div className={styles.diagramBox}>
              <div className={styles.diagramBoxIcon}>🔵</div>
              <div className={styles.diagramBoxTitle}>Google</div>
              <div className={styles.diagramBoxDetail}>Gemini 2.0 Flash</div>
            </div>
          </div>

          <div className={styles.diagramArrow}>
            <div className={styles.arrowLine} />
            <div className={styles.arrowLabel}>Vector Store / File Search / Context</div>
            <div className={styles.arrowLine} />
            <div className={styles.arrowHead} />
          </div>

          {/* Row 5 — Data Layer */}
          <div className={styles.diagramRow}>
            <div className={styles.diagramBox}>
              <div className={styles.diagramBoxIcon}>🐘</div>
              <div className={styles.diagramBoxTitle}>PostgreSQL</div>
              <div className={styles.diagramBoxDetail}>Drizzle ORM · Cloud SQL · 20+ tables</div>
            </div>
            <div className={styles.diagramBoxAmber}>
              <div className={styles.diagramBoxIcon}>📚</div>
              <div className={styles.diagramBoxTitle}>Knowledge Base</div>
              <div className={styles.diagramBoxDetail}>OpenAI Vectors · Gemini Corpora · Anthropic Files</div>
            </div>
            <div className={styles.diagramBoxGreen}>
              <div className={styles.diagramBoxIcon}>☁️</div>
              <div className={styles.diagramBoxTitle}>Cloud Storage</div>
              <div className={styles.diagramBoxDetail}>GCS Buckets · File sync across providers</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FRONTEND ── */}
      <section id="frontend" className={styles.sectionAlt}>
        <div className={styles.sectionAltInner}>
          <h2 className={styles.sectionTitle}>Frontend Stack</h2>
          <p className={styles.sectionSub}>Modern React SPA with streaming-first architecture</p>

          <div className={styles.techGrid}>
            <div className={styles.techCard}>
              <div className={styles.techCardIcon}>⚛️</div>
              <div className={styles.techCardTitle}>React 19 + TypeScript</div>
              <div className={styles.techCardDesc}>
                Latest React with strict TypeScript for type-safe components, hooks, and context providers.
              </div>
              <div className={styles.techTags}>
                <span className={styles.tag}>React 19</span>
                <span className={styles.tag}>TypeScript 5.9</span>
                <span className={styles.tag}>React Router 6</span>
              </div>
            </div>

            <div className={styles.techCard}>
              <div className={styles.techCardIcon}>⚡</div>
              <div className={styles.techCardTitle}>Vite Build</div>
              <div className={styles.techCardDesc}>
                Lightning-fast dev server with HMR. Optimized production builds with code splitting and long-term caching.
              </div>
              <div className={styles.techTags}>
                <span className={styles.tag}>Vite 5</span>
                <span className={styles.tag}>ESBuild</span>
                <span className={styles.tag}>HMR</span>
              </div>
            </div>

            <div className={styles.techCard}>
              <div className={styles.techCardIcon}>🎨</div>
              <div className={styles.techCardTitle}>CSS Modules + Theming</div>
              <div className={styles.techCardDesc}>
                Scoped component styles with CSS Modules. Global design tokens via CSS variables. Per-agent theming.
              </div>
              <div className={styles.techTags}>
                <span className={styles.tag}>CSS Modules</span>
                <span className={styles.tag}>CSS Variables</span>
                <span className={styles.tag}>RTL Support</span>
              </div>
            </div>

            <div className={styles.techCard}>
              <div className={styles.techCardIcon}>📡</div>
              <div className={styles.techCardTitle}>SSE Streaming Client</div>
              <div className={styles.techCardDesc}>
                Custom async-iterator SSE client that parses text chunks, thinking steps, crew transitions, and tool calls in real-time.
              </div>
              <div className={styles.techTags}>
                <span className={styles.tagGreen}>Server-Sent Events</span>
                <span className={styles.tagGreen}>AsyncIterator</span>
                <span className={styles.tagGreen}>Fetch API</span>
              </div>
            </div>

            <div className={styles.techCard}>
              <div className={styles.techCardIcon}>📝</div>
              <div className={styles.techCardTitle}>Rich Content Rendering</div>
              <div className={styles.techCardDesc}>
                Markdown rendering with syntax highlighting, GFM tables, image cropping, and HTML-to-canvas export.
              </div>
              <div className={styles.techTags}>
                <span className={styles.tagPurple}>React Markdown</span>
                <span className={styles.tagPurple}>Prism</span>
                <span className={styles.tagPurple}>html2canvas</span>
              </div>
            </div>

            <div className={styles.techCard}>
              <div className={styles.techCardIcon}>🧩</div>
              <div className={styles.techCardTitle}>Component Architecture</div>
              <div className={styles.techCardDesc}>
                Context-driven state management. Custom hooks for chat, crew, KB, conversations, and real-time notifications.
              </div>
              <div className={styles.techTags}>
                <span className={styles.tag}>React Context</span>
                <span className={styles.tag}>Custom Hooks</span>
                <span className={styles.tag}>ESLint</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BACKEND ── */}
      <section id="backend" className={styles.section}>
        <h2 className={styles.sectionTitle}>Backend Stack</h2>
        <p className={styles.sectionSub}>Node.js API server with 39+ service modules</p>

        <div className={styles.techGrid}>
          <div className={styles.techCard}>
            <div className={styles.techCardIcon}>🟩</div>
            <div className={styles.techCardTitle}>Node.js + Express 5</div>
            <div className={styles.techCardDesc}>
              High-performance HTTP server with streaming response support, CORS, file uploads via Multer, and body parsing.
            </div>
            <div className={styles.techTags}>
              <span className={styles.tagGreen}>Node.js 22</span>
              <span className={styles.tagGreen}>Express 5</span>
              <span className={styles.tagGreen}>Multer</span>
              <span className={styles.tagGreen}>CORS</span>
            </div>
          </div>

          <div className={styles.techCard}>
            <div className={styles.techCardIcon}>🐘</div>
            <div className={styles.techCardTitle}>PostgreSQL + Drizzle ORM</div>
            <div className={styles.techCardDesc}>
              Relational database with type-safe Drizzle ORM. 20+ tables covering agents, conversations, messages, context, tasks, and more.
            </div>
            <div className={styles.techTags}>
              <span className={styles.tag}>PostgreSQL</span>
              <span className={styles.tag}>Drizzle ORM</span>
              <span className={styles.tag}>Cloud SQL</span>
              <span className={styles.tag}>Migrations</span>
            </div>
          </div>

          <div className={styles.techCard}>
            <div className={styles.techCardIcon}>🔧</div>
            <div className={styles.techCardTitle}>Service Layer</div>
            <div className={styles.techCardDesc}>
              39+ dedicated services: LLM routing, KB management, context persistence, notifications, feedback, billing, and data queries.
            </div>
            <div className={styles.techTags}>
              <span className={styles.tagAmber}>LLM Services</span>
              <span className={styles.tagAmber}>KB Services</span>
              <span className={styles.tagAmber}>Context Service</span>
              <span className={styles.tagAmber}>Task Service</span>
            </div>
          </div>

          <div className={styles.techCard}>
            <div className={styles.techCardIcon}>📊</div>
            <div className={styles.techCardTitle}>Dynamic SQL Engine</div>
            <div className={styles.techCardDesc}>
              AI-generated SQL queries from natural language. Schema introspection, query optimization, and slow-query monitoring.
            </div>
            <div className={styles.techTags}>
              <span className={styles.tagPurple}>SQL Generator</span>
              <span className={styles.tagPurple}>Schema Descriptor</span>
              <span className={styles.tagPurple}>Query Optimizer</span>
            </div>
          </div>

          <div className={styles.techCard}>
            <div className={styles.techCardIcon}>🎙️</div>
            <div className={styles.techCardTitle}>Audio Processing</div>
            <div className={styles.techCardDesc}>
              Audio transcription via OpenAI Whisper and Gemini File API. FFmpeg compression pipeline for files up to 500MB.
            </div>
            <div className={styles.techTags}>
              <span className={styles.tagRed}>Whisper</span>
              <span className={styles.tagRed}>FFmpeg</span>
              <span className={styles.tagRed}>Gemini File API</span>
            </div>
          </div>

          <div className={styles.techCard}>
            <div className={styles.techCardIcon}>📱</div>
            <div className={styles.techCardTitle}>Integrations</div>
            <div className={styles.techCardDesc}>
              WhatsApp Business API for conversational messaging. Email delivery via Nodemailer. Data import from CSV, Excel, XML, QVD.
            </div>
            <div className={styles.techTags}>
              <span className={styles.tagGreen}>WhatsApp API</span>
              <span className={styles.tagGreen}>Nodemailer</span>
              <span className={styles.tagGreen}>CSV/XLSX/XML</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── LLM PROVIDERS ── */}
      <section id="llm" className={styles.sectionAlt}>
        <div className={styles.sectionAltInner}>
          <h2 className={styles.sectionTitle}>Multi-Provider LLM Layer</h2>
          <p className={styles.sectionSub}>Seamless switching between providers per agent, per crew member</p>

          <div className={styles.providerGrid}>
            <div className={`${styles.providerCard} ${styles.providerOpenAI}`}>
              <div className={styles.providerIcon}>🟢</div>
              <div className={styles.providerName}>OpenAI</div>
              <div className={styles.providerModels}>GPT-4o · GPT-5 · Whisper</div>
              <ul className={styles.providerFeatures}>
                <li><span className={styles.checkIcon}>✓</span> Responses API with stored prompts</li>
                <li><span className={styles.checkIcon}>✓</span> Vector Store file search (KB)</li>
                <li><span className={styles.checkIcon}>✓</span> Function/tool calling</li>
                <li><span className={styles.checkIcon}>✓</span> Audio transcription (Whisper)</li>
                <li><span className={styles.checkIcon}>✓</span> Streaming with thinking steps</li>
              </ul>
            </div>

            <div className={`${styles.providerCard} ${styles.providerAnthropic}`}>
              <div className={styles.providerIcon}>🟡</div>
              <div className={styles.providerName}>Anthropic</div>
              <div className={styles.providerModels}>Claude Sonnet 4</div>
              <ul className={styles.providerFeatures}>
                <li><span className={styles.checkIcon}>✓</span> One-shot completions</li>
                <li><span className={styles.checkIcon}>✓</span> Anthropic Files API (KB)</li>
                <li><span className={styles.checkIcon}>✓</span> Function/tool calling</li>
                <li><span className={styles.checkIcon}>✓</span> Crew generation</li>
                <li><span className={styles.checkIcon}>✓</span> Extended thinking</li>
              </ul>
            </div>

            <div className={`${styles.providerCard} ${styles.providerGoogle}`}>
              <div className={styles.providerIcon}>🔵</div>
              <div className={styles.providerName}>Google Gemini</div>
              <div className={styles.providerModels}>Gemini 2.0 Flash</div>
              <ul className={styles.providerFeatures}>
                <li><span className={styles.checkIcon}>✓</span> Google GenAI SDK</li>
                <li><span className={styles.checkIcon}>✓</span> File search corpora (KB)</li>
                <li><span className={styles.checkIcon}>✓</span> Function/tool calling</li>
                <li><span className={styles.checkIcon}>✓</span> Audio file streaming (2GB)</li>
                <li><span className={styles.checkIcon}>✓</span> System instructions</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── CREW SYSTEM ── */}
      <section id="crew" className={styles.section}>
        <h2 className={styles.sectionTitle}>Crew System — Multi-Agent Orchestration</h2>
        <p className={styles.sectionSub}>Each agent is composed of specialized crew members with their own prompt, model, tools, and knowledge base</p>

        <div className={styles.crewFlow}>
          <div className={styles.crewStep}>
            <div className={styles.crewStepIcon}>💬</div>
            <div className={styles.crewStepTitle}>User Message</div>
            <div className={styles.crewStepDetail}>Incoming text or audio</div>
          </div>
          <div className={styles.crewArrow}>→</div>
          <div className={styles.crewStep}>
            <div className={styles.crewStepIcon}>🚦</div>
            <div className={styles.crewStepTitle}>Dispatcher</div>
            <div className={styles.crewStepDetail}>Routes to active crew member</div>
          </div>
          <div className={styles.crewArrow}>→</div>
          <div className={styles.crewStep}>
            <div className={styles.crewStepIcon}>🤖</div>
            <div className={styles.crewStepTitle}>Crew Member</div>
            <div className={styles.crewStepDetail}>Prompt + Model + Tools + KB</div>
          </div>
          <div className={styles.crewArrow}>→</div>
          <div className={styles.crewStep}>
            <div className={styles.crewStepIcon}>🧠</div>
            <div className={styles.crewStepTitle}>LLM Provider</div>
            <div className={styles.crewStepDetail}>OpenAI / Claude / Gemini</div>
          </div>
          <div className={styles.crewArrow}>→</div>
          <div className={styles.crewStep}>
            <div className={styles.crewStepIcon}>📡</div>
            <div className={styles.crewStepTitle}>SSE Stream</div>
            <div className={styles.crewStepDetail}>Real-time response delivery</div>
          </div>
        </div>

        <div style={{ marginTop: '3rem' }}>
          <div className={styles.techGrid}>
            <div className={styles.techCard}>
              <div className={styles.techCardIcon}>🔀</div>
              <div className={styles.techCardTitle}>Transition Strategies</div>
              <div className={styles.techCardDesc}>
                Field-based transitions collect data then hand off. Tool-based transitions react to tool call outcomes. Both run automatically.
              </div>
              <div className={styles.techTags}>
                <span className={styles.tagPurple}>preMessageTransfer</span>
                <span className={styles.tagPurple}>postMessageTransfer</span>
                <span className={styles.tagPurple}>Field Extraction</span>
              </div>
            </div>

            <div className={styles.techCard}>
              <div className={styles.techCardIcon}>🧬</div>
              <div className={styles.techCardTitle}>Micro-Agents</div>
              <div className={styles.techCardDesc}>
                Async background processors that run independently: Profiler enriches user data, Fields Extractor parses structured info, Thinking Advisor adds reasoning.
              </div>
              <div className={styles.techTags}>
                <span className={styles.tagAmber}>ProfilerAgent</span>
                <span className={styles.tagAmber}>FieldsExtractorAgent</span>
                <span className={styles.tagAmber}>ThinkingAdvisorAgent</span>
              </div>
            </div>

            <div className={styles.techCard}>
              <div className={styles.techCardIcon}>💾</div>
              <div className={styles.techCardTitle}>Context Persistence</div>
              <div className={styles.techCardDesc}>
                User-level context persists across conversations. Conversation-level context is scoped to a single session. Crews read and write shared state.
              </div>
              <div className={styles.techTags}>
                <span className={styles.tagGreen}>getContext()</span>
                <span className={styles.tagGreen}>writeContext()</span>
                <span className={styles.tagGreen}>User / Conversation scope</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SSE STREAMING ── */}
      <section id="streaming" className={styles.sectionAlt}>
        <div className={styles.sectionAltInner}>
          <h2 className={styles.sectionTitle}>Real-Time SSE Streaming</h2>
          <p className={styles.sectionSub}>Every response streams as a sequence of typed events</p>

          <div className={styles.streamTimeline}>
            <div className={styles.streamEvent}>
              <div className={styles.streamDot}>
                <div className={styles.streamDotCircle} />
                <div className={styles.streamDotLine} />
              </div>
              <div className={styles.streamContent}>
                <div className={styles.streamLabel}>Text Chunks</div>
                <div className={styles.streamDesc}>Streamed token-by-token as they arrive from the LLM</div>
              </div>
            </div>

            <div className={styles.streamEvent}>
              <div className={styles.streamDot}>
                <div className={styles.streamDotCirclePurple} />
                <div className={styles.streamDotLine} />
              </div>
              <div className={styles.streamContent}>
                <div className={styles.streamLabel}>Thinking Steps</div>
                <div className={styles.streamDesc}>Internal reasoning and KB file references shown in real-time</div>
              </div>
            </div>

            <div className={styles.streamEvent}>
              <div className={styles.streamDot}>
                <div className={styles.streamDotCircleAmber} />
                <div className={styles.streamDotLine} />
              </div>
              <div className={styles.streamContent}>
                <div className={styles.streamLabel}>Crew Transitions</div>
                <div className={styles.streamDesc}>Crew member handoff events with transition metadata</div>
              </div>
            </div>

            <div className={styles.streamEvent}>
              <div className={styles.streamDot}>
                <div className={styles.streamDotCircleGreen} />
                <div className={styles.streamDotLine} />
              </div>
              <div className={styles.streamContent}>
                <div className={styles.streamLabel}>Function Calls</div>
                <div className={styles.streamDesc}>Tool invocations and results streamed as structured events</div>
              </div>
            </div>

            <div className={styles.streamEvent}>
              <div className={styles.streamDot}>
                <div className={styles.streamDotCircle} />
                <div className={styles.streamDotLine} />
              </div>
              <div className={styles.streamContent}>
                <div className={styles.streamLabel}>Field Extractions</div>
                <div className={styles.streamDesc}>Parallel field parsing results streamed alongside the response</div>
              </div>
            </div>

            <div className={styles.streamEvent}>
              <div className={styles.streamDot}>
                <div className={styles.streamDotCirclePurple} />
              </div>
              <div className={styles.streamContent}>
                <div className={styles.streamLabel}>Model Metadata</div>
                <div className={styles.streamDesc}>Token usage, model ID, and completion status</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── INFRASTRUCTURE ── */}
      <section id="infra" className={styles.section}>
        <h2 className={styles.sectionTitle}>Cloud Infrastructure</h2>
        <p className={styles.sectionSub}>Google Cloud Platform with Firebase and managed services</p>

        <div className={styles.techGrid}>
          <div className={styles.techCard}>
            <div className={styles.techCardIcon}>🔥</div>
            <div className={styles.techCardTitle}>Firebase Hosting</div>
            <div className={styles.techCardDesc}>
              SPA hosting with CDN distribution. Single-page rewrites, versioned asset caching, and multi-project deployments.
            </div>
            <div className={styles.techTags}>
              <span className={styles.tagAmber}>Firebase</span>
              <span className={styles.tagAmber}>CDN</span>
              <span className={styles.tagAmber}>SPA Rewrites</span>
            </div>
          </div>

          <div className={styles.techCard}>
            <div className={styles.techCardIcon}>🐳</div>
            <div className={styles.techCardTitle}>Google Cloud Run</div>
            <div className={styles.techCardDesc}>
              Containerized Node.js server with Docker. Auto-scaling, health checks, and Cloud SQL Proxy for database connectivity.
            </div>
            <div className={styles.techTags}>
              <span className={styles.tag}>Docker</span>
              <span className={styles.tag}>Cloud Run</span>
              <span className={styles.tag}>Auto-scaling</span>
            </div>
          </div>

          <div className={styles.techCard}>
            <div className={styles.techCardIcon}>🗄️</div>
            <div className={styles.techCardTitle}>Google Cloud SQL</div>
            <div className={styles.techCardDesc}>
              Managed PostgreSQL with Unix socket connectivity from Cloud Run. Connection pooling and automated backups.
            </div>
            <div className={styles.techTags}>
              <span className={styles.tagGreen}>Cloud SQL</span>
              <span className={styles.tagGreen}>PostgreSQL</span>
              <span className={styles.tagGreen}>Unix Sockets</span>
            </div>
          </div>

          <div className={styles.techCard}>
            <div className={styles.techCardIcon}>☁️</div>
            <div className={styles.techCardTitle}>Google Cloud Storage</div>
            <div className={styles.techCardDesc}>
              GCS buckets for knowledge base file storage. Cross-provider sync ensures files are available in all LLM vector stores.
            </div>
            <div className={styles.techTags}>
              <span className={styles.tagPurple}>GCS</span>
              <span className={styles.tagPurple}>KB File Sync</span>
              <span className={styles.tagPurple}>Multi-Provider</span>
            </div>
          </div>

          <div className={styles.techCard}>
            <div className={styles.techCardIcon}>📚</div>
            <div className={styles.techCardTitle}>Knowledge Base Layer</div>
            <div className={styles.techCardDesc}>
              Abstracted KB management across OpenAI Vector Stores, Google Corpora, and Anthropic Files API. Upload once, search everywhere.
            </div>
            <div className={styles.techTags}>
              <span className={styles.tagRed}>Vector Stores</span>
              <span className={styles.tagRed}>File Search</span>
              <span className={styles.tagRed}>PDF/CSV/XLSX/XML</span>
            </div>
          </div>

          <div className={styles.techCard}>
            <div className={styles.techCardIcon}>🔒</div>
            <div className={styles.techCardTitle}>Security &amp; Config</div>
            <div className={styles.techCardDesc}>
              Environment-aware CORS, API key management via env vars, service account authentication, and upload size limits.
            </div>
            <div className={styles.techTags}>
              <span className={styles.tag}>CORS</span>
              <span className={styles.tag}>Env Vars</span>
              <span className={styles.tag}>Service Accounts</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p className={styles.footerText}>
          Aspect Platform Architecture &middot; Built with React, Node.js, PostgreSQL, and multi-provider AI
        </p>
      </footer>
    </div>
  );
}
