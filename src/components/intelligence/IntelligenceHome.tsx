/**
 * Aspect Intelligence landing page (`/intelligence`) — a dataset picker, in
 * the same spirit as the Aspect Data Agents hub (`/aspect/agents`) but for
 * Intelligence specifically. Fully generic: the card grid is built from
 * GET /api/insights, which auto-discovers whatever datasets are registered
 * server-side (see insights/routes/insights.routes.js) — adding a new
 * client's seed module is the only step needed for a new card to appear here.
 *
 * Styled to match IntelligenceShell's header/typography/card language exactly
 * (same CSS variables, same brand-row pattern) rather than as a standalone
 * mini-page — this is the top of the same product, not a different one.
 * Nav only shows "Home" (active): Insights/Data Chat/Dashboards all require
 * a selected dataset, which doesn't exist yet at this level.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { IntelligenceDatasetMeta } from '../../types/insights';
import { insightsService } from '../../services/insightsService';
import { ensureIntelligenceFontsLoaded } from './fonts';
import styles from './IntelligenceHome.module.css';

const MODE_KEY = 'aspect_intelligence_mode';

export function IntelligenceHome() {
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState<IntelligenceDatasetMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'light' | 'dark'>(() => (localStorage.getItem(MODE_KEY) as 'light' | 'dark') || 'light');

  useEffect(() => { ensureIntelligenceFontsLoaded(); }, []);
  useEffect(() => { localStorage.setItem(MODE_KEY, mode); }, [mode]);

  useEffect(() => {
    insightsService.listDatasets()
      .then(setDatasets)
      .catch(err => setError(err.message));
  }, []);

  return (
    <div className={styles.shell} data-mode={mode}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div className={styles.brand}>
            <span className={styles.mark}>✦</span>
            <div className={styles.brandText}>
              <div className={styles.brandName}>Aspect Intelligence</div>
              <div className={styles.brandSub}>AI-powered business intelligence</div>
            </div>
          </div>

          <nav className={styles.nav}>
            <span className={`${styles.navBtn} ${styles.navActive}`}>Home</span>
          </nav>

          <div className={styles.headerRight}>
            <button className={styles.iconBtn} onClick={() => setMode(m => m === 'dark' ? 'light' : 'dark')} title="Toggle theme" aria-label="Toggle theme">
              {mode === 'dark' ? <SunGlyph /> : <MoonGlyph />}
            </button>
          </div>
        </div>
      </header>

      <main className={styles.body}>
        <div className={styles.hero}>
          <span className={styles.heroMark}>✦</span>
          <div className={styles.title}>What should Aspect investigate for you?</div>
          <div className={styles.subtitle}>Choose a data source to see its proactive findings, tracked metrics, and data chat.</div>
        </div>

        {!datasets && !error && <div className={styles.state}>Loading…</div>}
        {error && <div className={styles.state}>⚠ {error}</div>}

        {datasets && (
          <div className={styles.grid}>
            {datasets.map(d => (
              <button key={d.id} className={styles.card} onClick={() => navigate(`/intelligence/${d.id}`)}>
                <span className={styles.cardTop} style={{ background: `linear-gradient(135deg, ${d.gradientFrom}, ${d.gradientTo})` }} />
                <span className={styles.cardBody}>
                  <span className={styles.cardMark} style={{ background: `linear-gradient(135deg, ${d.gradientFrom}, ${d.gradientTo})` }}>
                    {d.logoText}
                  </span>
                  <span className={styles.cardName}>{d.name} Intelligence</span>
                  <span className={styles.cardDesc}>{d.description}</span>
                </span>
                <span className={styles.cardFooter}>
                  Open <span className={styles.arrow}>→</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function SunGlyph() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
}
function MoonGlyph() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>;
}
