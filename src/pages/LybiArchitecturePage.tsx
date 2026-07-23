import { useEffect } from 'react';
import { Link } from 'react-router-dom';

/**
 * דף ארכיטקטורה של Lybi — תרשים מערכת + מנוע השיחה (Builder v2.0).
 * עיצוב בהיר בלבד, בסגנון Lybi. מקושר מדף מענה שאלון בדיקת הנאותות.
 */

const PURPLE = '#680662';
const PURPLE_SOFT = 'rgba(104,6,98,0.06)';
const BG = '#FAF7F7';
const INK = '#1C1917';
const MUTED = '#78716C';
const FAINT = '#a8a29e';
const BORDER = '#E7E5E4';

function Box({ title, sub, accent }: { title: string; sub?: string; accent?: boolean }) {
  return (
    <div style={{
      background: accent ? PURPLE : '#fff',
      color: accent ? '#fff' : INK,
      border: `1px solid ${accent ? PURPLE : BORDER}`,
      borderRadius: 12,
      padding: '16px 22px',
      textAlign: 'center',
      minWidth: 240,
      boxShadow: accent ? '0 4px 18px rgba(104,6,98,0.18)' : '0 1px 2px rgba(0,0,0,0.03)',
    }}>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
      {sub && <div style={{ fontSize: 12.5, marginTop: 4, color: accent ? 'rgba(255,255,255,0.85)' : MUTED }}>{sub}</div>}
    </div>
  );
}

function Down({ label }: { label?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '4px 0' }}>
      {label && <span style={{ fontSize: 11, color: FAINT, letterSpacing: '0.02em' }}>{label}</span>}
      <span style={{ fontSize: 20, color: '#D6D3D1', lineHeight: 1 }}>↓</span>
    </div>
  );
}

const STORES = [
  { icon: '🐘', name: 'PostgreSQL', sub: 'Cloud SQL — נתונים רלציוניים (+ JSONB)' },
  { icon: '📦', name: 'Cloud Storage', sub: 'GCS — קבצים ומסמכי מקור' },
  { icon: '🌲', name: 'Pinecone', sub: 'מסד וקטורי — Knowledge Base' },
  { icon: '🤖', name: 'ספקי LLM', sub: 'OpenAI · Anthropic · Google' },
];

const CORTEX = [
  { icon: '🔎', name: 'Field Extractor', sub: 'חילוץ שדות' },
  { icon: '🧠', name: 'Thinker', sub: 'חשיבה והסקה' },
  { icon: '📚', name: 'KB Retriever', sub: 'אחזור ידע' },
  { icon: '💬', name: 'Talker', sub: 'מענה למשתמש' },
  { icon: '🔀', name: 'Transition Router', sub: 'ניתוב בין שלבים' },
];

const FLOW = [
  'המשתמש שולח הודעה — הקליינט (React) פותח חיבור סטרימינג (SSE) לשרת.',
  'ה-Dispatcher בשרת מזהה את ה-Crew הפעיל בשיחה, ומריץ את שרשרת ה-Addons (Cortex) שלו לפי הסדר.',
  'Addons קוראים ידע (Pinecone/KB) וזיכרון (שדות לפי domain), פונים לספק ה-LLM המתאים, ומעדכנים את הזיכרון.',
  'ה-Talker מזרים את התשובה חזרה למשתמש token-אחר-token, לצד שלבי החשיבה והמקורות שנצרכו.',
  'כל צעד נרשם (audit): קריאות LLM, טוקנים, זמנים, מעברים בין שלבים — למעקב ולניתוח.',
];

