import { useRef, useState } from 'react';
import { Link, useMatch } from 'react-router-dom';
import { useBuilder } from '../../state/BuilderContext';
import { useAgentVersion, useCrewVersion } from '../../state/useEntityVersion';
import { useAnyDirty } from '../../hooks/useAutoSave';
import { useConfirm } from '../Confirm/Confirm';
import { VersionMenu } from '../VersionMenu/VersionMenu';
import { BuilderSettingsPopover, useBuilderSettings } from './BuilderSettings';
import { PromptGuideModal } from '../PromptGuide/PromptGuideModal';
import styles from './TopBar.module.css';

export function TopBar() {
  const { doc, pendingAlfredApply, resetToServerState } = useBuilder();
  const [settings, setSetting] = useBuilderSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
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
