/**
 * Chrome for Aspect Intelligence: brand header, Home/Insights/Data Chat nav,
 * breadcrumb + sync info row, light/dark toggle. A standalone product from
 * Aspect BI (BIShell) — "Data Chat" navigates out to the existing chat page
 * rather than being reimplemented here.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InsightsList } from './Insights/InsightsList';
import { InsightDetail } from './Insights/InsightDetail';
import { ChatWidget } from './ChatWidget';
import { ensureIntelligenceFontsLoaded } from './fonts';
import { JobsProvider, useJobs, type Job } from './jobs/JobsContext';
import { JobBadges } from './jobs/JobBadges';
import { JobSidebar } from './jobs/JobSidebar';
import { hypertoyConfig } from '../../agents';
import styles from './IntelligenceShell.module.css';

type Mode = 'light' | 'dark';

const MODE_KEY = 'aspect_intelligence_mode';

interface Props {
  datasetId: string;
  title: string;
  /** Insight id from the URL (/intelligence/:datasetId/insight/:insightId) — undefined means the list view. */
  insightId?: string;
  /** True on /intelligence/:datasetId/chat — the chat widget's open/expanded state and the nav's active item both follow this. */
  chatRoute: boolean;
}

export function IntelligenceShell(props: Props) {
  return (
    <JobsProvider>
      <IntelligenceShellInner {...props} />
    </JobsProvider>
  );
}

