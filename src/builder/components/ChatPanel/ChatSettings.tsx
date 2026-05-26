/**
 * ChatSettings — popover with per-builder-user toggles for UserChat.
 *
 * Currently:
 *   - debugControls: show inline delete buttons on every bubble
 *   - rtl: render bubble text right-to-left (Hebrew/Arabic)
 *
 * Persists in localStorage so the surface starts the way the user
 * left it. Future toggles slot in by extending the Settings type
 * and the popover JSX — no other UI shuffles needed.
 */

import { useEffect, useRef, useState } from 'react';
import styles from './ChatSettings.module.css';

export interface ChatSettingsState {
  rtl: boolean;
}

const STORAGE_KEY = 'builder:chatSettings';

function loadSettings(): ChatSettingsState {
  // Default RTL on — most agents in this builder are Hebrew, and a
  // left-aligned LTR bubble of Hebrew text is hard to read.
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { rtl: true };
    const parsed = JSON.parse(raw);
    return { rtl: parsed.rtl !== false };
  } catch {
    return { rtl: true };
  }
}

function saveSettings(s: ChatSettingsState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

/**
 * Hook over the persisted state. Returns the live settings + a
 * setter that updates one field at a time.
 */
export function useChatSettings(): [
  ChatSettingsState,
  <K extends keyof ChatSettingsState>(k: K, v: ChatSettingsState[K]) => void,
] {
  const [state, setState] = useState<ChatSettingsState>(() => loadSettings());
  const set = <K extends keyof ChatSettingsState>(k: K, v: ChatSettingsState[K]) => {
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
  /**
   * Element that opens the popover. Excluded from the click-outside
   * handler so a second click on it doesn't close-then-immediately-
   * reopen (would otherwise make the trigger look broken).
   */
  triggerRef?: React.RefObject<HTMLElement | null>;
  settings: ChatSettingsState;
  onChange: <K extends keyof ChatSettingsState>(k: K, v: ChatSettingsState[K]) => void;
  /**
   * Optional model label shown as a quiet header inside the popover.
   * Used by BuilderChat to surface "Alfred is on Sonnet 4.6" without
   * a dedicated badge cluttering the chat header row.
   */
  modelLabel?: string;
}

export function ChatSettingsPopover({ open, onClose, triggerRef, settings, onChange, modelLabel }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on click-outside / Escape.
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
      {modelLabel && (
        <div className={styles.modelLine} title="Model is fixed for now">
          <span className={styles.modelLineLabel}>Model</span>
          <span className={styles.modelLineValue}>{modelLabel}</span>
        </div>
      )}
      <ToggleRow
        label="RTL text"
        hint="Right-to-left for Hebrew/Arabic"
        value={settings.rtl}
        onChange={v => onChange('rtl', v)}
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
