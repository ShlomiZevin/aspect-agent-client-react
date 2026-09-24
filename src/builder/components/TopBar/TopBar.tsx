import { useEffect, useRef, useState } from 'react';
import { Link, useMatch } from 'react-router-dom';
import { useBuilder } from '../../state/BuilderContext';
import { useAgentVersion, useCrewVersion } from '../../state/useEntityVersion';
import { useAnyDirty } from '../../hooks/useAutoSave';
import { useConfirm } from '../Confirm/Confirm';
import { VersionMenu } from '../VersionMenu/VersionMenu';
import { BuilderSettingsPopover, useBuilderSettings } from './BuilderSettings';
import { PromptGuideModal } from '../PromptGuide/PromptGuideModal';
import { FolderDraftsModal, IncomingDraftModal } from '../FolderDrafts';
import { fetchAiBundleVersion } from '../../state/builderApi';
import {
  isSupported as folderSupported, readBundleVersion, rememberedFolder,
} from '../../state/folderDrafts';
import { chosenTool } from '../FolderDrafts/aiSetupContent';
import { useBrain } from '../../state/BrainContext';
import { useBrainCounts } from '../../state/useBrainSnapshot';
import styles from './TopBar.module.css';

export function TopBar() {
  const { doc, pendingAlfredApply, resetToServerState } = useBuilder();
  const [settings, setSetting] = useBuilderSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);

  /**
   * Whether the platform files in the user's folder are behind the server.
   *
   * This lived only inside the dialog, which meant the one person who
   * needed to know had to open it to find out — so in practice her
   * assistant would go on reading stale code indefinitely. The toolbar is
   * the only place she reliably looks.
   *
   * Checked on mount and whenever the dialog closes (she may have just
   * refreshed them). Not polled: the files change when we deploy, which
   * is not something worth asking about every few seconds.
   */
  const [filesStale, setFilesStale] = useState(false);

  /**
   * What the AI button calls itself: the name of the app she installed
   * once a folder exists, an invitation to connect one before that.
   *
   * "AI" was the wrong label because Alfred is also AI and sits two
   * panels away — the button was claiming a whole category while meaning
   * one specific thing. Naming the actual app removes the question: the
   * builder now offers Alfred in the panel and Claude Code (or Codex) in
   * the toolbar, and nobody has to be told which is which.
   */
  const [aiLabel, setAiLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!folderSupported()) return;
    let cancelled = false;
    void (async () => {
      try {
        const folder = await rememberedFolder();
        if (cancelled) return;
        setAiLabel(folder ? chosenTool().label : null);
        if (!folder) return;
        const [local, server] = await Promise.all([
          readBundleVersion(folder),
          fetchAiBundleVersion().then(r => r.version).catch(() => null),
        ]);
        // Only meaningful once she has actually downloaded them: with no
        // local copy there is nothing stale, just nothing set up.
        if (!cancelled) setFilesStale(!!local && !!server && local !== server);
      } catch { /* folder gone — nothing to report */ }
    })();
    return () => { cancelled = true; };
  }, [folderOpen]);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const confirm = useConfirm();
  const { dirty } = useAnyDirty();

  // Always-available "refetch from server". The VersionMenu's Reset
  // only renders while DIRTY — with a clean (but possibly stale) local
  // draft there used to be no way to pull the server's latest state.
  const handleReload = async () => {
    const ok = await confirm({
      title: 'Reload from server?',
      message: dirty
        ? 'You have unsaved changes — they will be lost. The builder reloads the last saved server state.'
        : 'The builder reloads the last saved server state.',
      confirmLabel: 'Reload',
      danger: dirty,
    });
    if (ok) await resetToServerState();
  };

  return (
    <>
      <Link to="/builder" className={styles.back} title="Back to projects">
        ←
      </Link>
      <span className={styles.title}>Builder</span>
      <span className={styles.divider}>·</span>
      <span className={styles.subject}>{doc.name}</span>
      {/* Beside the name, not in the right-hand cluster: it shows what
          THIS agent knows in the current conversation, and the right side
          is already the most crowded part of the bar. The dock drops from
          the canvas's left edge, directly under it. */}
      <BrainInspectorButton />
      <span className={styles.spacer} />
      <TopBarVersionMenu />
      {settings.autoSave && (
        <SaveStatusChip
          autoSaveBlocked={!!pendingAlfredApply}
        />
      )}
      <button
        type="button"
        className={styles.settingsBtn}
        onClick={() => setGuideOpen(true)}
        title="Prompt guide — every token and shortcut, explained simply (EN/HE)"
      >
        📖
      </button>
      <button
        type="button"
        className={styles.aiBtn}
        onClick={() => setFolderOpen(true)}
        title={filesStale
          ? 'The platform has changed since you last downloaded the files — your assistant is reading an old copy of how it works. Open to update them.'
          : aiLabel
            ? `${aiLabel} on your computer — the folder your draft is saved to`
            : 'Build agents by talking to Claude Code or Codex on your own computer'}
      >
        🤖 {aiLabel ?? 'Connect my AI'}
        {filesStale && <span className={styles.aiDot} aria-label="Files out of date" />}
      </button>
      <button
        type="button"
        className={styles.settingsBtn}
        onClick={handleReload}
        title="Reload from server (discards the local draft)"
      >
        ⟳
      </button>
      <div className={styles.settingsWrap}>
        <button
          type="button"
          ref={settingsBtnRef}
          className={`${styles.settingsBtn} ${settingsOpen ? styles.settingsBtnActive : ''}`}
          onClick={() => setSettingsOpen(o => !o)}
          title="Builder settings"
          aria-expanded={settingsOpen}
        >
          ⚙
        </button>
        <BuilderSettingsPopover
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          triggerRef={settingsBtnRef}
          settings={settings}
          onChange={setSetting}
        />
      </div>
      <PromptGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
      <FolderDraftsModal open={folderOpen} onClose={() => setFolderOpen(false)} />
      {/* Mounted here because it must appear wherever the user is — an
          assistant can finish while they are on any screen. */}
      <IncomingDraftModal />
    </>
  );
}

