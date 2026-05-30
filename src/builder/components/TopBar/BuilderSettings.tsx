/**
 * BuilderSettings — popover with per-builder-user global toggles.
 *
 * Lives behind the ⚙ button in the TopBar. Distinct from
 * `ChatSettings` — those are end-user preview surfaces; these affect
 * the builder shell itself.
 *
 * Currently:
 *   - autoSave: silently save the viewing version of every dirty
 *     entity on a debounce. Disabled while a pending Alfred Apply is
 *     unresolved (we never overwrite his draft target without an
 *     explicit Save).
 *
 * Persisted in localStorage so the choice survives reloads.
 */

import { useEffect, useRef, useState } from 'react';
import styles from './BuilderSettings.module.css';

export interface BuilderSettingsState {
  autoSave: boolean;
}

const STORAGE_KEY = 'builder:settings';

function loadSettings(): BuilderSettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { autoSave: false };
    const parsed = JSON.parse(raw);
    return { autoSave: parsed.autoSave === true };
  } catch {
    return { autoSave: false };
  }
}

function saveSettings(s: BuilderSettingsState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

/**
 * Hook over the persisted state. Multiple call sites share a snapshot
 * via the localStorage round-trip — fine for now; a context can be
 * added if more components start consuming it.
 */
export function useBuilderSettings(): [
  BuilderSettingsState,
  <K extends keyof BuilderSettingsState>(k: K, v: BuilderSettingsState[K]) => void,
] {
  const [state, setState] = useState<BuilderSettingsState>(() => loadSettings());
  const set = <K extends keyof BuilderSettingsState>(k: K, v: BuilderSettingsState[K]) => {
    setState(prev => {
      const next = { ...prev, [k]: v };
      saveSettings(next);
      return next;
    });
  };
  return [state, set];
}

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  settings: BuilderSettingsState;
  onChange: <K extends keyof BuilderSettingsState>(k: K, v: BuilderSettingsState[K]) => void;
}

export function BuilderSettingsPopover({
  open, onClose, triggerRef, settings, onChange,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current && ref.current.contains(target)) return;
      if (triggerRef?.current && triggerRef.current.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, triggerRef]);

  if (!open) return null;
  return (
    <div className={styles.popover} ref={ref}>
      <ToggleRow
        label="Auto-save"
        hint="Save dirty changes silently after a short pause. Pauses while an Alfred apply is pending."
        value={settings.autoSave}
        onChange={v => onChange('autoSave', v)}
      />
    </div>
  );
}

function ToggleRow({
  label, hint, value, onChange,
}: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={styles.row}>
      <div className={styles.text}>
        <span className={styles.label}>{label}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </div>
      <span
        className={`${styles.toggle} ${value ? styles.toggleOn : ''}`}
        role="switch"
        aria-checked={value}
      >
        <input
          type="checkbox"
          className={styles.toggleInput}
          checked={value}
          onChange={e => onChange(e.target.checked)}
        />
        <span className={styles.toggleKnob} />
      </span>
    </label>
  );
}