function IntelligenceShellInner({ datasetId, title, insightId, chatRoute }: Props) {
  const navigate = useNavigate();
  const { selectedJobId, cancelJob } = useJobs();
  // The insight open/closed state is the URL (insightId prop, driven by the
  // route) — a real per-insight URL that can be linked/bookmarked/shared,
  // not just internal component state. The breadcrumb needs the insight's
  // display name, which isn't known until InsightDetail fetches it, so it's
  // reported back up via onLoaded.
  const [insightBreadcrumb, setInsightBreadcrumb] = useState<string | null>(null);
  useEffect(() => { setInsightBreadcrumb(null); }, [insightId]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [chatEverOpened, setChatEverOpened] = useState(false);
  const [pendingChatQuestion, setPendingChatQuestion] = useState<string | null>(null);
  // The chat widget's open/expanded state follows the URL, not just its own
  // buttons — landing on /intelligence/:datasetId/chat directly (a shared
  // link, a page refresh) must open it expanded, same as clicking "Data Chat".
  useEffect(() => {
    if (chatRoute) {
      setChatOpen(true);
      setChatEverOpened(true);
      setChatExpanded(true);
    }
  }, [chatRoute]);
  // Real data-freshness info, not a hardcoded placeholder string — same
  // /api/admin/data-loader/:schema/data-info endpoint DataStatusBar already
  // uses on the real /hypertoy chat page, so this always agrees with what
  // that page shows instead of drifting into a stale guess (caught by Kosta
  // comparing this header directly against the real chat's own bar).
  const [syncInfo, setSyncInfo] = useState<{ lastSync: string; dataFrom: string | null; dataThrough: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${hypertoyConfig.baseURL}/api/admin/data-loader/${datasetId}/data-info`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
        const fmtDate = (value: string) => {
          const [y, mo, d] = value.split('-').map(Number);
          return new Date(y, mo - 1, d || 1).toLocaleString('en-GB', { day: d ? '2-digit' : undefined, month: 'short', year: 'numeric' });
        };
        setSyncInfo({
          lastSync: data.lastRun?.completed_at ? fmtDateTime(data.lastRun.completed_at) : 'n/a',
          // Same 3 fields as the real chat's own DataStatusBar — "Data from"
          // was being fetched already but silently dropped, so this header
          // showed 2 of the 3 fields the real chat shows for the same data.
          dataFrom: data.firstDataDate ? fmtDate(data.firstDataDate) : null,
          dataThrough: data.lastDataDate ? fmtDate(data.lastDataDate) : 'n/a',
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [datasetId]);

  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem(MODE_KEY) as Mode) || 'light');
  // Measured so the expanded chat widget can sit flush "under the header"
  // (mockup 2c) instead of overlapping it — recalculated on resize since the
  // header wraps to a taller layout below 900px (see @media rule in the CSS).
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setHeaderHeight(entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Shares the chat's own storage key (`${agentSlug}_language`, see
  // hypertoyConfig.storagePrefix) so this toggle and the embedded chat widget
  // (and the full /hypertoy page) always agree on the current language.
  // Defaults to English here (unlike the chat's own default of Hebrew) since
  // Aspect Intelligence itself is English-only UI — an English default keeps
  // the embedded chat consistent with it for first-time visitors.
  const langKey = `${datasetId}_language`;
  const [lang, setLang] = useState<'en' | 'he'>(() => (localStorage.getItem(langKey) === 'he' ? 'he' : 'en'));

  useEffect(() => {
    if (!localStorage.getItem(langKey)) localStorage.setItem(langKey, 'en');
  }, [langKey]);

  useEffect(() => { ensureIntelligenceFontsLoaded(); }, []);
  useEffect(() => { localStorage.setItem(MODE_KEY, mode); }, [mode]);

  const openInsight = (id: string) => navigate(`/intelligence/${datasetId}/insight/${id}`);
  // "Insights" (nav, breadcrumb, and the detail page's own back link all
  // share this) always leaves the chat view entirely, closing the widget —
  // it doesn't just collapse it back to windowed, it hides it, so Insights
  // reads as a clean dedicated view, not "Insights with a chat still open
  // somewhere."
  const backToInsights = () => {
    setChatOpen(false);
    setChatExpanded(false);
    navigate(`/intelligence/${datasetId}`);
  };
  const reviewCompletedJob = (job: Job) => {
    const firstId = job.result?.insightIds[0];
    // Once you've actually gone and looked at it, it doesn't belong in the
    // header badges or the JobStrip anymore — both read from the same jobs
    // list, so removing it here clears it from both at once. The insight
    // itself isn't touched, only the job's "there's something to review" state.
    cancelJob(job.id);
    if (firstId) openInsight(firstId);
  };
  const toggleLang = () => {
    const next = lang === 'en' ? 'he' : 'en';
    setLang(next);
    localStorage.setItem(langKey, next);
  };
  // "Data Chat" nav opens the same popup widget in its expanded (full-window)
  // state instead of navigating to the separate, differently-styled /hypertoy
  // page — same reasoning as the widget's own expand button. Both routes
  // through the same URL (the useEffect above reacts to chatRoute), so nav
  // click and a direct link land in the same state.
  const openDataChat = () => navigate(`/intelligence/${datasetId}/chat`);

  // Controlled from here (not the widget's own state) so expanding it — via
  // its own expand button, not just the "Data Chat" nav — also updates the
  // URL and nav highlighting, and collapsing it goes back to Insights.
  const handleChatExpandedChange = (expanded: boolean) => {
    setChatExpanded(expanded);
    if (expanded) navigate(`/intelligence/${datasetId}/chat`);
    else if (chatRoute) navigate(`/intelligence/${datasetId}`);
  };

  // "Ask a follow-up in chat" on an insight detail page — opens the same
  // popup widget (expanded, matching "Data Chat") and immediately sends a
  // real question grounded in that insight, the same way a quick-question
  // tile sends one, rather than just prefilling text to be edited.
  const askFollowUp = (question: string) => {
    setChatOpen(true);
    setChatEverOpened(true);
    handleChatExpandedChange(true);
    setPendingChatQuestion(question);
  };
  return (
    <div className={styles.shell} data-mode={mode}>
      <header className={styles.header} ref={headerRef}>
        <div className={styles.headerRow}>
          <div className={styles.brand}>
            <span className={styles.mark}>HT</span>
            <div className={styles.brandText}>
              <div className={styles.brandName}>{title}</div>
              <div className={styles.brandSub}>AI-powered business intelligence</div>
            </div>
          </div>

          <nav className={styles.nav}>
            <button className={styles.navBtn} onClick={() => navigate('/intelligence')}>Home</button>
            <button className={`${styles.navBtn} ${!chatRoute ? styles.navActive : ''}`} onClick={backToInsights}>Insights</button>
            <button className={`${styles.navBtn} ${chatRoute ? styles.navActive : ''}`} onClick={openDataChat}>Data Chat</button>
          </nav>

          <div className={styles.headerRight}>
            <JobBadges datasetId={datasetId} onReviewCompleted={reviewCompletedJob} />
            <button className={styles.langBadge} onClick={toggleLang} title="Language used by the data chat">{lang.toUpperCase()}</button>
            <button className={styles.iconBtn} onClick={() => setMode(m => m === 'dark' ? 'light' : 'dark')} title="Toggle theme" aria-label="Toggle theme">
              <Glyph name={mode === 'dark' ? 'sun' : 'moon'} />
            </button>
            <div className={styles.onlineDot}><span className={styles.dot} />Online</div>
            <div className={styles.avatar}>DA</div>
          </div>
        </div>

        <div className={styles.breadcrumbRow}>
          <span className={styles.crumb} onClick={() => navigate('/intelligence')} style={{ cursor: 'pointer' }}>Home</span>
          <span className={styles.crumbSep}>/</span>
          {chatRoute ? (
            <span className={`${styles.crumb} ${styles.crumbActive}`}>Data Chat</span>
          ) : (
            <>
              <span className={`${styles.crumb} ${!insightId ? styles.crumbActive : ''}`} onClick={backToInsights} style={{ cursor: 'pointer' }}>Insights</span>
              {insightId && (
                <>
                  <span className={styles.crumbSep}>/</span>
                  <span className={`${styles.crumb} ${styles.crumbActive}`}>{insightBreadcrumb || '…'}</span>
                </>
              )}
            </>
          )}
          {syncInfo && (
            <span className={styles.syncInfo}>
              Last sync: <b>{syncInfo.lastSync}</b>
              {syncInfo.dataFrom && <> · Data from: <b>{syncInfo.dataFrom}</b></>}
              {' '}· Data through: <b>{syncInfo.dataThrough}</b>
            </span>
          )}
        </div>
      </header>

      <main className={styles.body}>
        {!chatRoute && (insightId
          ? <InsightDetail datasetId={datasetId} insightId={insightId} onBack={backToInsights} onLoaded={i => setInsightBreadcrumb(i.breadcrumbLabel)} onAskFollowUp={askFollowUp} />
          : <InsightsList datasetId={datasetId} onOpenInsight={openInsight} onAskInChat={askFollowUp} />)}
      </main>

      {selectedJobId && <JobSidebar datasetId={datasetId} onReview={reviewCompletedJob} />}

      {chatEverOpened && (
        <ChatWidget
          datasetId={datasetId}
          open={chatOpen}
          expanded={chatExpanded}
          onExpandedChange={handleChatExpandedChange}
          onClose={() => setChatOpen(false)}
          headerHeight={headerHeight}
          pendingQuestion={pendingChatQuestion}
          onPendingQuestionConsumed={() => setPendingChatQuestion(null)}
        />
      )}

      {!chatOpen && (
        <div className={styles.launcherWrap}>
          <div className={styles.teaser}>Ask me anything about your data <span>— ⌘K</span></div>
          <button className={styles.orb} onClick={() => { setChatOpen(true); setChatEverOpened(true); }} aria-label="Open chat">✦</button>
        </div>
      )}
    </div>
  );
}

function Glyph({ name }: { name: 'sun' | 'moon' }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return name === 'sun'
    ? <svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
    : <svg {...common}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>;
}