/**
 * Context-aware VersionMenu hosted in the TopBar — global Save / Save
 * as / Discard / ⭐ Set as active for whichever entity the user is
 * editing.
 *
 * THE RULE: crew controls only on the builder's INDEX route (the
 * Cortex canvas). Every nested screen — enums, personas, fields, tags,
 * pinned, live-brain, profiler, triggers — edits the AGENT body, so
 * they all need agent controls.
 *
 * Stated as "index means crew" rather than a list of agent routes,
 * because the list version was already wrong. It matched only the
 * dynamic-context route, so on any OTHER agent-level screen with a crew
 * still selected in the sidebar (the normal state), Save targeted the
 * crew and the agent edit was never written. That is how a trigger
 * could be authored, appear saved, and simply not be there — and the
 * same trap was waiting for Live Brain and Profiler.
 *
 * Both `useAgentVersion` and `useCrewVersion` are called every render
 * to satisfy the rules of hooks; whichever doesn't apply returns null
 * and is ignored.
 */
function TopBarVersionMenu() {
  const { selection } = useBuilder();
  const agentId = selection.agentId ?? '';
  const crewId  = selection.crewId  ?? '';
  // Exact match — the canvas, with no sub-route after it.
  const onCanvas = useMatch('/:agent/builder');

  const agentVersion = useAgentVersion(agentId);
  const crewVersion  = useCrewVersion(agentId, crewId);

  const useCrew = selection.level === 'crew' && !!onCanvas && crewVersion;
  const state   = useCrew ? crewVersion! : agentVersion;
  if (!state) return null;
  return <VersionMenu state={state} />;
}

/**
 * 🧠 Brain Inspector toggle (task #860). The inspector used to be an
 * always-on strip at the bottom of the canvas; authors found it in the
 * way, so it collapsed into this button. The fields-filled count stays
 * ON the button because "is the agent capturing anything?" is the
 * reason to glance at it at all; DC hits don't fit and live in the
 * tooltip and the panel.
 *
 * Opens the docked panel (which drops down under this button); from
 * there ⤢ goes fullscreen. Any open posture counts as open, so a click
 * here always closes.
 */
function BrainInspectorButton() {
  const { posture, setPosture, hasUnseen } = useBrain();
  const { filled, total, dcHits } = useBrainCounts();
  const open = posture !== 'collapsed';
  // Reserve the widest the count can get for this schema ("14/14") so
  // 8/14 → 9/14 → 10/14 never nudges the buttons beside it.
  const countWidth = `${String(total).length * 2 + 1}ch`;
  return (
    <button
      type="button"
      className={`${styles.brainBtn} ${open ? styles.brainBtnActive : ''}`}
      onClick={() => setPosture(open ? 'collapsed' : 'docked')}
      aria-expanded={open}
      title={`Brain Inspector — ${filled} of ${total} fields filled · ${dcHits} DC ${dcHits === 1 ? 'hit' : 'hits'}${hasUnseen && !open ? ' · new activity' : ''}`}
    >
      <span aria-hidden>🧠</span>
      <span className={styles.brainCount} style={{ minWidth: countWidth }}>
        {filled}/{total}
      </span>
      {/* Absolutely positioned, so lighting it never resizes the button. */}
      {hasUnseen && !open && <span className={styles.brainDot} aria-label="new activity" />}
    </button>
  );
}

/**
 * Save-status chip — quietly reports auto-save state without
 * stealing focus. Phase B v3: auto-save only fires on commit signals
 * (Done buttons, selection change, window blur), so a dirty doc just
 * means "edits are pending a commit" — not "save will fire any second".
 */
function SaveStatusChip({ autoSaveBlocked }: { autoSaveBlocked: boolean }) {
  const { dirty } = useAnyDirty();
  if (autoSaveBlocked) {
    return (
      <span className={`${styles.saveStatus} ${styles.saveStatusActive}`}>
        Auto-save paused · Alfred pending
      </span>
    );
  }
  if (dirty) {
    return (
      <span className={`${styles.saveStatus} ${styles.saveStatusActive}`}>
        Unsaved
      </span>
    );
  }
  return <span className={styles.saveStatus}>Saved</span>;
}
