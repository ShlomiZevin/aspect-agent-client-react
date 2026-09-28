/**
 * Chrome for Aspect Intelligence: brand header, Home/My Reports/Data Chat
 * nav, breadcrumb + sync info row, light/dark toggle. A standalone product
 * from Aspect BI (BIShell) — "Data Chat" navigates out to the existing chat
 * page rather than being reimplemented here.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LanguageProvider, useLanguage } from '../../context/LanguageContext';
import { UserProvider, useUserContext } from '../../context/UserContext';
import { HomePage } from './Home/HomePage';
import { ReportsPage } from './Reports/ReportsPage';
import { ReportHistoryPage } from './Reports/ReportHistoryPage';
import { InsightDetail } from './Insights/InsightDetail';
import { AppsPage } from './Apps/AppsPage';
import { ProcurementPage } from './Apps/ProcurementPage';
import { CustomScreenRouter } from './Apps/custom/CustomScreenRouter';
import { SettingsPage } from './Settings/SettingsPage';
import { appsService } from '../../services/appsService';
import { ChatWidget } from './ChatWidget';
import { MobileTabBar } from './MobileTabBar';
import type { ModuleScope } from '../../services/chatService';
import { DataHealthTrigger } from '../chat/DataHealthModal';
import { FeedbackTrigger } from '../chat/GeneralFeedbackModal';
import { ChatSignIn } from '../chat/ChatSignIn';
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
  /** True on /:datasetId/intelligence/center — the report center (the old Home), under the "Reports" tab. */
  centerRoute: boolean;
  /** True on /intelligence/:datasetId/reports — My Reports (design turn 11a). */
  reportsRoute: boolean;
  /** True on /intelligence/:datasetId/reports/history — Report history (design turn 12a). */
  historyRoute: boolean;
  /** True on /intelligence/:datasetId/apps — the Apps shelf. */
  appsRoute?: boolean;
  /** True on /intelligence/:datasetId/apps/:appId — one app's own page. */
  appId?: string;
  /** True on /intelligence/:datasetId/settings (task #69). */
  settingsRoute?: boolean;
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

