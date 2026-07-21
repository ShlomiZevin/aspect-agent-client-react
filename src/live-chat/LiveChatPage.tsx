/**
 * LiveChatPage — the customer-facing Lybi chat surface.
 *
 * Standalone (NOT inside the builder). Reads the agent slug from the
 * `/:agent/live` route, runs the agent's `active` version via the V2
 * runtime, and renders Noa's mockup design. Owns all UI/overlay state;
 * the conversation state machine lives in useLiveChat.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { fetchProject } from '../builder/state/builderApi';
import { getOwnerUserId } from './identity';
import { I18N, dirOf } from './i18n';
import { useLiveSettings } from './useLiveSettings';
import { useLiveChat, type LiveTurn } from './useLiveChat';
import { useBranding } from './useBranding';
import { brandCssVars } from './branding';
import { clientById } from './liveConfig';
import { IconBrain, IconProfiler } from './icons';
import { TopBar } from './components/TopBar';
import { BrandingModal } from './components/BrandingModal';
import { MessageStream } from './components/MessageStream';
import { Composer } from './components/Composer';
import { HistoryDrawer } from './components/HistoryDrawer';
import { SettingsPopover } from './components/SettingsPopover';
import { SidePanel } from './components/SidePanel';
import { BrainPanels } from './components/BrainPanels';
import { ReportModal } from './components/ReportModal';
import { ConfirmDelete } from './components/ConfirmDelete';
import { AgentNotReady } from './components/AgentNotReady';
import { Toast } from './components/Toast';
import './liveChat.css';

type Gate = 'checking' | 'ready' | 'missing' | 'no-active' | 'error';

interface PendingDelete { turn: LiveTurn; mode: 'self' | 'fromHere'; }

interface LiveChatPageProps {
  /** Customer-restricted mode — the login-gated `/:agent/chat` surface.
   *  Normal chat + "new chat" only: no history, no debug, no settings,
   *  no brain/profiler, no builder/embed shortcuts. (Task #715.) */
  restricted?: boolean;
  /** Conversation owner identity. The restricted surface passes the
   *  logged-in user's externalId so their chats are theirs (and show up
   *  under that user in the admin); default is the anonymous browser id. */
  ownerUserIdOverride?: string;
  /** Shown as a logout button in the top bar (restricted mode). */
  onLogout?: () => void;
}

