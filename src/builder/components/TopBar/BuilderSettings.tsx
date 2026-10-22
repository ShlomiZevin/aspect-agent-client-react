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
 *   - brainInspector: the 🧠 memory button in the top bar (and its
 *     pulsing "new activity" dot). Off hides it — for anyone who finds
 *     the blinking distracting. Memory itself keeps working.
 *
 * Persisted in localStorage so the choice survives reloads.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { BRAIN_INSPECTOR_VISIBLE } from '../../state/BrainContext';
import { Modal } from '../Modal/Modal';
import styles from './BuilderSettings.module.css';

/**
 * The Builder has no user accounts: each browser gets a random "browser
 * ID" the first time it opens the Builder (BuilderApp.getOrCreateOwnerUserId),
 * and the Builder chat's history lists only that ID's conversations. A
 * cleared browser or a new computer starts a new ID, and the old history
 * seems gone (task #916). "Your browser ID" shows the ID and lets a person
 * switch back to an older one — Shlomi can look it up and hand it over.
 */
const OWNER_KEY = 'builder:ownerUserId';

function readOwnerId(): string {
  try { return localStorage.getItem(OWNER_KEY) || ''; } catch { return ''; }
}

export interface BuilderSettingsState {
  autoSave: boolean;
  brainInspector: boolean;
}

const STORAGE_KEY = 'builder:settings';

function loadSettings(): BuilderSettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { autoSave: false, brainInspector: true };
    const parsed = JSON.parse(raw);
    return { autoSave: parsed.autoSave === true, brainInspector: parsed.brainInspector !== false };
  } catch {
    return { autoSave: false, brainInspector: true };
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
  const [changingId, setChangingId] = useState(false);

  useEffect(() => {
    // While the "change browser ID" window is open, it owns clicks and Esc.
    if (!open || changingId) return;
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
  }, [open, onClose, triggerRef, changingId]);

  if (!open) return null;
  return (
    <div className={styles.popover} ref={ref}>
      <ToggleRow
        label="Auto-save"
        hint="Saves on commit signals only — Done buttons, switching crew/agent, leaving the tab. No keystroke saves. Paused while an Alfred apply is pending."
        value={settings.autoSave}
        onChange={v => onChange('autoSave', v)}
      />
      {BRAIN_INSPECTOR_VISIBLE && <ToggleRow
        label="Memory in the top bar"
        hint="The 🧠 button showing what the agent remembers, with its blinking “new activity” dot. Off hides it; memory itself keeps working."
        value={settings.brainInspector}
        onChange={v => onChange('brainInspector', v)}
      />}
      <IdentityRow onChange={() => setChangingId(true)} />
      {changingId && <ChangeIdentityModal onClose={() => setChangingId(false)} />}
    </div>
  );
}

function IdentityRow({ onChange }: { onChange: () => void }) {
  const id = readOwnerId();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(id); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* no clipboard */ }
  };
  return (
    <div className={styles.idRow}>
      <div className={styles.text}>
        <span className={styles.label}>Your browser ID</span>
        <span className={styles.hint}>Your Builder chat history belongs to this ID.</span>
      </div>
      <code className={styles.idValue} title={id}>{id || '—'}</code>
      <div className={styles.idActions}>
        <button type="button" className={styles.idBtn} onClick={copy} disabled={!id}>{copied ? 'Copied' : 'Copy'}</button>
        <button type="button" className={styles.idBtn} onClick={onChange}>Change…</button>
      </div>
    </div>
  );
}

function ChangeIdentityModal({ onClose }: { onClose: () => void }) {
  const current = readOwnerId();
  const [value, setValue] = useState('');
  const next = value.trim();
  const valid = /^[A-Za-z0-9_-]{6,100}$/.test(next) && next !== current;
  const save = () => {
    if (!valid) return;
    try { localStorage.setItem(OWNER_KEY, next); } catch { return; }
    window.location.reload();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Change browser ID"
      width={460}
      footer={
        <>
          <span style={{ flex: 1 }} />
          <button type="button" className={styles.idBtn} onClick={onClose}>Cancel</button>
          <button type="button" className={`${styles.idBtn} ${styles.idBtnPrimary}`} onClick={save} disabled={!valid}>Switch and reload</button>
        </>
      }
    >
      <p className={styles.modalText}>
        Paste the ID whose Builder chat history you want to see. The Builder reloads under that ID —
        save any unsaved work first. Copy the current ID before switching, to be able to come back.
      </p>
      <input
        className={styles.idInput}
        value={value}
        autoFocus
        placeholder="builder-owner-…"
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); }}
      />
      <p className={styles.modalNote}>
        {next && next === current ? 'That is already this browser\'s ID.'
          : next && !valid ? 'An ID has only letters, digits and dashes.'
            : `Current: ${current || '—'}`}
      </p>
    </Modal>
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