export function LybiArchitecturePage() {
  useEffect(() => {
    document.title = 'ארכיטקטורה | Lybi';
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    return () => { document.documentElement.style.overflow = ''; document.body.style.overflow = ''; };
  }, []);

  return (
    <div dir="rtl" style={{ fontFamily: "'DM Sans', sans-serif", background: BG, color: INK, minHeight: '100vh', overflow: 'auto' }}>
      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(250,247,247,0.95)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/lybi/knowledge" style={{ display: 'inline-block', textDecoration: 'none' }}>
            <img src="/img/lybi-logo-transparent.png" alt="Lybi" style={{ height: 32, width: 'auto' }} />
          </Link>
          <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: PURPLE, background: PURPLE_SOFT, padding: '4px 10px', borderRadius: 4 }}>
            Architecture
          </span>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '56px 24px 96px' }}>
        {/* Header */}
        <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: PURPLE, margin: '0 0 10px' }}>
          Lybi · ארכיטקטורת המערכת
        </p>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, fontWeight: 400, lineHeight: 1.15, color: INK, margin: '0 0 18px' }}>
          ארכיטקטורה
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.85, color: MUTED, margin: '0 0 8px', maxWidth: 680 }}>
          פלטפורמה דו-שירותית פשוטה להבנה: קליינט אחד, שרת אחד, ומסדי נתונים מנוהלים — כולם על Google Cloud.
          מעל התשתית פועל מנוע השיחה (Builder v2.0) שמרכיב כל סוכן משרשרת רכיבים (Addons).
        </p>

        {/* ── Section 1: System topology ── */}
        <section style={{ marginTop: 48 }}>
          <div style={{ borderBottom: `2px solid ${PURPLE}`, paddingBottom: 10, marginBottom: 28 }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 400, color: INK, margin: 0 }}>תרשים מערכת</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box title="לקוח (Client)" sub="React 19 + TypeScript · Firebase Hosting (CDN)" />
            <Down label="HTTPS · SSE (סטרימינג בזמן אמת)" />
            <Box title="שרת (Server)" sub="Node.js 22 + Express 5 · Google Cloud Run · europe-west1" accent />
            <Down />
            {/* Stores row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, width: '100%' }}>
              {STORES.map(s => (
                <div key={s.name} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 18px', textAlign: 'center' }}>
                  <div style={{ fontSize: 24 }}>{s.icon}</div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 6 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 3, lineHeight: 1.5 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 2: Conversation engine ── */}
        <section style={{ marginTop: 56 }}>
          <div style={{ borderBottom: `2px solid ${PURPLE}`, paddingBottom: 10, marginBottom: 12 }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 400, color: INK, margin: 0 }}>מנוע השיחה — Builder v2.0</h2>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: MUTED, margin: '0 0 24px', maxWidth: 680 }}>
            כל שיחה מטופלת ע״י <strong style={{ color: INK }}>Crew</strong> (שלב שיחה), שמריץ <strong style={{ color: INK }}>Cortex</strong> —
            שרשרת <strong style={{ color: INK }}>Addons</strong>. כל Addon הוא רכיב עצמאי עם מודל ופרומפט משלו, שרץ במסלול
            <span style={{ whiteSpace: 'nowrap' }}> main / background / offline</span>. התצורה נשמרת כ-JSON עם ניהול גרסאות.
          </p>

          {/* Cortex chain — LTR pipeline */}
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16, padding: '24px 20px' }}>
            <div dir="ltr" style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px', fontSize: 12.5, fontWeight: 600, color: MUTED }}>
                הודעה →
              </div>
              {CORTEX.map((c, i) => (
                <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    background: PURPLE_SOFT, border: `1px solid rgba(104,6,98,0.2)`, borderRadius: 12,
                    padding: '12px 14px', textAlign: 'center', minWidth: 116,
                  }}>
                    <div style={{ fontSize: 20 }}>{c.icon}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: PURPLE, marginTop: 4 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{c.sub}</div>
                  </div>
                  {i < CORTEX.length - 1 && <span style={{ fontSize: 16, color: '#D6D3D1' }}>→</span>}
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px', fontSize: 12.5, fontWeight: 600, color: MUTED }}>
                → תשובה
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 20, paddingTop: 18, borderTop: `1px solid ${BORDER}` }}>
              {['זיכרון = שדות מקובצים ל-domains', 'עוזר בנייה — Alfred', 'ניהול גרסאות ל-Crew ולסוכן', 'Repository לשיתוף Addons'].map(t => (
                <span key={t} style={{ fontSize: 12, color: MUTED, background: BG, border: `1px solid ${BORDER}`, borderRadius: 999, padding: '5px 12px' }}>{t}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 3: Request lifecycle ── */}
        <section style={{ marginTop: 56 }}>
          <div style={{ borderBottom: `2px solid ${PURPLE}`, paddingBottom: 10, marginBottom: 24 }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 400, color: INK, margin: 0 }}>זרימת בקשה</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FLOW.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 18px' }}>
                <span style={{
                  flexShrink: 0, width: 26, height: 26, borderRadius: '50%',
                  background: PURPLE, color: '#fff', fontSize: 13, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{i + 1}</span>
                <span style={{ fontSize: 14, lineHeight: 1.7, color: '#44403C' }}>{step}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 4: Infra & security quick facts ── */}
        <section style={{ marginTop: 56 }}>
          <div style={{ borderBottom: `2px solid ${PURPLE}`, paddingBottom: 10, marginBottom: 24 }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 400, color: INK, margin: 0 }}>תשתית ואבטחה</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {[
              { t: 'הצפנה', d: 'בתעבורה (TLS/HTTPS) ובמנוחה (AES-256) כברירת מחדל; אפשרות ל-CMEK.' },
              { t: 'אזור', d: 'europe-west1 כיום; ניתן לפרוס באזור הישראלי (me-west1) לריבונות נתונים.' },
              { t: 'שרידות', d: 'Cloud Run אוטו-סקיילינג, גיבויים ו-PITR, fallback בין שלושה ספקי LLM.' },
              { t: 'תשתית מוסמכת', d: 'GCP: ISO 27001/27017/27018, SOC 1/2/3, PCI DSS, תאימות-HIPAA.' },
            ].map(f => (
              <div key={f.t} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderInlineStart: `4px solid ${PURPLE}`, borderRadius: 10, padding: '14px 18px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{f.t}</div>
                <div style={{ fontSize: 12.5, color: MUTED, marginTop: 5, lineHeight: 1.6 }}>{f.d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Back link */}
        <div style={{ marginTop: 48, paddingTop: 20, borderTop: `1px solid ${BORDER}` }}>
          <Link to="/lybi/readiness" style={{ fontSize: 13, fontWeight: 600, color: PURPLE, textDecoration: 'none' }}>
            → חזרה למענה שאלון בדיקת הנאותות
          </Link>
        </div>
      </div>
    </div>
  );
}
