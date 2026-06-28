import { useRef, useState } from 'react';
import { Link, useMatch } from 'react-router-dom';
import { useBuilder } from '../../state/BuilderContext';
import { useAgentVersion, useCrewVersion } from '../../state/useEntityVersion';
import { useAnyDirty } from '../../hooks/useAutoSave';
import { VersionMenu } from '../VersionMenu/VersionMenu';
import { BuilderSettingsPopover, useBuilderSettings } from './BuilderSettings';
import styles from './TopBar.module.css';

export function TopBar() {
  const { doc, pendingAlfredApply } = useBuilder();
  const [settings, setSetting] = useBuilderSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);

  // "Reset draft" button was retired — its behavior (wipe local doc to a
  // blank project shell) was a debug-helper footgun next to the
  // VersionMenu's Reset, which now does the right thing (reload from
  // server, fall back to empty). The underlying `resetDraft` action
  // stays available on BuilderContext for any future caller; only the
  // UI surface is removed. Restore by uncommenting the JSX below and
  // re-importing `useBuilder` / `useConfirm` for the handler.
  //
  // const { resetDraft } = useBuilder();
  // const confirm = useConfirm();
  // const handleReset = async () => {
  //   const ok = await confirm({
  //     title: 'Reset draft?',
  //     message: 'Local changes will be lost. The builder will start from a blank project.',
  //     confirmLabel: 'Reset',
  //     danger: true,
  //   });
  //   if (ok) resetDraft();
  // };

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
      {/* <button type="button" className={styles.resetBtn} onClick={handleReset}>
        Reset draft
      </button> */}
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
    </>
  );
}

/**
 * Context-aware VersionMenu hosted in the TopBar — global Save / Save
 * as / Discard / ⭐ Set as active for whichever entity the user is
 * editing. Picks the right entity based on selection + URL:
 *
 *   - `selection.level === 'crew'` AND the URL is the default builder
 *     route → crew controls (with cross-dirty agent save folded in).
 *   - Otherwise (agent view, project view, or any of the
 *     `/dynamic-context/*` routes) → agent controls.
 *
 * Both `useAgentVersion` and `useCrewVersion` are called every render
 * to satisfy the rules of hooks; whichever doesn't apply returns null
 * and is ignored.
 */
function TopBarVersionMenu() {
  const { selection } = useBuilder();
  const agentId = selection.agentId ?? '';
  const crewId  = selection.crewId  ?? '';
  // The DC route lives on the agent body even when selection.level
  // still says 'crew' (the user can navigate via the schema panel's
  // 🎯 chip without changing crew selection). Match the URL to force
  // agent-mode in that case.
  const onDcRoute = useMatch('/:agent/builder/dynamic-context/*');

  const agentVersion = useAgentVersion(agentId);
  const crewVersion  = useCrewVersion(agentId, crewId);

  const useCrew = selection.level === 'crew' && !onDcRoute && crewVersion;
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
