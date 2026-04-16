import { useEffect } from 'react';
import { Link } from 'react-router-dom';

const PAGES = [
  { path: '/lybi/llm-guide', icon: '🧠', title: 'How AI Actually Works', desc: 'What is an LLM, why it doesn\'t "follow" instructions, and what to expect', slides: 14 },
  { path: '/lybi/kb-vs-triggered', icon: '📁', title: 'KB vs Triggered Context', desc: 'When to use Knowledge Base and when to use Triggered Context', slides: 3 },
  { path: '/lybi/how-we-build', icon: '🔧', title: 'How We Build Agents', desc: 'Crews, chain steps, personas, and how it all fits together', slides: 9 },
  { path: '/lybi/chain', icon: '⛓️', title: 'Chain Architecture', desc: 'The full message pipeline — every step, timing, and where issues happen' },
  { path: '/lybi/crew-builder', icon: '🛠️', title: 'Agent Builder', desc: 'Interactive mockup — chain, fields, memory, triggered context' },
  { path: '/lybi/infrastructure', icon: '☁️', title: 'Infrastructure', desc: 'Cloud, database, LLM providers, DevOps, AI-powered development' },
  { path: '/lybi/about/shlomi', icon: '👤', title: 'About Shlomi Zevin', desc: 'CTO — 20+ years in tech, AI agents, startup speed' },
];

export function LybiKnowledgePage() {
  useEffect(() => {
    document.title = 'Knowledge Base | Lybi';
  }, []);

  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif",
      background: '#FAF7F7',
      color: '#1C1917',
      minHeight: '100vh',
      overflow: 'auto',
    }}>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(250,247,247,0.95)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/lybi" style={{ display: 'inline-block', textDecoration: 'none' }}>
            <img src="/img/lybi-logo-transparent.png" alt="Lybi" style={{ height: 32, width: 'auto' }} />
          </Link>
          <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#680662', background: 'rgba(104,6,98,0.06)', padding: '4px 10px', borderRadius: 4 }}>Knowledge</span>
        </div>
      </nav>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 24px 80px' }}>
        <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#680662', margin: '0 0 8px' }}>Lybi Knowledge Base</p>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 42, fontWeight: 400, lineHeight: 1.15, color: '#1C1917', margin: '0 0 32px' }}>
          Learn how we build AI agents
        </h1>

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
              {'slides' in p && p.slides && <span style={{ fontSize: 11, color: '#a8a29e', flexShrink: 0 }}>{p.slides} slides</span>}
              <span style={{ color: '#D6D3D1', fontSize: 16, flexShrink: 0 }}>→</span>
            </Link>
          ))}
        </div>

        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #E7E5E4', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontSize: 11, color: '#a8a29e', margin: 0 }}>Direct links</p>
          {PAGES.map(p => (
            <div key={p.path} style={{ fontSize: 12, color: '#78716C' }}>
              <span>{p.icon} </span>
              <Link to={p.path} style={{ color: '#680662', textDecoration: 'none' }}>lybi.ai{p.path}</Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
