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
  /** Show the per-turn addon timelines in UserChat. Off = plain chat
   *  (messages only) for distraction-free review. Purely visual —
   *  runs still stream and persist; they're just not rendered. */
  showAddonRuns: boolean;
  /** Which run families to show in the timeline (colour-coded). */
  runChain: boolean;
  runBrain: boolean;
  runProfiler: boolean;
}

const STORAGE_KEY = 'builder:chatSettings';

function loadSettings(): ChatSettingsState {
  // Default RTL on — most agents in this builder are Hebrew, and a
  // left-aligned LTR bubble of Hebrew text is hard to read.
  const DEFAULTS: ChatSettingsState = { rtl: true, showAddonRuns: true, runChain: true, runBrain: true, runProfiler: true };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      rtl: parsed.rtl !== false,
      showAddonRuns: parsed.showAddonRuns !== false,
      runChain: parsed.runChain !== false,
      runBrain: parsed.runBrain !== false,
      runProfiler: parsed.runProfiler !== false,
    };
  } catch {
    return DEFAULTS;
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
  /**
   * Show the "Addon activity" toggle. Only UserChat passes this —
   * BuilderChat (Alfred) has no addon timelines, so the row would be
   * dead weight there.
   */
  showAddonRunsToggle?: boolean;
}

export function ChatSettingsPopover({ open, onClose, triggerRef, settings, onChange, modelLabel, showAddonRunsToggle }: PopoverProps) {
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
      {showAddonRunsToggle && (
        <ToggleRow
          label="Addon activity"
          hint="Per-turn timelines between messages"
          value={settings.showAddonRuns}
          onChange={v => {
            onChange('showAddonRuns', v);
            // Turning activity ON shows every family (a clean, all-on start).
            if (v) { onChange('runChain', true); onChange('runBrain', true); onChange('runProfiler', true); }
          }}
        />
      )}
      {showAddonRunsToggle && settings.showAddonRuns && (
        <div className={styles.subGroup}>
          <ToggleRow label="Chat chain" dot="#9aa1ab" value={settings.runChain} onChange={v => onChange('runChain', v)} />
          <ToggleRow label="Live Brain" dot="#E0198A" value={settings.runBrain} onChange={v => onChange('runBrain', v)} />
          <ToggleRow label="Profiler" dot="#7C3AED" value={settings.runProfiler} onChange={v => onChange('runProfiler', v)} />
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  label, hint, value, onChange, dot,
}: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; dot?: string }) {
  return (
    <label className={styles.row}>
      <div className={styles.text}>
        <span className={styles.label}>
          {dot && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: dot, marginInlineEnd: 7, verticalAlign: 'middle' }} />}
          {label}
        </span>
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
