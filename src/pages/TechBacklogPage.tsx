import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './AboutShlomiPage.module.css';

const BACKLOG = [
  {
    num: 0, priority: 'focus', title: 'Finalize demo — thinker response time',
    desc: 'Main product focus right now. The thinker step adds latency — working to bring total thinking time down to 5–6 seconds. Prompt optimization, model selection, parallel execution where possible.',
    est: 'Ongoing',
    tags: ['Product', 'Performance'],
  },
  {
    num: 1, priority: 'now', title: 'Separate prod and staging environments',
    desc: 'Run staging and production on separate Cloud Run + Cloud SQL instances. Test changes safely without touching live.',
    est: '1–2 days',
    tags: ['DevOps'],
  },
  {
    num: 2, priority: 'now', title: 'Multi-environment deployment',
    desc: 'Clean deploy script that handles different environments (and potentially different customers). One command, right target.',
    est: '1 day',
    tags: ['DevOps'],
  },
  {
    num: 3, priority: 'now', title: 'Environment variables management',
    desc: 'Document every env var — what it does, where to get it, notes. Either an admin page or a well-structured template file. Easy to onboard, easy to debug.',
    est: '1 day',
    tags: ['DevOps', 'DX'],
  },
  {
    num: 4, priority: 'now', title: 'Run logs in admin',
    desc: 'See LLM call logs, errors, and events from inside our admin dashboard. No need to open GCP console.',
    est: '2–3 days',
    tags: ['Admin', 'Monitoring'],
  },
  {
    num: 5, priority: 'soon', title: 'API authentication',
    desc: 'Make sure no one can just call our endpoints. API key validation on the streaming endpoint. Not full user auth — just basic protection.',
    est: '1 day',
    tags: ['Security'],
  },
  {
    num: 6, priority: 'soon', title: 'Complete test runner',
    desc: 'Infrastructure exists. Needs finishing — automated regression tests before deploy. "Did the agent break after this prompt change?"',
    est: '3–4 days',
    tags: ['Testing', 'QA'],
  },
  {
    num: 7, priority: 'soon', title: 'Pinecone KB in the tool',
    desc: 'Pinecone service exists but not wired into the builder UI. Connect it as a KB option alongside OpenAI and Google. Provider-agnostic KB layer.',
    est: '2–3 days',
    tags: ['KB', 'Product'],
  },
  {
    num: 8, priority: 'soon', title: 'Twilio / WhatsApp',
    desc: 'WhatsApp bridge exists. Needs Twilio integration completed — production credentials, webhook setup, outbound templates.',
    est: '2–3 days',
    tags: ['Integrations'],
  },
  {
    num: 9, priority: 'later', title: 'LLM providers refactor',
    desc: 'Clean up provider-specific logic that leaks into crew code. Everything should go through the engine layer — crew code stays provider-agnostic.',
    est: '2–3 days',
    tags: ['Architecture'],
  },
  {
    num: 10, priority: 'later', title: 'Server.js decomposition',
    desc: 'Split 4000+ line server.js into route modules. Agents, conversations, KB, tasks, admin — each in its own file. Cleaner, testable.',
    est: '2–3 days',
    tags: ['Architecture'],
  },
  {
    num: 11, priority: 'later', title: 'User management & roles',
    desc: 'Login system, sessions, role-based access. Who can edit prompts, who can see conversations, who can manage KB.',
    est: '3–5 days',
    tags: ['Auth', 'Users'],
  },
  {
    num: 12, priority: 'later', title: 'Usage limits per user',
    desc: 'Rate limiting, token budgets per customer. Prevent abuse, control costs. Ties into existing llm_usage tracking.',
    est: '2 days',
    tags: ['Security', 'Billing'],
  },
  {
    num: 13, priority: 'whenever', title: 'WebSocket / SSE cleanup',
    desc: 'Some code references WebSockets but we only use SSE. Clean up unused code and dependencies.',
    est: 'Half day',
    tags: ['Cleanup'],
  },
  {
    num: 14, priority: 'whenever', title: 'Privacy / GDPR',
    desc: 'Data deletion, export, consent tracking. Delete a user → delete everything. Needed for compliance.',
    est: '2 days',
    tags: ['Compliance'],
  },
];

const PRIORITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  focus: { bg: 'rgba(239,68,68,0.1)', text: '#ef4444', label: 'Focus' },
  now: { bg: 'rgba(139,92,246,0.1)', text: '#a78bfa', label: 'Now' },
  soon: { bg: 'rgba(59,130,246,0.1)', text: '#60a5fa', label: 'Soon' },
  later: { bg: 'rgba(234,179,8,0.1)', text: '#eab308', label: 'Later' },
  whenever: { bg: 'rgba(107,114,128,0.1)', text: '#6b7280', label: 'Whenever' },
};

