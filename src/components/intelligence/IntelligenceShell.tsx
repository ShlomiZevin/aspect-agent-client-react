/**
 * Chrome for Aspect Intelligence: brand header, Home/My Reports/Data Chat
 * nav, breadcrumb + sync info row, light/dark toggle. A standalone product
 * from Aspect BI (BIShell) — "Data Chat" navigates out to the existing chat
 * page rather than being reimplemented here.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LanguageProvider, useLanguage } from '../../context/LanguageContext';
import { UserProvider, useUserContext } from '../../context/UserContext';
import { HomePage } from './Home/HomePage';
import { ReportsPage } from './Reports/ReportsPage';
import { ReportHistoryPage } from './Reports/ReportHistoryPage';
import { InsightDetail } from './Insights/InsightDetail';
import { ChatWidget } from './ChatWidget';
import { DataHealthTrigger } from '../chat/DataHealthModal';
import { FeedbackTrigger } from '../chat/GeneralFeedbackModal';
import { ensureIntelligenceFontsLoaded } from './fonts';
import { JobsProvider, useJobs, type Job } from './jobs/JobsContext';
import { JobBadges } from './jobs/JobBadges';
import { JobSidebar } from './jobs/JobSidebar';
import { insightsService } from '../../services/insightsService';
import { getAgentConfig } from '../../agents/agentRegistry';
import { formatDateTime, formatDateOnly } from './dateFormat';
import styles from './IntelligenceShell.module.css';

type Mode = 'light' | 'dark';

const MODE_KEY = 'aspect_intelligence_mode';

interface Props {
  datasetId: string;
  /** Insight id from the URL (/intelligence/:datasetId/insight/:insightId) — undefined means Home/Reports/History. */
  insightId?: string;
  /** True on /intelligence/:datasetId/chat — the chat widget's open/expanded state and the nav's active item both follow this. */
  chatRoute: boolean;
  /** True on /intelligence/:datasetId/reports — My Reports (design turn 11a). */
  reportsRoute: boolean;
  /** True on /intelligence/:datasetId/reports/history — Report history (design turn 12a). */
  historyRoute: boolean;
}

export function IntelligenceShell(props: Props) {
  // Same storage key (`${datasetId}_language`) the embedded chat widget's
  // own page already uses — the header's EN/HE toggle now drives both this
  // shell's UI chrome AND the chat, instead of only the chat (see the old
  // comment this replaced: Aspect Intelligence used to be deliberately
  // English-only; Shlomi asked for Hebrew as mandatory, see project memory).
  const agentConfig = getAgentConfig(props.datasetId);
  return (
    <LanguageProvider storagePrefix={`${props.datasetId}_`}>
      {/* Same storagePrefix the embedded chat widget's own UserProvider uses
          (AgentChatWidgetPage) — reports and chats end up sharing the exact
          same anonymous session/localStorage key, so "your reports" means
          the same "you" as "your chats", not a second, unrelated identity. */}
      <UserProvider storagePrefix={agentConfig?.storagePrefix} baseURL={agentConfig?.baseURL}>
        <JobsProvider>
          <IntelligenceShellInner {...props} />
        </JobsProvider>
      </UserProvider>
    </LanguageProvider>
  );
}

