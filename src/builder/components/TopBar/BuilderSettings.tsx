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

import { useEffect, useRef, useSyncExternalStore } from 'react';
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
 * Module-scoped current value + listener set so every `useBuilderSettings`
 * caller sees the same state. Without this, each call had its own local
 * React state and toggling in one component (e.g. the TopBar popover) was
 * invisible to other consumers (e.g. AddonModal) — the cached initial
 * snapshot stayed put.
 */
let currentSettings: BuilderSettingsState = loadSettings();
const listeners = new Set<() => void>();
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function snapshot(): BuilderSettingsState {
  return currentSettings;
}
function publish(next: BuilderSettingsState) {
  currentSettings = next;
  saveSettings(next);
  for (const fn of listeners) fn();
}

/**
 * Hook over the persisted state. Backed by a tiny pub/sub so every
 * caller stays in sync — toggling in one component instantly updates
 * every other consumer.
 */
export function useBuilderSettings(): [
  BuilderSettingsState,
  <K extends keyof BuilderSettingsState>(k: K, v: BuilderSettingsState[K]) => void,
] {
  const state = useSyncExternalStore(subscribe, snapshot, snapshot);
  const set = <K extends keyof BuilderSettingsState>(k: K, v: BuilderSettingsState[K]) => {
    publish({ ...currentSettings, [k]: v });
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
        hint="Saves on commit signals only — Done buttons, switching crew/agent, leaving the tab. No keystroke saves. Paused while an Alfred apply is pending."
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
