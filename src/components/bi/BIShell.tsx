/**
 * Chrome for the BI tool: brand header, Explore/Dashboards segmented nav,
 * theme toggle. Owns its own dark-first visual mode (independent of the agent
 * palette) and loads the dataset model once for whichever view is active.
 */
import { useEffect, useState } from 'react';
import type { DatasetModel } from '../../types/bi';
import { biService } from '../../services/biService';
import { Explorer } from './Explorer/Explorer';
import { DashboardList } from './Dashboards/DashboardList';
import { DashboardView } from './Dashboards/DashboardView';
import styles from './BIShell.module.css';

type Tab = 'explore' | 'dashboards';
type Mode = 'dark' | 'light';

const MODE_KEY = 'aspect_bi_mode';

interface Props {
  datasetId: string;
  title: string;
}

export function BIShell({ datasetId, title }: Props) {
  const [model, setModel] = useState<DatasetModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('explore');
  const [openDashboard, setOpenDashboard] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>(() =>
    (localStorage.getItem(MODE_KEY) as Mode) || 'dark');

  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    biService.getDataset(datasetId)
      .then(setModel)
      .catch(e => setError(e.message));
  }, [datasetId]);

  const goTab = (t: Tab) => { setTab(t); setOpenDashboard(null); };

  return (
    <div className={styles.shell} data-mode={mode}>
      <div className={styles.aurora} aria-hidden />

      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.mark}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
              <rect x="3"  y="13" width="4" height="8" rx="1.5" fill="currentColor" />
              <rect x="10" y="8"  width="4" height="13" rx="1.5" fill="currentColor" opacity="0.85" />
              <rect x="17" y="3"  width="4" height="18" rx="1.5" fill="currentColor" opacity="0.7" />
            </svg>
          </span>
          <div className={styles.brandText}>
            <h1 className={styles.title}>{title}</h1>
            <span className={styles.sub}>{model ? model.name : 'Analytics'}</span>
          </div>
        </div>

        <nav className={styles.tabs}>
          <span className={styles.tabGlider} data-tab={tab} aria-hidden />
          <button className={`${styles.tab} ${tab === 'explore' ? styles.tabActive : ''}`}
            onClick={() => goTab('explore')}>
            <Glyph name="explore" /> Explore
          </button>
          <button className={`${styles.tab} ${tab === 'dashboards' ? styles.tabActive : ''}`}
            onClick={() => goTab('dashboards')}>
            <Glyph name="grid" /> Dashboards
          </button>
        </nav>

        <button className={styles.themeBtn} onClick={() => setMode(m => m === 'dark' ? 'light' : 'dark')}
          title="Toggle theme" aria-label="Toggle theme">
          {mode === 'dark' ? <Glyph name="sun" /> : <Glyph name="moon" />}
        </button>
      </header>

      <main className={styles.body}>
        {error && <div className={styles.error}><span>⚠</span> {error}</div>}
        {!error && !model && (
          <div className={styles.loading}>
            <span className={styles.spinner} />
            <span>Loading dataset…</span>
          </div>
        )}
        {model && tab === 'explore' && <Explorer model={model} />}
        {model && tab === 'dashboards' && (
          openDashboard == null
            ? <DashboardList datasetId={datasetId} onOpen={setOpenDashboard} />
            : <DashboardView dashboardId={openDashboard} model={model} onBack={() => setOpenDashboard(null)} />
        )}
      </main>
    </div>
  );
}

// ── inline glyph set (stroke icons, inherit currentColor) ────────────
function Glyph({ name }: { name: 'explore' | 'grid' | 'sun' | 'moon' }) {
  const common = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'explore':
      return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>;
    case 'grid':
      return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
    case 'sun':
      return <svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
    case 'moon':
      return <svg {...common}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>;
  }
}
