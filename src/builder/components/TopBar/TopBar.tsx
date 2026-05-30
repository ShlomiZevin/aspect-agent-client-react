import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBuilder } from '../../state/BuilderContext';
import { useConfirm } from '../Confirm/Confirm';
import { useAnyDirty } from '../../hooks/useAutoSave';
import { BuilderSettingsPopover, useBuilderSettings } from './BuilderSettings';
import styles from './TopBar.module.css';

export function TopBar() {
  const { doc, resetDraft, pendingAlfredApply } = useBuilder();
  const confirm = useConfirm();
  const [settings, setSetting] = useBuilderSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);

  const handleReset = async () => {
    const ok = await confirm({
      title: 'Reset draft?',
      message: 'Local changes will be lost. The builder will start from a blank project.',
      confirmLabel: 'Reset',
      danger: true,
    });
    if (ok) resetDraft();
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
      {settings.autoSave && (
        <SaveStatusChip
          autoSaveBlocked={!!pendingAlfredApply}
        />
      )}
      <button type="button" className={styles.resetBtn} onClick={handleReset}>
        Reset draft
      </button>
      <span className={styles.draftPill}>Draft</span>
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
 * Save-status chip — quietly reports auto-save state without
 * stealing focus. Reads dirty state via the shared hook so it stays
 * in sync with the actual debounced save loop.
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
        Saving…
      </span>
    );
  }
  return <span className={styles.saveStatus}>Saved</span>;
}
