import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './LLMGuidePage.module.css';

const PAGES = [
  { path: '/lybi/llm-guide', icon: '🧠', title: 'How AI Actually Works', desc: 'What is an LLM, why it doesn\'t "follow" instructions, and what to expect', slides: 14 },
  { path: '/lybi/kb-vs-triggered', icon: '📁', title: 'KB vs Triggered Context', desc: 'When to use Knowledge Base and when to use Triggered Context', slides: 3 },
  { path: '/lybi/how-we-build', icon: '🔧', title: 'How We Build Agents', desc: 'Crews, chain steps, personas, and how it all fits together', slides: 9 },
  { path: '/lybi/chain', icon: '⛓️', title: 'Chain Architecture', desc: 'The full message pipeline — every step, timing, and where issues happen', slides: null },
  { path: '/lybi/crew-builder', icon: '🛠️', title: 'Agent Builder', desc: 'Interactive mockup — chain, fields, memory, triggered context', slides: null },
];

export function LybiKnowledgePage() {
  useEffect(() => {
    document.title = 'Knowledge Base | Lybi';
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    return () => { document.documentElement.style.overflow = ''; document.body.style.overflow = ''; };
  }, []);

  return (
    <div className={styles.container} style={{ minHeight: '100vh' }}>
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <div className={styles.navLeft}>
            <Link to="/lybi" className={styles.navLogo}>
              <img src="/img/lybi-logo-transparent.png" alt="Lybi" />
            </Link>
            <span className={styles.navBadge}>Knowledge</span>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '80px 24px 60px' }}>
        <p className={styles.eyebrow}>Lybi Knowledge Base</p>
        <h1 className={styles.h1} style={{ marginBottom: 32 }}>Learn how we build AI agents</h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {PAGES.map(p => (
            <Link key={p.path} to={p.path} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '18px 22px', background: '#ffffff', border: '1px solid #E7E5E4',
              borderRadius: 12, textDecoration: 'none', color: 'inherit',
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#680662'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E7E5E4'; }}
            >
              <span style={{ fontSize: 28, flexShrink: 0 }}>{p.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1C1917' }}>{p.title}</div>
                <div style={{ fontSize: 13, color: '#78716C', marginTop: 2 }}>{p.desc}</div>
              </div>
              {p.slides && <span style={{ fontSize: 11, color: '#a8a29e', flexShrink: 0 }}>{p.slides} slides</span>}
              <span style={{ color: '#D6D3D1', fontSize: 16, flexShrink: 0 }}>→</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
