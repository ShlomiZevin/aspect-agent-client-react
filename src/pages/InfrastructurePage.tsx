import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './AboutShlomiPage.module.css';

export function InfrastructurePage() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    document.title = 'Infrastructure | Lybi';
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
            <span className={styles.navBadge}>Infrastructure</span>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>Tech Infrastructure</p>
          <h1 className={styles.h1}>Built for production. Runs on AI.</h1>
          <p className={styles.heroSub}>
            A production-grade platform running on Google Cloud — from multi-provider LLM routing
            to real-time streaming, managed databases, and AI-powered development.
            Already live, already serving real users.
          </p>
          <div className={styles.heroStats}>
            <div className={styles.stat}>
              <span className={styles.statNum}>3</span>
              <span className={styles.statLabel}>LLM providers</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>20+</span>
              <span className={styles.statLabel}>DB tables</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>39+</span>
              <span className={styles.statLabel}>Backend services</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>SSE</span>
              <span className={styles.statLabel}>Real-time streaming</span>
            </div>
          </div>
        </div>
      </header>

      {/* Cloud Architecture */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>Cloud</p>
          <h2 className={styles.h2}>Google Cloud Platform — production stack</h2>
          <div className={styles.domainFeatured}>
            <div className={styles.domainFeaturedCard}>
              <div className={styles.domainFeaturedIcon}>☁️</div>
              <h3>Cloud Run</h3>
              <p>
                Containerized Node.js 22 backend. Auto-scaling 1–3 instances, 2 CPU, 2GB RAM.
                europe-west1 region. Connects to Cloud SQL via Unix socket. Zero cold-start management needed.
              </p>
              <div className={styles.domainFeaturedMeta}>Compute</div>
            </div>
            <div className={styles.domainFeaturedCard}>
              <div className={styles.domainFeaturedIcon}>🔥</div>
              <h3>Firebase Hosting</h3>
              <p>
                React SPA served via global CDN. Automatic cache headers for static assets.
                SPA rewrites for client-side routing. Two projects: Aspect + Freeda.
              </p>
              <div className={styles.domainFeaturedMeta}>Frontend CDN</div>
            </div>
          </div>
          <div className={styles.domainFeatured}>
            <div className={styles.domainFeaturedCard}>
              <div className={styles.domainFeaturedIcon}>🐘</div>
              <h3>Cloud SQL — PostgreSQL</h3>
              <p>
                Managed PostgreSQL with Drizzle ORM. 20+ tables covering agents, conversations, messages,
                knowledge bases, context, tasks, feedback, analytics. Connection pooling, Unix socket from Cloud Run.
              </p>
              <div className={styles.domainFeaturedMeta}>Database</div>
            </div>
            <div className={styles.domainFeaturedCard}>
              <div className={styles.domainFeaturedIcon}>📦</div>
              <h3>Cloud Storage (GCS)</h3>
              <p>
                Knowledge base files synced across providers. Document storage for PDF, CSV, XLSX, DOCX, XML.
                Cross-provider KB sync — upload once, available on OpenAI, Google, and Anthropic.
              </p>
              <div className={styles.domainFeaturedMeta}>Storage & KB sync</div>
            </div>
          </div>
        </div>
      </section>

      {/* Backend */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>Backend</p>
          <h2 className={styles.h2}>39+ services, one server</h2>
          <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 20 }}>
            Express.js 5 on Node.js 22. Every capability is a service module — LLM routing, KB management,
            crew orchestration, context persistence, transcription, billing, testing, admin tools.
          </p>
          <div className={styles.stackFlow}>
            {[
              { cat: 'Core', tags: ['Express 5', 'Node.js 22', 'TypeScript', 'SSE Streaming', 'CORS', 'Multer'] },
              { cat: 'LLM', tags: ['OpenAI (GPT-4o, GPT-5)', 'Claude (Sonnet, Opus)', 'Gemini Flash', 'Multi-provider router', 'Fallback chains'] },
              { cat: 'Database', tags: ['Drizzle ORM', 'PostgreSQL', 'Migrations', 'Connection pooling', '20+ tables'] },
              { cat: 'KB', tags: ['OpenAI Vector Stores', 'Google Corpora', 'Anthropic Files', 'Pinecone', 'Document chunking', 'Embeddings'] },
              { cat: 'Services', tags: ['Crew dispatcher', 'Context system', 'Prompt versioning', 'Task board', 'Notifications', 'Feedback', 'Billing', 'Admin'] },
              { cat: 'Integrations', tags: ['WhatsApp Business', 'Nodemailer', 'Whisper transcription', 'FFmpeg audio', 'PDF/CSV/XLSX parsing'] },
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

      {/* Frontend */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>Frontend</p>
          <h2 className={styles.h2}>React 19 — real-time UI</h2>
          <div className={styles.pillarGrid}>
            <div className={styles.pillar}>
              <div className={styles.pillarIcon}>⚛️</div>
              <h3>React 19 + TypeScript</h3>
              <p>Vite build, CSS Modules, React Router 6. Type-safe across the entire client.</p>
            </div>
            <div className={styles.pillar}>
              <div className={styles.pillarIcon}>📡</div>
              <h3>SSE streaming client</h3>
              <p>Real-time token streaming, thinking steps, crew transitions, field extraction — all live in the UI.</p>
            </div>
            <div className={styles.pillar}>
              <div className={styles.pillarIcon}>🎨</div>
              <h3>Multi-agent UI</h3>
              <p>Crew tabs, debug panels, prompt editors, field viewers, profile panels, context editors — full builder experience.</p>
            </div>
          </div>
        </div>
      </section>

      {/* LLM Providers */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>AI</p>
          <h2 className={styles.h2}>Three LLM providers, one routing layer</h2>
          <div className={styles.domainFeatured}>
            <div className={styles.domainFeaturedCard}>
              <div className={styles.domainFeaturedIcon}>🟢</div>
              <h3>OpenAI</h3>
              <p>
                GPT-4o, GPT-5. Responses API, Vector Store file search, function calling,
                Whisper transcription. Primary provider for most agents.
              </p>
              <div className={styles.domainFeaturedMeta}>38KB service module</div>
            </div>
            <div className={styles.domainFeaturedCard}>
              <div className={styles.domainFeaturedIcon}>🟣</div>
              <h3>Anthropic Claude</h3>
              <p>
                Claude Sonnet 4, Claude Opus 4.6. Extended thinking, Files API for KB,
                function calling. Used as thinker model in crew architectures.
              </p>
              <div className={styles.domainFeaturedMeta}>28KB service module</div>
            </div>
          </div>
          <div className={styles.domainFeatured}>
            <div className={styles.domainFeaturedCard}>
              <div className={styles.domainFeaturedIcon}>🔵</div>
              <h3>Google Gemini</h3>
              <p>
                Gemini 2.0/2.5 Flash. GenAI SDK, File Search corpora, function calling.
                Fast and cost-effective talker model.
              </p>
              <div className={styles.domainFeaturedMeta}>24KB service module</div>
            </div>
            <div className={styles.domainFeaturedCard}>
              <div className={styles.domainFeaturedIcon}>🔀</div>
              <h3>Smart routing</h3>
              <p>
                One router selects provider by model name. Per-step model override. Automatic fallback
                on 429/5xx errors. Token usage tracked per call for billing.
              </p>
              <div className={styles.domainFeaturedMeta}>Provider-agnostic</div>
            </div>
          </div>
        </div>
      </section>

      {/* Knowledge Base */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>Knowledge Base</p>
          <h2 className={styles.h2}>Multi-layer KB architecture</h2>
          <div className={styles.domainFeatured}>
            <div className={styles.domainFeaturedCard}>
              <div className={styles.domainFeaturedIcon}>🌲</div>
              <h3>Pinecone — general vector search</h3>
              <p>
                Provider-agnostic vector database. Documents are chunked, embedded, and indexed in Pinecone.
                Works with any LLM provider — the universal KB layer. Custom embedding generation,
                chunking strategies, and similarity search.
              </p>
              <div className={styles.domainFeaturedMeta}>Universal KB — works with all providers</div>
            </div>
            <div className={styles.domainFeaturedCard}>
              <div className={styles.domainFeaturedIcon}>🔌</div>
              <h3>Built-in provider KBs</h3>
              <p>
                OpenAI Vector Stores and Google Corpora — native file search built into the provider.
                Faster, tighter integration when using that specific provider's models.
                Anthropic doesn't have native KB — uses Pinecone or file injection.
              </p>
              <div className={styles.domainFeaturedMeta}>OpenAI + Google native search</div>
            </div>
          </div>
          <div className={styles.domainFeatured}>
            <div className={styles.domainFeaturedCard}>
              <div className={styles.domainFeaturedIcon}>🔄</div>
              <h3>Cross-provider sync</h3>
              <p>
                Upload a document once → GCS stores it → synced to OpenAI Vector Store, Google Corpus,
                and Pinecone automatically. Switch providers without re-uploading files.
              </p>
              <div className={styles.domainFeaturedMeta}>Upload once, available everywhere</div>
            </div>
            <div className={styles.domainFeaturedCard}>
              <div className={styles.domainFeaturedIcon}>📄</div>
              <h3>Document processing</h3>
              <p>
                PDF, CSV, XLSX, DOCX, XML, QVD. Parsed, chunked, embedded.
                Dynamic KB files editable from admin. Full file lifecycle management.
              </p>
              <div className={styles.domainFeaturedMeta}>6+ file formats supported</div>
            </div>
          </div>
        </div>
      </section>

      {/* Database */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>Database</p>
          <h2 className={styles.h2}>20+ tables — the full data model</h2>
          <div className={styles.stackFlow}>
            {[
              { cat: 'Core', tags: ['agents', 'users', 'conversations', 'messages'] },
              { cat: 'Knowledge', tags: ['knowledge_bases', 'knowledge_base_files', 'dynamic_kb_files', 'library_files'] },
              { cat: 'Crew', tags: ['crew_members', 'crew_prompts', 'context_data', 'thinking_steps'] },
              { cat: 'Feedback', tags: ['message_feedback', 'feedback_tags'] },
              { cat: 'Tasks', tags: ['tasks', 'task_comments', 'task_assignees', 'task_notifications'] },
              { cat: 'Analytics', tags: ['test_configs', 'test_runs', 'llm_usage'] },
              { cat: 'Domain', tags: ['user_symptoms', 'demoMockups', 'provider_config'] },
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

      {/* DevOps & AI Development */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>DevOps & Development</p>
          <h2 className={styles.h2}>AI-powered development pipeline</h2>
          <div className={styles.domainFeatured}>
            <div className={styles.domainFeaturedCard}>
              <div className={styles.domainFeaturedIcon}>🤖</div>
              <h3>Claude Code — the developer</h3>
              <p>
                The entire codebase — server, client, infrastructure — is developed with Claude Code.
                Feature implementation, bug fixes, refactoring, testing — AI handles the execution,
                the CTO handles the direction. Tasks are described, reviewed, iterated, and shipped.
                What used to take teams months now takes days.
              </p>
              <div className={styles.domainFeaturedMeta}>100x development speed</div>
            </div>
            <div className={styles.domainFeaturedCard}>
              <div className={styles.domainFeaturedIcon}>🧪</div>
              <h3>Testing & QA</h3>
              <p>
                Built-in test runner for agent testing — configurable test scenarios per agent,
                conversation flow tests, individual response tests, review mode.
                TypeScript compilation as a safety net. AI-assisted test creation and debugging.
              </p>
              <div className={styles.domainFeaturedMeta}>Automated agent testing</div>
            </div>
          </div>
          <div className={styles.domainFeatured}>
            <div className={styles.domainFeaturedCard}>
              <div className={styles.domainFeaturedIcon}>🐳</div>
              <h3>Containerized deployment</h3>
              <p>
                Docker containers on Node.js 22 slim. Deploy script handles environment selection
                (Aspect vs Freeda), Cloud SQL binding, environment variables. One command to production.
              </p>
              <div className={styles.domainFeaturedMeta}>Docker + Cloud Run</div>
            </div>
            <div className={styles.domainFeaturedCard}>
              <div className={styles.domainFeaturedIcon}>📊</div>
              <h3>Observability</h3>
              <p>
                Token usage tracking per LLM call (provider, model, input/output tokens).
                Thinking steps logged for every conversation turn. Crew transitions tracked.
                Full audit trail from user message to response.
              </p>
              <div className={styles.domainFeaturedMeta}>Billing + analytics</div>
            </div>
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>Integrations</p>
          <h2 className={styles.h2}>Connected to the real world</h2>
          <div className={styles.pillarGrid}>
            <div className={styles.pillar}>
              <div className={styles.pillarIcon}>💬</div>
              <h3>WhatsApp Business</h3>
              <p>Full WhatsApp bridge — incoming messages, user mapping, same agent logic on a different channel.</p>
            </div>
            <div className={styles.pillar}>
              <div className={styles.pillarIcon}>🎤</div>
              <h3>Audio & Transcription</h3>
              <p>Whisper + Gemini File API. FFmpeg processing for large files. Voice messages transcribed and processed.</p>
            </div>
            <div className={styles.pillar}>
              <div className={styles.pillarIcon}>📄</div>
              <h3>Document Processing</h3>
              <p>PDF, CSV, XLSX, DOCX, XML, QVD. Upload to KB, chunked, embedded, searchable across all providers.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>Lybi — Infrastructure</footer>
    </div>
  );
}
