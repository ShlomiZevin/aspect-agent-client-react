import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './AboutShlomiPage.module.css';

/**
 * Enterprise & Compliance Readiness
 * -------------------------------------------------------------------------
 * Lybi's prepared answers to enterprise vendor due-diligence — the kind a
 * קופת חולים (e.g. Maccabi) or a bank sends after the first CTO meeting.
 * The source questionnaire (Frida.xlsx) was originally raised when the project
 * was menopause-only; this page answers it for the general Lybi platform.
 *
 * Honesty policy: every answer is grounded in what the platform actually does
 * today. Gaps and roadmap items are marked as such — nothing is oversold.
 * Status legend:
 *   ready    → live in production today
 *   progress → actively being built / partially in place
 *   roadmap  → planned, not started, offered per-contract
 *   business → commercial fact to be completed by the founders (not technical)
 */

type Status = 'ready' | 'progress' | 'roadmap' | 'business';

const STATUS: Record<Status, { label: string; color: string; bg: string }> = {
  ready:    { label: 'Live today',   color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  progress: { label: 'In progress',  color: '#a78bfa', bg: 'rgba(139,92,246,0.12)' },
  roadmap:  { label: 'Roadmap',      color: '#60a5fa', bg: 'rgba(59,130,246,0.12)' },
  business: { label: 'Founders fill', color: '#eab308', bg: 'rgba(234,179,8,0.12)' },
};

type Item = { q: string; heb?: string; a: string; status: Status };
type Section = { cat: string; heb: string; icon: string; items: Item[] };

const SECTIONS: Section[] = [
  {
    cat: 'Company profile', heb: 'מאפייני החברה', icon: '🏢',
    items: [
      { q: 'Background — founding year, founders', heb: 'רקע — שנת הקמה, מייסדים',
        a: 'Lybi is an Israeli AI company founded by Hila (product & domain) and Shlomi Zevin (CTO, 20+ years in tech). Exact incorporation date, cap table and founder bios provided in the corporate one-pager.',
        status: 'business' },
      { q: 'Knowledge in medical / health technologies', heb: 'ידע בטכנולוגיות רפואיות',
        a: 'Yes. Our first live agent, Freeda, is a menopause companion grounded in a curated clinical knowledge base — NICE, NAMS, BMS guidelines and peer-reviewed literature — with structured symptom assessment. We have hands-on experience turning medical guidelines into safe, cited conversational guidance.',
        status: 'ready' },
      { q: 'Revenue — last 3 years (company only, not parent)', heb: 'מחזור כספי 3 שנים',
        a: 'Commercial figures provided separately by the founders. (Early-stage — figures reflect the company itself; there is no parent company.)',
        status: 'business' },
      { q: 'Total headcount', heb: 'מספר עובדים כולל',
        a: 'Lean team amplified by AI-assisted development. Exact headcount in the corporate one-pager.',
        status: 'business' },
      { q: 'Size of the development (technical) team', heb: 'גודל מחלקת הפיתוח',
        a: 'Small senior engineering core. The entire stack (server, client, infra) is built by a compact team using Claude Code, giving output far above headcount.',
        status: 'business' },
      { q: 'Israeli company?', heb: 'חברה ישראלית?', a: 'Yes.', status: 'business' },
      { q: 'International activity', heb: 'פעילות בינלאומית',
        a: 'Platform is multilingual (Hebrew + English i18n) and cloud-hosted; go-to-market details provided by the founders.', status: 'business' },
      { q: 'Strategic partnerships', heb: 'שיתופי פעולה אסטרטגיים',
        a: 'LLM providers (OpenAI, Anthropic, Google) and Google Cloud as the infrastructure partner. Commercial partnerships listed by the founders.', status: 'business' },
    ],
  },
  {
    cat: 'Customers', heb: 'לקוחות', icon: '👥',
    items: [
      { q: 'Customers in Israel', heb: 'מספר לקוחות בארץ', a: 'Provided by the founders.', status: 'business' },
      { q: 'Customers abroad', heb: 'מספר לקוחות בחו״ל', a: 'Provided by the founders.', status: 'business' },
      { q: 'Enterprise customers (IL + abroad)', heb: 'לקוחות אנטרפרייז', a: 'Provided by the founders.', status: 'business' },
      { q: 'Healthcare-domain customers', heb: 'לקוחות בעולם ה-healthcare',
        a: 'Freeda operates in women\'s-health / menopause. Healthcare traction detailed by the founders.', status: 'business' },
      { q: 'Trend — new customers over the last 3 years', heb: 'מגמת לקוחות חדשים', a: 'Provided by the founders.', status: 'business' },
    ],
  },
  {
    cat: 'Products', heb: 'מוצרים', icon: '📦',
    items: [
      { q: 'How many products? Which algorithms (medical focus)? Development assets?', heb: 'כמה מוצרים? אלגוריתמים? נכסים',
        a: 'One platform, many agents. The core IP is: (1) a Crew System that decomposes a conversation into specialized sub-agents with deterministic and tool-driven transitions; (2) a Thinker/Talker dual-model architecture (a background model makes structured clinical/decision logic, a talker model produces the reply); (3) parallel field-extraction from natural language; (4) a provider-agnostic knowledge-base layer. Medical-focused logic today: Freeda\'s symptom classification (emotional / cognitive / physical), guideline-grounded retrieval, and safety framing.',
        status: 'ready' },
      { q: 'Experience with GenAI', heb: 'ידע בשימוש ב-GenAI',
        a: 'GenAI is the core competency. Multi-provider routing across OpenAI (GPT-4o/GPT-5), Anthropic (Claude Sonnet/Opus) and Google (Gemini), retrieval-augmented generation, function/tool calling, streaming, transcription (Whisper), and automated agent testing — all in production.',
        status: 'ready' },
      { q: 'What problems do you solve?', heb: 'על אילו בעיות נותנים מענה',
        a: 'Stateful, multi-step domain conversations that a generic chatbot cannot do safely: guided onboarding, data collection from natural dialogue, grounded domain guidance, and hand-offs between specialized stages — with a full audit trail of every step.',
        status: 'ready' },
      { q: 'Products relevant to Maccabi / a health fund', heb: 'מוצרים רלוונטיים לקופ״ח',
        a: 'The agent-builder platform for member-facing health assistants (triage-style intake, condition companions like Freeda, benefit/eligibility Q&A grounded in the fund\'s own documents), all white-labelable to the fund\'s brand and deployable in an isolated environment.',
        status: 'ready' },
    ],
  },
  {
    cat: 'Architecture, InfoSec & implementation', heb: 'ארכיטקטורה, אבטחת מידע ויישום', icon: '🛡️',
    items: [
      { q: 'SaaS / On-prem?', heb: 'SAAS / On-prem',
        a: 'Managed SaaS on Google Cloud today. For regulated clients we offer a single-tenant dedicated deployment (isolated Cloud Run + dedicated Cloud SQL) in a customer-designated GCP project/VPC. A full on-prem / private-cloud install is available as a project (containerized — Docker), on the roadmap for the first enterprise deal that requires it.',
        status: 'progress' },
      { q: 'Cloud services: server names/locations, cloud provider, geographic location of patient data incl. backups, isolation from other tenants', heb: 'מיקום שרתים, ספק ענן, מיקום גיאוגרפי של מידע מטופלים, הפרדה מלקוחות',
        a: 'Provider: Google Cloud Platform. Current region: europe-west1 (St. Ghislain, Belgium — EU). Patient/member data and all backups reside in-region. For data-residency requirements, the stack can be deployed to GCP\'s Israel region (me-west1, Tel Aviv) so data and backups never leave Israel. Tenant isolation: logical isolation today (every row keyed by tenant/agent slug); for a health fund we deploy a dedicated database and service instance so there is physical separation from all other customers.',
        status: 'progress' },
      { q: 'InfoSec components in the cloud; is data encrypted at rest?', heb: 'רכיבי אבטחת מידע; הצפנה',
        a: 'Encryption in transit (TLS/HTTPS everywhere, SSE over HTTPS) and at rest by default — Cloud SQL and Cloud Storage encrypt all data with AES-256 managed keys; customer-managed keys (CMEK) available on request. Secrets held in Cloud Run env / Secret Manager, not in code. Network access via GCP IAM and private Cloud SQL connectivity.',
        status: 'ready' },
      { q: 'Cloud provider certifications & audits', heb: 'הסמכות ומבדקים של ספק הענן',
        a: 'Google Cloud is certified to ISO/IEC 27001, 27017, 27018, SOC 1/2/3, PCI DSS, and supports HIPAA-aligned workloads (BAA available). Certifications inherited by our deployment for the infrastructure layer.',
        status: 'ready' },
      { q: 'Development languages, databases, technologies', heb: 'שפות פיתוח, מסדי נתונים, טכנולוגיות',
        a: 'Backend: Node.js 22 + Express 5 (TypeScript-friendly JS). Frontend: React 19 + TypeScript + Vite. Database: PostgreSQL (Cloud SQL) via Drizzle ORM. Vector DB: Pinecone (+ OpenAI Vector Stores / Google corpora). Object storage: Google Cloud Storage. Transport: HTTPS + Server-Sent Events.',
        status: 'ready' },
      { q: 'User & group management incl. AD sync from multiple sources', heb: 'ניהול משתמשים וקבוצות, סנכרון ל-AD',
        a: 'Authentication today via Firebase Auth. Enterprise identity — SAML/OIDC federation, SCIM provisioning and Active Directory / LDAP group sync — is on the roadmap and delivered as part of an enterprise engagement (role-based access is the next foundations item).',
        status: 'roadmap' },
      { q: 'SSO', heb: 'SSO',
        a: 'Not yet native. SAML 2.0 / OIDC single sign-on (Azure AD / Okta / Google Workspace) is a planned enterprise capability delivered on integration.',
        status: 'roadmap' },
      { q: 'Load capacity; simple & fast infrastructure scaling', heb: 'עומסים; גידול תשתיתי',
        a: 'The application tier is stateless and runs on Cloud Run with automatic horizontal autoscaling (scale-out on concurrency, health-checked instances). Scaling up is a configuration change, not a re-architecture. PostgreSQL scales vertically and via read replicas; the LLM router load-balances and fails over across three providers.',
        status: 'ready' },
      { q: 'Standardization — modern, up-to-date component versions', heb: 'סטנדרטיזציה ועדכניות גרסאות',
        a: 'Current LTS/latest across the stack: Node.js 22, Express 5, React 19, PostgreSQL, Vite. Standard protocols only (HTTPS, REST, JSON, SSE, SAML/OIDC on the identity roadmap). No proprietary transport.',
        status: 'ready' },
      { q: 'SOC 2 / ISO 27001 certification (company-level)', heb: 'סרטיפיקציית SOC/ISO',
        a: 'Honest status: the infrastructure (GCP) is certified, but Lybi as a company is not yet SOC 2 / ISO 27001 certified. We follow the controls and can commit to a certification track (typically Type I → Type II) as part of an enterprise agreement, and will sign a DPA / BAA in the interim.',
        status: 'roadmap' },
      { q: 'Product customization — functionality & UI', heb: 'התאמת המוצר ללקוח — פונקציונליות ו-UI',
        a: 'Deep. Every agent is white-labelable — logo, colors, typography and copy are per-agent config; the entire persona, crew flow, tools and knowledge base are configurable without code via the builder. Functionality is composed from crew members, so a fund-specific flow is a configuration exercise, not a fork.',
        status: 'ready' },
      { q: 'Data — what is stored, where; which databases (relational / no-SQL)?', heb: 'נתונים — מה נשמר, איפה, בסיסי נתונים',
        a: 'Relational (PostgreSQL): agents, users, conversations, messages, context, KB metadata, feedback, usage. Vector (Pinecone / provider stores): embedded knowledge-base chunks. Object (GCS): uploaded source documents. JSONB is used within PostgreSQL for flexible/no-SQL-style metadata. Data minimization: we store only what the conversation requires; retention and deletion are configurable per tenant.',
        status: 'ready' },
      { q: 'Architecture description + diagrams', heb: 'תיאור ארכיטקטורה ותרשימים',
        a: 'Full architecture is documented (see the Infrastructure page in this knowledge base). Two-service split — React client on Firebase Hosting, Node/Express server on Cloud Run — connected to Cloud SQL, GCS, Pinecone and the three LLM providers. Diagrams provided in the technical annex.',
        status: 'ready' },
    ],
  },
  {
    cat: 'Integration', heb: 'אינטגרציה', icon: '🔌',
    items: [
      { q: 'Fast exposure of endpoints in a uniform format (JSON), short time-to-market', heb: 'חשיפת EndPoints מהירה בפורמט JSON',
        a: 'Yes. The server exposes REST + SSE endpoints, all JSON. New endpoints are quick to add on the single Express service — hours to days, not sprints.',
        status: 'ready' },
      { q: 'Ability to consume web services from any other system', heb: 'צריכת Web Services ממערכות אחרות',
        a: 'Yes — the server already consumes external services (LLM APIs, WhatsApp Business, email, transcription). Integrating a fund\'s REST/SOAP service is standard work.',
        status: 'ready' },
      { q: 'REST API support', heb: 'תמיכה ב-REST API', a: 'Yes — REST is the primary API style, JSON payloads, standard HTTP verbs and status codes.', status: 'ready' },
      { q: 'Native Kafka interfacing', heb: 'התממשקות לקפקא',
        a: 'Not native today. We can produce/consume to Kafka via a connector as part of an integration; event-streaming is on the roadmap for enterprise deployments that require it.',
        status: 'roadmap' },
    ],
  },
  {
    cat: 'Redundancy', heb: 'יתירות', icon: '♻️',
    items: [
      { q: 'What redundancy does the system implement for resilience, and in which components?', heb: 'יכולות redundancy לשרידות',
        a: 'App tier: stateless Cloud Run with multi-instance autoscaling and automatic health-checked restarts. Database: Cloud SQL supports regional high-availability (synchronous standby + automated failover) plus automated backups and point-in-time recovery — enabled per deployment tier. Storage: GCS is redundant by design. LLM layer: automatic fallback across three providers on error/limit — no single AI vendor is a single point of failure. CDN-served, cache-headed frontend.',
        status: 'progress' },
    ],
  },
  {
    cat: 'Logging', heb: 'לוגים', icon: '📋',
    items: [
      { q: 'Logging infrastructure & management (infra + application), format, Elastic integration', heb: 'ניהול לוגים, פורמט, התממשקות לאלסטיק',
        a: 'Infrastructure and application logs flow to Google Cloud Logging (structured JSON, queryable, retained). Application-level audit trail is richer than typical: every LLM call is recorded in llm_usage (provider, model, tokens, latency), and every conversation turn logs its thinking-steps and crew transitions — a full message-to-response trail. Elastic/SIEM: not native today, but Cloud Logging can stream to Elastic / any SIEM via a Pub/Sub log sink — offered on integration.',
        status: 'progress' },
    ],
  },
  {
    cat: 'Reports & feedback', heb: 'דוחות ומשוב', icon: '📊',
    items: [
      { q: 'Reports module as an integral part of the tool', heb: 'מודול דוחות אינטגרלי',
        a: 'Yes — the admin dashboard includes LLM-usage/cost analytics, conversation-trends reporting, and message-level feedback with tagging, all built in.',
        status: 'ready' },
      { q: 'Self-service query definition', heb: 'הגדרת שאילתות (self-service)',
        a: 'Dashboard filters today (by agent, crew, date). A self-service query/report builder is on the roadmap.',
        status: 'progress' },
      { q: 'Support for building new reports', heb: 'פיתוח דוחות חדשים',
        a: 'Yes — new reports are quick to add over the structured PostgreSQL data; custom reports delivered on request.',
        status: 'ready' },
    ],
  },
  {
    cat: 'Training', heb: 'הדרכה והכשרה', icon: '🎓',
    items: [
      { q: 'What training & enablement does the company provide?', heb: 'יכולות הדרכה והכשרה',
        a: 'Admin & builder onboarding (how to configure agents, crews, knowledge bases and prompts — no code required), written documentation, and hands-on enablement sessions for the client team. The builder is designed to be self-service after onboarding.',
        status: 'ready' },
    ],
  },
  {
    cat: 'SLA & support', heb: 'SLA וטיפול בתקלות', icon: '🛟',
    items: [
      { q: 'Ongoing support, incident handling, SLA', heb: 'תמיכה שוטפת, תקלות, SLA',
        a: 'Tiered SLA defined per contract (target response/resolution by severity, coverage window, escalation path). Monitoring and alerting on the platform, with incident handling by the engineering team. Concrete SLA figures agreed commercially.',
        status: 'business' },
    ],
  },
  {
    cat: 'Customer Success', heb: 'Customer Success', icon: '🤝',
    items: [
      { q: 'Engagement & support model', heb: 'שיטת ההתקשרות והתמיכה',
        a: 'Dedicated point of contact, structured onboarding, regular review cadence, and a shared roadmap for agent evolution. Support channels and cadence defined in the agreement.',
        status: 'business' },
    ],
  },
];

const HARD_ITEMS = [
  { t: 'Data residency in Israel', d: 'Health funds and banks often require data (incl. backups) to stay in Israel. Deploy to GCP me-west1 (Tel Aviv) — supported.' },
  { t: 'Single-tenant isolation', d: 'Dedicated DB + service instance per fund/bank, not shared logical isolation. Offered for regulated clients.' },
  { t: 'SOC 2 / ISO 27001 (company-level)', d: 'Infra is certified; the company is not yet. Commit to a certification track + DPA/BAA in the interim. Honest gap.' },
  { t: 'SSO / AD / SCIM', d: 'SAML/OIDC + Active Directory sync is a hard requirement for enterprise IT. On the roadmap, delivered per engagement.' },
  { t: 'Audit logging & SIEM', d: 'Full trail exists in Cloud Logging + DB; streaming to the client\'s Elastic/SIEM offered on integration.' },
  { t: 'Penetration test & privacy law', d: 'Expect a pen-test and Israeli Privacy Protection Law (תיקון 13) / GDPR data-subject rights. Privacy/GDPR tooling is a scheduled item.' },
];

export function EnterpriseReadinessPage() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    document.title = 'Enterprise & Compliance Readiness | Lybi';
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    return () => { document.documentElement.style.overflow = ''; document.body.style.overflow = ''; };
  }, []);

  const cardBg = dark ? 'rgba(255,255,255,0.03)' : '#ffffff';
  const cardBorder = dark ? 'rgba(255,255,255,0.06)' : '#E7E5E4';
  const subText = dark ? '#94a3b8' : '#57534E';
  const qText = dark ? '#ffffff' : '#1C1917';

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
            <span className={styles.navBadge}>Readiness</span>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>Enterprise vendor due-diligence</p>
          <h1 className={styles.h1}>Ready for a health fund. Ready for a bank.</h1>
          <p className={styles.heroSub}>
            Our prepared answers to the kind of due-diligence a קופת חולים or a bank sends after
            the first CTO meeting — company, architecture, information security, integration,
            redundancy, logging and SLA. Grounded in what the platform does today, honest about
            what is on the roadmap.
          </p>
          <div className={styles.heroStats}>
            {(['ready', 'progress', 'roadmap', 'business'] as Status[]).map(s => {
              const count = SECTIONS.flatMap(sec => sec.items).filter(i => i.status === s).length;
              return (
                <div key={s} className={styles.stat}>
                  <span className={styles.statNum} style={{ color: STATUS[s].color }}>{count}</span>
                  <span className={styles.statLabel}>{STATUS[s].label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* Context note */}
      <section style={{ padding: '0 48px 32px' }}>
        <div className={styles.sectionInner}>
          <div style={{
            padding: '18px 22px',
            background: dark ? 'rgba(139,92,246,0.06)' : 'rgba(104,6,98,0.03)',
            border: `1px solid ${dark ? 'rgba(139,92,246,0.12)' : 'rgba(104,6,98,0.1)'}`,
            borderRadius: 12,
          }}>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: subText, margin: 0 }}>
              <strong style={{ color: qText }}>Context.</strong> This questionnaire was first raised by
              a health fund when Lybi was a menopause-only project (Freeda). We are now building the
              general multi-agent platform — so these answers cover the platform as a whole. Each answer
              carries a status: <span style={{ color: STATUS.ready.color }}>live today</span>,{' '}
              <span style={{ color: STATUS.progress.color }}>in progress</span>,{' '}
              <span style={{ color: STATUS.roadmap.color }}>roadmap</span>, or{' '}
              <span style={{ color: STATUS.business.color }}>a commercial fact for the founders to fill in</span>.
              Nothing here is oversold — where we are not there yet, it says so.
            </p>
          </div>
        </div>
      </section>

      {/* Extra-hard for health funds & banks */}
      <section style={{ padding: '0 48px 40px' }}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>Watch-list</p>
          <h2 className={styles.h2}>The hard parts — health funds &amp; banks</h2>
          <p style={{ fontSize: 13, color: subText, margin: '0 0 20px', lineHeight: 1.6 }}>
            These are the items regulated buyers push hardest on. Knowing them in advance is the
            difference between a smooth process and a stalled one.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            {HARD_ITEMS.map(h => (
              <div key={h.t} style={{
                padding: '16px 18px', background: cardBg,
                border: `1px solid ${cardBorder}`, borderLeft: '4px solid #f59e0b',
                borderRadius: 12,
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: qText, marginBottom: 6 }}>{h.t}</div>
                <div style={{ fontSize: 12.5, color: subText, lineHeight: 1.6 }}>{h.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Q&A sections */}
      {SECTIONS.map((sec, si) => (
        <section key={sec.cat} className={`${styles.section} ${si % 2 ? styles.sectionAlt : ''}`} style={{ paddingTop: 32, paddingBottom: 32 }}>
          <div className={styles.sectionInner}>
            <p className={styles.eyebrow}>{sec.icon} {sec.heb}</p>
            <h2 className={styles.h2}>{sec.cat}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
              {sec.items.map((item, ii) => {
                const st = STATUS[item.status];
                return (
                  <div key={ii} style={{
                    padding: '18px 22px', background: cardBg,
                    border: `1px solid ${cardBorder}`, borderLeft: `4px solid ${st.color}`,
                    borderRadius: 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: qText, flex: 1, minWidth: 200 }}>
                        {item.q}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 4,
                        background: st.bg, color: st.color, textTransform: 'uppercase',
                        letterSpacing: '0.05em', whiteSpace: 'nowrap',
                      }}>{st.label}</span>
                    </div>
                    {item.heb && (
                      <div dir="rtl" style={{ fontSize: 12, color: dark ? '#64748b' : '#a8a29e', marginBottom: 8 }}>
                        {item.heb}
                      </div>
                    )}
                    <p style={{ fontSize: 13.5, color: subText, margin: 0, lineHeight: 1.7 }}>
                      {item.a}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ))}

      {/* Closing */}
      <section className={styles.section} style={{ paddingTop: 24 }}>
        <div className={styles.sectionInner}>
          <div style={{
            padding: '20px 24px',
            background: dark ? 'rgba(34,197,94,0.05)' : 'rgba(34,197,94,0.04)',
            border: `1px solid ${dark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.2)'}`,
            borderRadius: 12,
          }}>
            <p style={{ fontSize: 13.5, color: subText, margin: 0, lineHeight: 1.7 }}>
              <strong style={{ color: qText }}>Bottom line.</strong> The technical foundation — cloud,
              encryption, architecture, integration, redundancy and audit logging — is production-grade
              and already serving real users. The remaining enterprise items (SSO/AD, company-level
              SOC 2 / ISO 27001, Kafka, self-service reporting) are well-understood, scoped, and
              delivered as part of the first regulated engagement. A Hebrew version of these answers,
              mapped one-to-one to the questionnaire columns, can be generated for submission.
            </p>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>Lybi — Enterprise &amp; Compliance Readiness</footer>
    </div>
  );
}