function IntelligenceShellInner({ datasetId, insightId, chatRoute, reportsRoute, historyRoute }: Props) {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const { userId } = useUserContext();
  // Dataset branding (name/logo mark) resolved from the API rather than a
  // hardcoded prop, so this shell works for any enabled dataset, not just
  // whichever one it was originally built against.
  const [meta, setMeta] = useState<{ name: string; logoText: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    insightsService.listDatasets()
      .then(datasets => {
        if (cancelled) return;
        const found = datasets.find(d => d.id === datasetId);
        setMeta(found ? { name: found.name, logoText: found.logoText } : null);
      })
      .catch(() => { if (!cancelled) setMeta(null); });
    return () => { cancelled = true; };
  }, [datasetId]);
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
  // uses on the dataset's own real chat page, so this always agrees with
  // what that page shows instead of drifting into a stale guess (caught by
  // Kosta comparing this header directly against the real chat's own bar).
  // Every dataset's own agent config points at the same backend, so its
  // baseURL is used here rather than one specific dataset's config.
  const datasetAgent = getAgentConfig(datasetId);
  const baseURL = datasetAgent?.baseURL;
  const [syncInfo, setSyncInfo] = useState<{ lastSync: string; dataFrom: string | null; dataThrough: string } | null>(null);
  useEffect(() => {
    if (!baseURL) return;
    let cancelled = false;
    fetch(`${baseURL}/api/admin/data-loader/${datasetId}/data-info`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        setSyncInfo({
          lastSync: data.lastRun?.completed_at ? formatDateTime(data.lastRun.completed_at, language) : 'n/a',
          // Same 3 fields as the real chat's own DataStatusBar — "Data from"
          // was being fetched already but silently dropped, so this header
          // showed 2 of the 3 fields the real chat shows for the same data.
          dataFrom: data.firstDataDate ? formatDateOnly(data.firstDataDate, language) : null,
          dataThrough: data.lastDataDate ? formatDateOnly(data.lastDataDate, language) : 'n/a',
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [datasetId, baseURL, language]);

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
  useEffect(() => { ensureIntelligenceFontsLoaded(); }, []);
  useEffect(() => { localStorage.setItem(MODE_KEY, mode); }, [mode]);

  const openInsight = (id: string) => navigate(`/intelligence/${datasetId}/insight/${id}`);
  // Home/My Reports/History/the detail page's own back link all close the
  // chat widget entirely rather than just collapsing it back to windowed —
  // navigating away from chat should read as a clean dedicated view, not
  // "Reports with a chat still open somewhere."
  const closeChatAnd = (fn: () => void) => {
    setChatOpen(false);
    setChatExpanded(false);
    fn();
  };
  const goHome = () => closeChatAnd(() => navigate(`/intelligence/${datasetId}`));
  const goReports = () => closeChatAnd(() => navigate(`/intelligence/${datasetId}/reports`));
  const goHistory = () => closeChatAnd(() => navigate(`/intelligence/${datasetId}/reports/history`));
  const reviewCompletedJob = (job: Job) => {
    const firstId = job.result?.insightIds[0];
    // Once you've actually gone and looked at it, it doesn't belong in the
    // header badges or the JobStrip anymore — both read from the same jobs
    // list, so removing it here clears it from both at once. The insight
    // itself isn't touched, only the job's "there's something to review" state.
    cancelJob(job.id);
    if (firstId) openInsight(firstId);
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
  const view: 'home' | 'reports' | 'history' | 'detail' | 'chat' =
    chatRoute ? 'chat' : insightId ? 'detail' : historyRoute ? 'history' : reportsRoute ? 'reports' : 'home';

  return (
    <div className={styles.shell} data-mode={mode} data-brand={datasetId}>
      <header className={styles.header} ref={headerRef}>
        <div className={styles.headerRow}>
          <div className={styles.brand}>
            <span className={styles.mark}>{meta?.logoText || '··'}</span>
            <div className={styles.brandText}>
              <div className={styles.brandName}>{meta?.name || '…'}</div>
              <div className={styles.brandSub}>AI-powered business intelligence</div>
            </div>
          </div>

          <nav className={styles.nav}>
            <button className={`${styles.navBtn} ${view === 'home' ? styles.navActive : ''}`} onClick={goHome}>{t('intel.nav.home')}</button>
            <button className={`${styles.navBtn} ${(view === 'reports' || view === 'history' || view === 'detail') ? styles.navActive : ''}`} onClick={goReports}>{t('intel.nav.reports')}</button>
            <button className={`${styles.navBtn} ${view === 'chat' ? styles.navActive : ''}`} onClick={openDataChat}>{t('intel.nav.chat')}</button>
          </nav>

          <div className={styles.headerRight}>
            <JobBadges datasetId={datasetId} onReviewCompleted={reviewCompletedJob} />
            <div className={styles.langGroup} role="group" aria-label="Language">
              <button className={`${styles.langOption} ${language === 'en' ? styles.langOptionActive : ''}`} onClick={() => setLanguage('en')} aria-pressed={language === 'en'}>EN</button>
              <button className={`${styles.langOption} ${language === 'he' ? styles.langOptionActive : ''}`} onClick={() => setLanguage('he')} aria-pressed={language === 'he'}>עב</button>
            </div>
            <button className={styles.iconBtn} onClick={() => setMode(m => m === 'dark' ? 'light' : 'dark')} title="Toggle theme" aria-label="Toggle theme">
              <Glyph name={mode === 'dark' ? 'sun' : 'moon'} />
            </button>
            {datasetAgent && <FeedbackTrigger agentName={datasetAgent.agentName} baseURL={datasetAgent.baseURL} variant="icon" className={styles.iconBtn} />}
            <div className={styles.onlineDot}><span className={styles.dot} />{t('intel.online')}</div>
          </div>
        </div>

        <div className={styles.breadcrumbRow}>
          <span className={`${styles.crumb} ${view === 'home' ? styles.crumbActive : ''}`} onClick={goHome} style={{ cursor: 'pointer' }}>{t('intel.nav.home')}</span>
          {view === 'chat' && (
            <>
              <span className={styles.crumbSep}>/</span>
              <span className={`${styles.crumb} ${styles.crumbActive}`}>{t('intel.nav.chat')}</span>
            </>
          )}
          {(view === 'reports' || view === 'history' || view === 'detail') && (
            <>
              <span className={styles.crumbSep}>/</span>
              <span className={`${styles.crumb} ${view === 'reports' ? styles.crumbActive : ''}`} onClick={goReports} style={{ cursor: 'pointer' }}>{t('intel.nav.reports')}</span>
            </>
          )}
          {view === 'history' && (
            <>
              <span className={styles.crumbSep}>/</span>
              <span className={`${styles.crumb} ${styles.crumbActive}`}>{t('intel.nav.history')}</span>
            </>
          )}
          {view === 'detail' && (
            <>
              <span className={styles.crumbSep}>/</span>
              <span className={`${styles.crumb} ${styles.crumbActive}`}>{insightBreadcrumb || '…'}</span>
            </>
          )}
          {syncInfo && (
            // Formatted with the current UI locale (see formatDateTime/
            // formatDateOnly in dateFormat.ts) — real Hebrew month names and
            // word order under Hebrew, not English text force-isolated as an
            // LTR island, so no dir="ltr" override needed here.
            <span className={styles.syncInfo}>
              {/* Last sync only. The date range moved into the data panel
                  behind the icon — three values inline crowded the breadcrumb
                  and repeated what one click already shows. */}
              {t('intel.lastSync')}: <b>{syncInfo.lastSync}</b>
            </span>
          )}
          {/* Deliberately OUTSIDE the syncInfo guard. The label above only
              renders once /data-info returns, so tying the icon to it hid the
              data panel in exactly the situation someone would open it — when
              freshness information is missing. The panel reports the failure
              itself instead. */}
          {baseURL && <DataHealthTrigger baseURL={baseURL} schema={datasetId} />}
        </div>
      </header>

      <main className={styles.body}>
        {view === 'detail' && insightId && (
          <InsightDetail datasetId={datasetId} userId={userId} insightId={insightId} onBack={goReports} onLoaded={i => setInsightBreadcrumb(i.breadcrumbLabel)} onAskFollowUp={askFollowUp} />
        )}
        {view === 'history' && <ReportHistoryPage datasetId={datasetId} userId={userId} onOpenInsight={openInsight} />}
        {view === 'reports' && <ReportsPage datasetId={datasetId} userId={userId} onOpenInsight={openInsight} onOpenHistory={goHistory} />}
        {view === 'home' && <HomePage datasetId={datasetId} userId={userId} onOpenInsight={openInsight} onAskInChat={askFollowUp} onSeeAllReports={goReports} onOpenHistory={goHistory} />}
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
          {/* The ⌘K badge is gone. It was never wired to anything — there is no
              key handler for it anywhere in the client — so it advertised a
              shortcut that did nothing, and the glyph read as noise on the
              Hebrew side. Removed rather than implemented: the launcher is one
              click away and already labelled. */}
          <div className={styles.teaser}>{t('intel.launcher.teaser')}</div>
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