export function LiveChatPage({ restricted = false, ownerUserIdOverride, onLogout }: LiveChatPageProps = {}) {
  const { agent, convId: convIdParam } = useParams<{ agent: string; convId: string }>();
  const slug = agent ?? 'lybi';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // `?embed=1` (set by the on-site widget iframe) renders a compact variant.
  const embed = searchParams.get('embed') === '1';
  const ownerUserId = useMemo(
    () => ownerUserIdOverride ?? getOwnerUserId(),
    [ownerUserIdOverride],
  );
  // Route family this page lives under — the restricted surface mounts
  // at /:agent/go (/:agent/chat is still the V1 authenticated chat),
  // the full one at /:agent/live. Every internal navigate stays inside
  // its own family.
  const base = restricted ? 'go' : 'live';

  const [settings, setSetting] = useLiveSettings();
  const t = I18N[settings.lang];
  const dir = dirOf(settings.lang);

  const branding = useBranding();
  const { brand } = branding;

  // Customer-facing: run the PUBLISHED version. The runtime falls back
  // to active→viewing when nothing is published yet, so this is safe
  // before the first Publish. Applies to both `/:agent/live` and the
  // login-gated `/:agent/go` (restricted) — customers always get
  // published, never the builder's in-progress active version.
  const chat = useLiveChat({ slug, ownerUserId, version: 'published' });

  // Live Brain — the customer-facing panels for this conversation. They
  // arrive live on the chat stream (`brain.snapshot`) and hydrate once
  // when an existing conversation is opened. No refetch, no polling.
  const brainPanels = chat.livePanels;
  const brainArrangement = chat.liveFrame?.arrangement ?? 'stack';
  const brainFull = chat.liveFrame?.openMode === 'full';

  // Logo priority: custom brand logo → selected client's logo → none (name mark).
  const clientLogo = clientById(settings.client).logoUrl ?? null;
  const logo = brand.logo ?? clientLogo;
  const logoFilterable = !brand.logo && clientLogo === '/img/lybi-logo-transparent.png';
  const brandName = brand.agentName || clientById(settings.client).name[settings.lang];

  // ── overlay / UI state ───────────────────────────────────────────
  const [input, setInput] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [brainOpen, setBrainOpen] = useState(false);
  const [profilerOpen, setProfilerOpen] = useState(false);
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [brandingOpen, setBrandingOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  // ── agent-not-ready gate (reuse the builder's fetchProject) ──────
  const [gate, setGate] = useState<Gate>('checking');
  const [crewNames, setCrewNames] = useState<Record<string, string>>({});
  const [defaultCrewName, setDefaultCrewName] = useState('');
  useEffect(() => {
    let cancelled = false;
    setGate('checking');
    fetchProject({ agentSlug: slug, ownerUserId })
      .then(doc => {
        if (cancelled) return;
        if (!doc) { setGate('missing'); return; }
        const a = doc.agents.find(x => x.slug === slug) ?? doc.agents[0];
        // crewId → display name for the per-bubble crew label.
        const names: Record<string, string> = {};
        a?.crews?.forEach(c => { if (c.id) names[c.id] = c.name; });
        setCrewNames(names);
        setDefaultCrewName(
          (a?.defaultCrewId && names[a.defaultCrewId]) || Object.values(names)[0] || '',
        );
        setGate(a && a.activeVersionId ? 'ready' : 'no-active');
      })
      .catch(() => { if (!cancelled) setGate('error'); });
    return () => { cancelled = true; };
  }, [slug, ownerUserId]);

  // ── conversation URL: /:agent/live/c/:convId ─────────────────────
  // Load the conversation named in the URL once the agent is ready (so a
  // shared link or a refresh lands back on that conversation).
  const loadedRef = useRef<number | null>(null);
  useEffect(() => {
    if (gate !== 'ready') return;
    const c = convIdParam && /^\d+$/.test(convIdParam) ? Number(convIdParam) : null;
    if (c !== null && loadedRef.current !== c && c !== chat.conversationId) {
      loadedRef.current = c;
      chat.loadConversation(c);
    }
  }, [gate, convIdParam, chat.conversationId, chat.loadConversation]);

  // Reflect a FRESH conversation in the URL (shareable + refresh-safe).
  //
  // The URL is the single source of truth for which conversation is
  // open: picking from history navigates, and the effect above loads
  // whatever the URL names. This effect writes state → URL in exactly
  // one case — a brand-new chat just got its id from the server (the
  // URL has no /c/ segment yet). It deliberately never fires when the
  // URL already names a conversation: during the async load after a
  // pick, `chat.conversationId` still holds the PREVIOUS id, and
  // navigating to it here is what caused the URL ping-pong + screen
  // flicker (task #727).
  useEffect(() => {
    const cid = chat.conversationId;
    if (cid !== null && convIdParam === undefined) {
      // Already live in state — mark it loaded so the URL effect
      // doesn't fetch it again. Keep ?embed=1: dropping it would flip
      // the widget iframe into the desktop layout mid-conversation.
      loadedRef.current = cid;
      navigate(`/${slug}/${base}/c/${cid}${embed ? '?embed=1' : ''}`, { replace: true });
    }
  }, [chat.conversationId, convIdParam, navigate, slug, base, embed]);

  // ── inject the Assistant font once ───────────────────────────────
  useEffect(() => {
    const id = 'lybi-live-font';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(link);
  }, []);

  // ── keyboard: Ctrl+Shift+D toggles debug, Esc closes overlays ────
  const closeAll = useCallback(() => {
    setDrawerOpen(false);
    setSettingsOpen(false);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAll();
        setReportFor(null);
        setPendingDelete(null);
        setBrandingOpen(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd') && !restricted) {
        e.preventDefault();
        setSetting({ mode: settings.mode === 'debug' ? 'normal' : 'debug' });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeAll, setSetting, settings.mode, restricted]);

  // ── handlers ─────────────────────────────────────────────────────
  const onSend = useCallback(() => {
    const text = input;
    setInput('');
    chat.send(text);
  }, [input, chat]);

  const onNewChat = useCallback(() => {
    chat.newChat();
    loadedRef.current = null;
    navigate(`/${slug}/${base}${embed ? '?embed=1' : ''}`, { replace: true });
    setDrawerOpen(false);
    showToast(t.newChatStarted);
  }, [chat, navigate, slug, base, embed, showToast, t.newChatStarted]);

  // Picking from history ONLY navigates — the URL effect above is the
  // single loader. No direct loadConversation call here, so state and
  // URL can never race each other.
  const onPickConversation = useCallback((id: number) => {
    setDrawerOpen(false);
    navigate(`/${slug}/${base}/c/${id}${embed ? '?embed=1' : ''}`);
  }, [navigate, slug, base, embed]);

  const onDeleteConversations = useCallback(async (ids: number[]) => {
    const activeDeleted = chat.conversationId !== null && ids.includes(chat.conversationId);
    await chat.deleteConversations(ids);
    if (activeDeleted) {
      // The active chat is gone — reset the URL so a refresh doesn't
      // try to load a deleted conversation.
      loadedRef.current = null;
      navigate(`/${slug}/${base}${embed ? '?embed=1' : ''}`, { replace: true });
    }
  }, [chat, navigate, slug, base, embed]);

  const onOpenBuilder = useCallback(() => {
    const suffix = chat.conversationId !== null ? `?c=${chat.conversationId}` : '';
    navigate(`/${slug}/builder${suffix}`);
  }, [navigate, slug, chat.conversationId]);

  // Embed mode: break out of the widget iframe back to the full desktop
  // chat, keeping the current conversation. The widget iframe is
  // same-origin on our demo page, so navigating window.top works; a
  // sandboxed / cross-origin host falls back to a new tab.
  const onOpenFull = useCallback(() => {
    const path = chat.conversationId !== null
      ? `/${slug}/live/c/${chat.conversationId}`
      : `/${slug}/live`;
    if (window.top !== window.self) {
      try {
        window.top!.location.href = path;
        return;
      } catch {
        window.open(path, '_blank', 'noopener');
        return;
      }
    }
    navigate(path, { replace: true });
  }, [slug, chat.conversationId, navigate]);

  const confirmDelete = useCallback(() => {
    if (!pendingDelete) return;
    const { turn, mode } = pendingDelete;
    setPendingDelete(null);
    if (mode === 'self') chat.deleteTurn(turn);
    else chat.deleteFromHere(turn);
  }, [pendingDelete, chat]);

  // The floating widget and the restricted customer surface always run
  // in regular mode — no debug, no builder shortcuts, regardless of
  // what's stored in settings.
  const debug = settings.mode === 'debug' && !embed && !restricted;
  const showWelcome = chat.turns.length === 0 && !chat.busy;

  return (
    <div
      className="lybi-chat"
      dir={dir}
      data-theme={settings.theme}
      data-mode={embed || restricted ? 'normal' : settings.mode}
      data-client={settings.client}
      data-embed={embed ? '1' : undefined}
      style={brandCssVars(brand.colors) as React.CSSProperties}
    >
      <div className="app">
        {/* Brain — opens from the inline-end (visual left in RTL) */}
        {!restricted && (
          <SidePanel
            which="brain"
            open={brainOpen}
            onClose={() => setBrainOpen(false)}
            title={t.brain}
            icon={<IconBrain />}
            placeholderTitle={t.brainTitle}
            placeholderSub={t.brainSub}
            emoji="🧠"
            bareHead
            full={brainFull}
          >
            {brainPanels.length > 0 ? <BrainPanels panels={brainPanels} arrangement={brainArrangement} /> : null}
          </SidePanel>
        )}

        <main className="chat-col">
          <TopBar
            t={t}
            logo={logo}
            brandName={brandName}
            logoFilterable={logoFilterable}
            debug={debug}
            embed={embed}
            restricted={restricted}
            onLogout={onLogout}
            brainOpen={brainOpen}
            profilerOpen={profilerOpen}
            onHistory={() => setDrawerOpen(true)}
            onNewChat={onNewChat}
            onToggleBrain={() => setBrainOpen(o => !o)}
            onToggleProfiler={() => setProfilerOpen(o => !o)}
            onSettings={e => { e.stopPropagation(); setSettingsOpen(o => !o); }}
            onOpenBuilder={onOpenBuilder}
            onViewEmbed={() => navigate(`/${slug}/embed`)}
            onOpenFull={onOpenFull}
            settingsBtnRef={settingsBtnRef}
          />

          {gate === 'ready' && (
            <>
              <MessageStream
                turns={chat.turns}
                t={t}
                lang={settings.lang}
                debug={debug}
                showWelcome={showWelcome}
                logo={logo}
                crewNames={crewNames}
                defaultCrewName={defaultCrewName}
                onPick={text => chat.send(text)}
                onExpandThink={turn => chat.loadThinkRuns(turn)}
                onReport={text => setReportFor(text)}
                onDelete={turn => setPendingDelete({ turn, mode: 'self' })}
                onDeleteFromHere={turn => setPendingDelete({ turn, mode: 'fromHere' })}
              />
              {chat.error && <div className="err-chip">{chat.error}</div>}
              <Composer
                t={t}
                value={input}
                busy={chat.busy}
                uiDir={dir}
                ctrlEnter={settings.ctrlEnter}
                onChange={setInput}
                onSend={onSend}
                onToggleCtrlEnter={() => setSetting({ ctrlEnter: !settings.ctrlEnter })}
              />
            </>
          )}

          {(gate === 'missing' || gate === 'no-active' || gate === 'error') && (
            <AgentNotReady
              t={t}
              reason={gate === 'no-active' ? 'no-active' : 'missing'}
              slug={slug}
              onOpenBuilder={() => navigate(`/${slug}/builder`)}
            />
          )}
        </main>

        {/* Profiler — opens from the inline-start (visual right in RTL) */}
        {!restricted && (
          <SidePanel
            which="profiler"
            open={profilerOpen}
            onClose={() => setProfilerOpen(false)}
            title={t.profiler}
            icon={<IconProfiler />}
            placeholderTitle={t.profTitle}
            placeholderSub={t.profSub}
            emoji="👤"
          />
        )}
      </div>

      {/* History, settings, and branding are internal tools — the
          restricted customer surface ships without them (#715). */}
      {!restricted && (
        <>
          <div className={`scrim ${drawerOpen ? 'show' : ''}`} onClick={closeAll} />

          <HistoryDrawer
            open={drawerOpen}
            t={t}
            lang={settings.lang}
            conversations={chat.convList}
            activeId={chat.conversationId}
            onClose={() => setDrawerOpen(false)}
            onPick={onPickConversation}
            onRename={chat.renameConversation}
            onDelete={onDeleteConversations}
            onNew={onNewChat}
          />

          <SettingsPopover
            open={settingsOpen}
            t={t}
            settings={settings}
            triggerRef={settingsBtnRef}
            onClose={() => setSettingsOpen(false)}
            onChange={setSetting}
            onOpenBranding={() => { setSettingsOpen(false); setBrandingOpen(true); }}
          />

          <BrandingModal
            open={brandingOpen}
            t={t}
            lang={settings.lang}
            branding={branding}
            onClose={() => setBrandingOpen(false)}
          />
        </>
      )}

      <ReportModal
        open={reportFor !== null}
        t={t}
        messageText={reportFor ?? ''}
        agentSlug={slug}
        scenario={settings.scenario}
        conversationId={chat.conversationId}
        onClose={() => setReportFor(null)}
        onDone={msg => { setReportFor(null); showToast(msg); }}
      />

      <ConfirmDelete
        open={pendingDelete !== null}
        t={t}
        message={pendingDelete?.mode === 'fromHere' ? t.deleteFromHereConfirm : t.deleteMsgConfirm}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />

      <Toast message={toast} />
    </div>
  );
}
