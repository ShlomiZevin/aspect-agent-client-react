import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import styles from './LLMGuidePage.module.css';

const TOTAL_SLIDES = 3;

export function KBvsTriggeredPage() {
  const [current, setCurrent] = useState(0);
  const goTo = useCallback((i: number) => { if (i >= 0 && i < TOTAL_SLIDES) setCurrent(i); }, []);
  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  useEffect(() => { document.title = 'KB vs Triggered Context | Lybi'; }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); prev(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [next, prev]);

  return (
    <div className={styles.container}>
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <div className={styles.navLeft}>
            <Link to="/lybi" className={styles.navLogo}>
              <img src="/img/lybi-logo-transparent.png" alt="Lybi" />
            </Link>
            <span className={styles.navBadge}>Knowledge</span>
          </div>
          <span className={styles.navCounter}>{current + 1} / {TOTAL_SLIDES}</span>
        </div>
      </nav>

      <div className={styles.slideTrack} style={{ transform: `translateX(-${current * 100}vw)` }}>

        {/* SLIDE 1 — Side by side */}
        <div className={`${styles.slide} ${styles.bgPrimary}`}>
          <div className={styles.slideInnerWide}>
            <p className={styles.eyebrow}>Two tools, two jobs</p>
            <h1 className={styles.h1}>KB vs Triggered Context</h1>

            <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap', margin: '28px 0' }}>
              <div style={{ width: 320, background: '#f0fdf4', border: '2px solid #bbf7d0', borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>📁</div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: '#166534', margin: '0 0 10px' }}>Knowledge Base</h3>
                <div style={{ fontSize: 13, color: '#57534E', lineHeight: 1.7 }}>
                  <div>💬 "What are the fees?"</div>
                  <div style={{ color: '#a8a29e', fontSize: 11, margin: '4px 0' }}>↓ searches "fees" → finds fees doc</div>
                  <div>✅ "The monthly fee is 29 NIS"</div>
                </div>
                <div style={{ marginTop: 14, padding: '6px 10px', background: '#dcfce7', borderRadius: 6, fontSize: 11, color: '#166534', fontWeight: 500 }}>
                  Question words → lead to the right document
                </div>
              </div>

              <div style={{ width: 320, background: '#fef2f2', border: '2px solid #fecaca', borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>📁</div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: '#991b1b', margin: '0 0 10px' }}>KB for behavior? Doesn't work</h3>
                <div style={{ fontSize: 13, color: '#57534E', lineHeight: 1.7 }}>
                  <div>😤 "This is ridiculous! 3 days!"</div>
                  <div style={{ color: '#a8a29e', fontSize: 11, margin: '4px 0' }}>↓ searches "ridiculous"? "3 days"? → ???</div>
                  <div>❌ Can't find your "angry customer guide"</div>
                </div>
                <div style={{ marginTop: 14, padding: '6px 10px', background: '#fee2e2', borderRadius: 6, fontSize: 11, color: '#991b1b', fontWeight: 500 }}>
                  Zero connection between words said and your guide
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SLIDE 2 — The solution */}
        <div className={`${styles.slide} ${styles.bgSecondary}`}>
          <div className={styles.slideInner}>
            <p className={styles.eyebrow}>The solution</p>
            <h2 className={styles.h2}>Triggered Context — no search needed</h2>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap', margin: '24px 0' }}>
              <div style={{ padding: '10px 16px', background: '#fce7f3', border: '1px solid #fbcfe8', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>😤 Detected: angry</div>
              <span style={{ color: '#D6D3D1', fontSize: 18 }}>→</span>
              <div style={{ padding: '10px 16px', background: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>⚡ Code injects guide</div>
              <span style={{ color: '#D6D3D1', fontSize: 18 }}>→</span>
              <div style={{ padding: '10px 16px', background: '#f3e8ff', border: '1px solid #e9d5ff', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>💬 Agent follows guide</div>
            </div>

            <div style={{ maxWidth: 400, margin: '0 auto', background: '#ffffff', border: '1px solid #E7E5E4', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '8px 14px', background: '#f0fdf4', borderBottom: '1px solid #E7E5E4', fontSize: 11, fontWeight: 600, color: '#166534' }}>
                ⚡ Injected (code, 100% accurate):
              </div>
              <div style={{ padding: 14, fontSize: 12, color: '#57534E', lineHeight: 1.6, fontFamily: 'monospace', whiteSpace: 'pre-line' }}>
{`## Angry Customer
Never be defensive.
1. Acknowledge
2. Validate
3. Solve or escalate`}
              </div>
            </div>
          </div>
        </div>

        {/* SLIDE 3 — When to use what */}
        <div className={`${styles.slide} ${styles.bgPrimary}`}>
          <div className={styles.slideInner}>
            <p className={styles.eyebrow}>Simple rule</p>
            <h2 className={styles.h2}>When to use what</h2>

            <div style={{ maxWidth: 520, margin: '20px auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10 }}>
                <span style={{ fontSize: 22 }}>📁</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#166534' }}>KB</div>
                  <div style={{ fontSize: 13, color: '#57534E' }}>Customer <strong>asks a question</strong> → answer is in a document</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'rgba(104,6,98,0.04)', border: '1px solid rgba(104,6,98,0.12)', borderRadius: 10 }}>
                <span style={{ fontSize: 22 }}>🎯</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#680662' }}>Triggered Context</div>
                  <div style={{ fontSize: 13, color: '#57534E' }}>You want the agent to <strong>behave differently</strong> based on who/what</div>
                </div>
              </div>
            </div>

            <div className={styles.callout}>
              <p className={styles.calloutText} style={{ textAlign: 'center' }}>
                If you wrote "when X happens, do Y" — that's <strong>always</strong> Triggered Context.
                <br />KB can't find it because the customer's words have nothing to do with X.
              </p>
            </div>
          </div>
        </div>

      </div>

      <div className={styles.controls}>
        <button className={styles.controlBtn} onClick={prev} disabled={current === 0}>←</button>
        <div className={styles.progressDots}>
          {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
            <button key={i} className={`${styles.dot} ${i === current ? styles.dotActive : ''}`} onClick={() => goTo(i)} />
          ))}
        </div>
        <button className={styles.controlBtn} onClick={next} disabled={current === TOTAL_SLIDES - 1}>→</button>
      </div>
      <div className={styles.keyHint}>Use ← → arrow keys</div>
    </div>
  );
}