export function TechBacklogPage() {
  const [dark, setDark] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Tech Backlog | Lybi';
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    return () => { document.documentElement.style.overflow = ''; document.body.style.overflow = ''; };
  }, []);

  const filtered = filter ? BACKLOG.filter(b => b.priority === filter) : BACKLOG;
  const allTags = [...new Set(BACKLOG.flatMap(b => b.tags))].sort();

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
            <span className={styles.navBadge}>Backlog</span>
          </div>
        </div>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>Tech debt & foundations</p>
          <h1 className={styles.h1}>Good time to get these done</h1>
          <p className={styles.heroSub}>
            The product is ready for demo. Before we run ahead with features,
            there are some foundational things worth doing while we have the window.
            None are blockers — all make us more solid for what's next.
          </p>
          <div className={styles.heroStats}>
            {Object.entries(PRIORITY_COLORS).map(([key, val]) => {
              const count = BACKLOG.filter(b => b.priority === key).length;
              return (
                <button key={key} className={styles.stat} onClick={() => setFilter(filter === key ? null : key)}
                  style={{ cursor: 'pointer', opacity: filter && filter !== key ? 0.4 : 1, transition: 'opacity 0.2s' }}>
                  <span className={styles.statNum} style={{ color: val.text }}>{count}</span>
                  <span className={styles.statLabel}>{val.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Rough timeline */}
      <section style={{ padding: '0 48px 40px' }}>
        <div className={styles.sectionInner}>
          <div style={{
            padding: '20px 24px',
            background: dark ? 'rgba(139,92,246,0.06)' : 'rgba(104,6,98,0.03)',
            border: `1px solid ${dark ? 'rgba(139,92,246,0.12)' : 'rgba(104,6,98,0.1)'}`,
            borderRadius: 12,
            display: 'flex',
            gap: 32,
            alignItems: 'center',
            flexWrap: 'wrap' as const,
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: dark ? '#a78bfa' : '#680662', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 4 }}>Rough total estimate</div>
              <div style={{ fontSize: 24, fontWeight: 400, fontFamily: "'Playfair Display', serif", color: dark ? '#ffffff' : '#1C1917' }}>~2–3 weeks</div>
              <div style={{ fontSize: 12, color: dark ? '#64748b' : '#78716C', marginTop: 2 }}>2 people + Claude Code</div>
            </div>
            <div style={{ height: 48, width: 1, background: dark ? 'rgba(255,255,255,0.08)' : '#E7E5E4' }} />
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' as const }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: dark ? '#a78bfa' : '#680662' }}>Week 1</div>
                <div style={{ fontSize: 11, color: dark ? '#94a3b8' : '#57534E' }}>Environments, deploy, env vars, logs</div>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: dark ? '#60a5fa' : '#2563eb' }}>Week 2</div>
                <div style={{ fontSize: 11, color: dark ? '#94a3b8' : '#57534E' }}>API auth, test runner, Pinecone KB</div>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: dark ? '#eab308' : '#ca8a04' }}>Week 3</div>
                <div style={{ fontSize: 11, color: dark ? '#94a3b8' : '#57534E' }}>WhatsApp, LLM refactor, server split</div>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: dark ? '#6b7280' : '#9ca3af' }}>Week 4</div>
                <div style={{ fontSize: 11, color: dark ? '#94a3b8' : '#57534E' }}>Users, limits, cleanup, GDPR</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} style={{ paddingTop: 0 }}>
        <div className={styles.sectionInner}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(item => {
              const p = PRIORITY_COLORS[item.priority];
              return (
                <div key={item.num} style={{
                  padding: '20px 24px',
                  background: dark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                  border: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#E7E5E4'}`,
                  borderRadius: 12,
                  borderLeft: `4px solid ${p.text}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 600,
                      background: p.bg, color: p.text,
                    }}>{item.num}</span>
                    <span style={{ fontSize: 16, fontWeight: 600, color: dark ? '#ffffff' : '#1C1917', flex: 1 }}>
                      {item.title}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 4,
                      background: p.bg, color: p.text, textTransform: 'uppercase' as const, letterSpacing: '0.05em',
                    }}>{p.label}</span>
                  </div>
                  <p style={{ fontSize: 13, color: dark ? '#94a3b8' : '#57534E', margin: '0 0 10px', lineHeight: 1.65, paddingLeft: 40 }}>
                    {item.desc}
                  </p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const, paddingLeft: 40 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 500, color: dark ? '#94a3b8' : '#57534E',
                    }}>~{item.est}</span>
                    <span style={{ color: dark ? 'rgba(255,255,255,0.1)' : '#E7E5E4' }}>|</span>
                    {item.tags.map(t => (
                      <span key={t} style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 4,
                        background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                        color: dark ? '#64748b' : '#78716C',
                        border: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#E7E5E4'}`,
                      }}>{t}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tags overview */}
          <div style={{ marginTop: 40, paddingTop: 24, borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#E7E5E4'}` }}>
            <p className={styles.eyebrow}>All tags</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
              {allTags.map(t => (
                <span key={t} className={styles.stackTag}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>Lybi — Tech Backlog</footer>
    </div>
  );
}