function IntelligenceShellInner({ datasetId, insightId, centerRoute, reportsRoute, historyRoute, appsRoute, appId, settingsRoute }: Props) {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const { userId } = useUserContext();
  // Dataset branding (name/logo mark) resolved from the API rather than a
  // hardcoded prop, so this shell works for any enabled dataset, not just
  // whichever one it was originally built against.
  const [meta, setMeta] = useState<{ name: string; logoText: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    // `language` in the deps: the header name is localised server-side, so the
    // EN/HE toggle has to re-resolve it (הסופר החברתי ⇄ The Social Supermarket).
    insightsService.listDatasets(language)
      .then(datasets => {
        if (cancelled) return;
        const found = datasets.find(d => d.id === datasetId);
        setMeta(found ? { name: found.name, logoText: found.logoText } : null);
      })
      .catch(() => { if (!cancelled) setMeta(null); });
    return () => { cancelled = true; };
  }, [datasetId, language]);
  const { selectedJobId, cancelJob, jobs } = useJobs();
  const runningJobs = jobs.filter(j => j.status === 'running').length;
  // The insight open/closed state is the URL (insightId prop, driven by the
  // route) — a real per-insight URL that can be linked/bookmarked/shared,
  // not just internal component state. The breadcrumb needs the insight's
  // display name, which isn't known until InsightDetail fetches it, so it's
  // reported back up via onLoaded.
  const [insightBreadcrumb, setInsightBreadcrumb] = useState<string | null>(null);
  useEffect(() => { setInsightBreadcrumb(null); }, [insightId]);
  /**
   * Custom-app breadcrumb leaf, reported by the builder / published page.
   * KEYED by appId rather than reset in an effect: when the first message
   * swaps /apps/new -> /apps/<id>, the child's report and a parent reset
   * land in the same commit and the reset wins (child effects run first),
   * which blanked the crumb to the generic fallback. A stale report simply
   * fails the key match and the fallback shows until the new surface reports.
   */
  const [customCrumb, setCustomCrumb] = useState<{ appId: string; crumb: string } | null>(null);
  const reportCrumb = useCallback((crumb: string) => setCustomCrumb({ appId: appId ?? '', crumb }), [appId]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [chatEverOpened, setChatEverOpened] = useState(false);
  const [pendingChatQuestion, setPendingChatQuestion] = useState<string | null>(null);
  const [pendingChatScope, setPendingChatScope] = useState<ModuleScope | null>(null);
  // Real data-freshness info, not a hardcoded placeholder string — same
  // /api/admin/data-loader/:schema/data-info endpoint DataStatusBar already
  // uses on the dataset's own real chat page, so this always agrees with
  // what that page shows instead of drifting into a stale guess (caught by
  // Kosta comparing this header directly against the real chat's own bar).
  // Every dataset's own agent config points at the same backend, so its
  // baseURL is used here rather than one specific dataset's config.
  const datasetAgent = getAgentConfig(datasetId);
  const baseURL = datasetAgent?.baseURL;

  // Every agent already ships a `theme-<slug>` class (required for its own
  // chat page — see styles/themes/*.css) carrying --primary-color/-hover and
  // --gradient. Applying it to <html> here lets IntelligenceShell.module.css
  // derive this dataset's OWN brand colour generically (`var(--primary-color,
  // <purple fallback>)`) instead of needing a hand-written `[data-brand=X]`
  // override per client — hypertoy and tevanaot were both silently stuck on
  // the platform's default purple for exactly that reason before this. Safe
  // to do outside AgentProvider (unlike useAgentContext(), which throws here):
  // this only toggles a class, it reads no context.
  useEffect(() => {
    const cls = datasetAgent?.themeClass;
    if (!cls) return;
    document.documentElement.classList.add(cls);
    return () => { document.documentElement.classList.remove(cls); };
  }, [datasetAgent?.themeClass]);

  // Does this dataset have an Apps shelf at all? The nav item appears when at
  // least ONE app-group module is live, which is what makes Apps a shelf rather
  // than a hardcoded route: switching Procurement off in the admin tab empties
  // the shelf and the nav item goes with it, and adding a second app later
  // needs no change here.
  //
  // Asked without headlines — this only needs to know whether the shelf is
  // empty, and the numbers behind it cost a full pass over every tracked SKU.
  const [hasApps, setHasApps] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    appsService.hasApps(datasetId, userId, baseURL)
      .then(v => { if (alive) setHasApps(v); })
      .catch(() => { if (alive) setHasApps(false); });
    return () => { alive = false; };
  }, [datasetId, baseURL, userId]);
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

  const openInsight = (id: string) => navigate(`/${datasetId}/intelligence/insight/${id}`);
  // Home/My Reports/History/the detail page's own back link all close the
  // chat widget entirely rather than just collapsing it back to windowed —
  // navigating away from chat should read as a clean dedicated view, not
  // "Reports with a chat still open somewhere."
  const closeChatAnd = (fn: () => void) => {
    setChatOpen(false);
    setChatExpanded(false);
    fn();
  };
  // Home is the chat itself, so it opens it rather than closing it (the
  // view effect above expands it once the URL lands on Home).
  const goHome = () => navigate(`/${datasetId}/intelligence`);
  const goCenter = () => closeChatAnd(() => navigate(`/${datasetId}/intelligence/center`));
  const goReports = () => closeChatAnd(() => navigate(`/${datasetId}/intelligence/reports`));
  const goHistory = () => closeChatAnd(() => navigate(`/${datasetId}/intelligence/reports/history`));
  const reviewCompletedJob = (job: Job) => {
    const firstId = job.result?.insightIds[0];
    // Once you've actually gone and looked at it, it doesn't belong in the
    // header badges or the JobStrip anymore — both read from the same jobs
    // list, so removing it here clears it from both at once. The insight
    // itself isn't touched, only the job's "there's something to review" state.
    cancelJob(job.id);
    if (firstId) openInsight(firstId);
  };
  // Controlled from here (not the widget's own state) so collapsing it on
  // Home — where there is no page underneath — moves to the report center.
  const handleChatExpandedChange = (expanded: boolean) => {
    setChatExpanded(expanded);
    // Expanding is PURELY VISUAL — the widget is an overlay, the page
    // underneath stays mounted and untouched, so collapsing puts the user
    // back exactly where they were (an insight, a report, the Procurement
    // screen). Navigating to /chat on expand — the old behavior — silently
    // replaced that page with Home. The one case collapse must still
    // navigate: on Home, which IS the chat and renders an empty main with
    // nothing to come back to.
    if (!expanded && view === 'home') goCenter();
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

  // A module surface opens a SCOPED conversation (Smart Tune on the
  // Procurement page). Docked, not expanded, on purpose: the point of the
  // scope is talking about the rows while looking at them.
  const openScopedChat = (scope: ModuleScope) => {
    setChatOpen(true);
    setChatEverOpened(true);
    handleChatExpandedChange(false);
    setPendingChatScope(scope);
  };
  // 'home' IS Data Chat (Itzik, 2026-09-28): the bare /:datasetId/intelligence
  // opens the chat, and the report center that used to be Home is 'center'
  // under the "Reports" tab. My Reports / history / detail sit under it too.
  const view: 'home' | 'center' | 'reports' | 'history' | 'detail' | 'apps' | 'app' | 'settings' =
    settingsRoute ? 'settings'
      : centerRoute ? 'center'
        : appId ? 'app'
          : appsRoute ? 'apps'
            : insightId ? 'detail' : historyRoute ? 'history' : reportsRoute ? 'reports' : 'home';
  const reportsTabActive = view === 'center' || view === 'reports' || view === 'history' || view === 'detail';

  // The chat widget's open/expanded state follows the URL, not just its own
  // buttons — landing on Home (a fresh visit, a shared link, a refresh) must
  // open it expanded, same as clicking the Home tab.
  useEffect(() => {
    if (view === 'home') {
      setChatOpen(true);
      setChatEverOpened(true);
      setChatExpanded(true);
    }
  }, [view]);

  // Otto opens full screen, not as another tab inside the usual chrome (task
  // #66): the builder/canvas already has its own status rail and header, so
  // the outer header/nav/breadcrumb would just be a second one. `replenishment`
  // is the other thing under /apps/:appId and keeps the normal shell.
  const ottoFullScreen = view === 'app' && appId !== 'replenishment';

  const goApps = () => closeChatAnd(() => navigate(`/${datasetId}/intelligence/apps`));
  const goSettings = () => closeChatAnd(() => navigate(`/${datasetId}/intelligence/settings`));

  return (
    <div className={styles.shell} data-mode={mode} data-brand={datasetId}>
      {ottoFullScreen ? (
        <div className={styles.ottoBar}>
          {/* No directional arrow glyph: this codebase's other back actions
              (otto.plan.backToChat) are plain text for the same reason - a
              hardcoded ← reads backwards once the page mirrors for Hebrew. */}
          <button type="button" className={styles.ottoBackBtn} onClick={goApps}>
            {t('otto.backToIntelligence')}
          </button>
        </div>
      ) : (
      <header className={styles.header} ref={headerRef}>
        <div className={styles.headerRow}>
          <div className={styles.brand}>
            {/* Client logo (task #68) when the agent config has one, falling
                back to the text initials mark + name/subtitle for any dataset
                that doesn't. The logo already reads as the client's name
                (it's their real logo, often with the wordmark baked in), so
                brandName was dropped next to it as pure duplication — but
                leaving brandSub behind on its own (task #71) orphaned it: a
                line of text floating with no name above it and nothing
                visually tying it to the logo on the right. Simplest fix,
                matching what the bug report itself suggested: the whole text
                block only exists for the fallback (which needs it to read as
                a brand at all); a real logo image stands on its own. */}
            {datasetAgent?.logo?.src ? (
              <img className={styles.markImg} src={datasetAgent.logo.src} alt={datasetAgent.logo.alt || meta?.name || ''} />
            ) : (
              <>
                <span className={styles.mark}>{meta?.logoText || '··'}</span>
                <div className={styles.brandText}>
                  <div className={styles.brandName}>{meta?.name || '…'}</div>
                  <div className={styles.brandSub}>{t('intel.shell.subtitle')}</div>
                </div>
              </>
            )}
          </div>

          <nav className={styles.nav}>
            {/* No "My Reports" item: the report center links to it itself. */}
            <button className={`${styles.navBtn} ${view === 'home' ? styles.navActive : ''}`} onClick={goHome}>{t('intel.nav.home')}</button>
            <button className={`${styles.navBtn} ${reportsTabActive ? styles.navActive : ''}`} onClick={goCenter}>{t('intel.nav.center')}</button>
            {/* Renders ONLY when the Smart Replenishment module is enabled AND
                ready for this dataset. Turning the module off removes the page
                from the navigation cleanly, with no separate config to keep in
                step. */}
            {hasApps === true && (
              <button className={`${styles.navBtn} ${(view === 'apps' || view === 'app') ? styles.navActive : ''}`} onClick={goApps}>{t('apps.title')}</button>
            )}
          </nav>

          <div className={styles.headerRight}>
            <span className={styles.jobBadgesSlot}>
              <JobBadges datasetId={datasetId} onReviewCompleted={reviewCompletedJob} />
            </span>
            <div className={styles.langGroup} role="group" aria-label="Language">
              <button className={`${styles.langOption} ${language === 'en' ? styles.langOptionActive : ''}`} onClick={() => setLanguage('en')} aria-pressed={language === 'en'}>EN</button>
              <button className={`${styles.langOption} ${language === 'he' ? styles.langOptionActive : ''}`} onClick={() => setLanguage('he')} aria-pressed={language === 'he'}>עב</button>
            </div>
            <button
              className={`${styles.iconBtn} ${view === 'settings' ? styles.navActive : ''}`}
              onClick={goSettings}
              title={t('intel.nav.settings')}
              aria-label={t('intel.nav.settings')}
            >
              <Glyph name="gear" />
            </button>
            <button className={styles.iconBtn} onClick={() => setMode(m => m === 'dark' ? 'light' : 'dark')} title="Toggle theme" aria-label="Toggle theme">
              <Glyph name={mode === 'dark' ? 'sun' : 'moon'} />
            </button>
            {datasetAgent && (
              <span className={styles.feedbackSlot}>
                <FeedbackTrigger agentName={datasetAgent.agentName} baseURL={datasetAgent.baseURL} variant="icon" className={styles.iconBtn} />
              </span>
            )}
            <ChatSignIn tenant={datasetId} agentName={datasetAgent?.agentName ?? datasetId} />
            <div className={styles.onlineDot}><span className={styles.dot} />{t('intel.online')}</div>
          </div>
        </div>

        <div className={styles.breadcrumbRow}>
          <span className={`${styles.crumb} ${view === 'home' ? styles.crumbActive : ''}`} onClick={goHome} style={{ cursor: 'pointer' }}>{t('intel.nav.home')}</span>
          {reportsTabActive && (
            <>
              <span className={styles.crumbSep}>/</span>
              <span className={`${styles.crumb} ${view === 'center' ? styles.crumbActive : ''}`} onClick={goCenter} style={{ cursor: 'pointer' }}>{t('intel.nav.center')}</span>
            </>
          )}
          {(view === 'apps' || view === 'app') && (
            <>
              <span className={styles.crumbSep}>/</span>
              <span
                className={`${styles.crumb} ${view === 'apps' ? styles.crumbActive : ''}`}
                onClick={goApps}
                style={{ cursor: 'pointer' }}
              >{t('apps.title')}</span>
            </>
          )}
          {view === 'app' && (
            <>
              <span className={styles.crumbSep}>/</span>
              {/* The leaf crumb: registry modules by name; custom apps report
                  their own ("Draft - <name>" from the builder, the plain name
                  from a published page) via onCrumb, with generic fallbacks
                  until the record loads. */}
              <span className={`${styles.crumb} ${styles.crumbActive}`}>
                {appId === 'replenishment' ? t('procurement.title')
                  : (customCrumb && customCrumb.appId === appId ? customCrumb.crumb : null)
                    || (appId === 'new'
                      ? `${t('otto.crumb.draft')} - ${t('otto.crumb.newScreen')}`
                      : t('otto.crumb.screen'))}
              </span>
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
      )}

      <main className={`${styles.body} ${ottoFullScreen ? styles.bodyOtto : ''}`}>
        {/* Phones: the header is one thin line, so the data-freshness stamp
            rides here as a caption at the top of the scroll area instead —
            still the first thing seen, just not chrome. Desktop keeps it in
            the breadcrumb row (hidden on mobile). */}
        {syncInfo && (
          <div className={styles.mobileSyncCaption}>
            <span>{t('intel.lastSync')}: <b>{syncInfo.lastSync}</b></span>
            {baseURL && <DataHealthTrigger baseURL={baseURL} schema={datasetId} />}
          </div>
        )}
        {view === 'detail' && insightId && (
          <InsightDetail datasetId={datasetId} userId={userId} insightId={insightId} onBack={goReports} onLoaded={i => setInsightBreadcrumb(i.breadcrumbLabel)} onAskFollowUp={askFollowUp} />
        )}
        {view === 'history' && <ReportHistoryPage datasetId={datasetId} userId={userId} onOpenInsight={openInsight} />}
        {view === 'reports' && <ReportsPage datasetId={datasetId} userId={userId} onOpenInsight={openInsight} onOpenHistory={goHistory} />}
        {/* The VIEW is gated, not only the nav item. With the module off, a
            stale bookmark used to mount this page anyway: every call 404s and
            the page printed the server's untranslated message to a customer
            reading Hebrew. `null` means the answer has not arrived yet, so
            nothing is rendered rather than a flash of home. */}
        {view === 'apps' && hasApps === true && (
          <AppsPage
            datasetId={datasetId}
            baseURL={baseURL}
            onOpenApp={(id) => navigate(`/${datasetId}/intelligence/apps/${id}`)}
          />
        )}
        {/* One app's own page. `replenishment` is the module id; Procurement is
            what the client calls it. A second app gets a branch here and
            nothing else in the shell has to change. */}
        {view === 'app' && hasApps === true && appId === 'replenishment' && (
          <ProcurementPage datasetId={datasetId} baseURL={baseURL} onAskInChat={askFollowUp} onOpenScopedChat={openScopedChat} />
        )}
        {/* Anything else under /apps/:appId is Otto's territory: 'new' opens
            the builder, a screen id resolves by status (builder for drafts,
            the published page for active), and an unknown id falls back to
            the shelf — exactly what this branch did before Otto existed. */}
        {view === 'app' && hasApps === true && appId !== 'replenishment' && (
          <CustomScreenRouter
            datasetId={datasetId}
            appId={appId!}
            baseURL={baseURL}
            onCrumb={reportCrumb}
            fallback={(
              <AppsPage
                datasetId={datasetId}
                baseURL={baseURL}
                onOpenApp={(id) => navigate(`/${datasetId}/intelligence/apps/${id}`)}
              />
            )}
          />
        )}
        {(view === 'apps' || view === 'app') && hasApps === false && (
          <HomePage datasetId={datasetId} userId={userId} onOpenInsight={openInsight} onAskInChat={askFollowUp} onSeeAllReports={goReports} onOpenHistory={goHistory} />
        )}
        {view === 'center' && <HomePage datasetId={datasetId} userId={userId} onOpenInsight={openInsight} onAskInChat={askFollowUp} onSeeAllReports={goReports} onOpenHistory={goHistory} />}
        {view === 'settings' && <SettingsPage datasetId={datasetId} />}
      </main>

      {selectedJobId && <JobSidebar datasetId={datasetId} onReview={reviewCompletedJob} />}

      {chatEverOpened && (
        <ChatWidget
          datasetId={datasetId}
          open={chatOpen}
          expanded={chatExpanded}
          onExpandedChange={handleChatExpandedChange}
          onClose={() => { setChatOpen(false); if (view === 'home') goCenter(); }}
          headerHeight={headerHeight}
          pendingQuestion={pendingChatQuestion}
          onPendingQuestionConsumed={() => setPendingChatQuestion(null)}
          pendingScope={pendingChatScope}
          onPendingScopeConsumed={() => setPendingChatScope(null)}
        />
      )}

      {/* Otto is a dedicated full-screen surface with its own conversation
          rail (task #66) - the floating Data Chat launcher over it would be a
          second, unrelated chat sitting on top of the builder's own. */}
      {!chatOpen && !ottoFullScreen && (
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

      {/* Mobile navigation (< 640px). Its own CSS hides it on desktop, where
          the header's `.nav` row does this job. Hidden while the chat is open
          because on a phone the chat panel fills the viewport (its own back
          button leaves it) and the two would fight for the bottom edge. Also
          hidden for Otto full screen, same reasoning as the launcher above. */}
      {!chatOpen && !ottoFullScreen && (
        <MobileTabBar
          view={view}
          hasApps={hasApps === true}
          runningJobs={runningJobs}
          onHome={goHome}
          onReports={goCenter}
          onApps={goApps}
        />
      )}
    </div>
  );
}

function Glyph({ name }: { name: 'sun' | 'moon' | 'gear' }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'sun') return <svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
  // A hand-rolled version of this path was visibly lopsided (Kosta caught it
  // on the deployed page) — this is the well-known Feather/Lucide "settings"
  // gear outline instead, which is actually symmetric.
  if (name === 'gear') return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
  return <svg {...common}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>;
}
