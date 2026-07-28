/**
 * ProfilerPanels — the customer-facing Profiler surface. Reuses the SAME
 * shared PanelSurface (Noa design) as the Live Brain; the only additions
 * are the Profiler identity and the Ask Profiler drawer (talk to the
 * profile). Panels render in author order — an author who wants the three
 * "indicators" at the top simply places a bars panel first.
 */

import { useState, useCallback, type ReactNode } from 'react';
import { PanelSurface, type DisplayPanel } from '../../builder/components/LiveBrainScreen/PanelSurface';
import type { ProfilerPanelData, ProfilerAskConfig } from '../../builder/state/builderApi';
import s from './ProfilerPanels.module.css';

interface Props {
  panels: ProfilerPanelData[];
  /** Ask config (enabled + preset chips), or null when Ask is off. */
  ask: ProfilerAskConfig | null;
  /** Ask the profile a question; resolves to the answer text. */
  onAsk: (question: string) => Promise<string>;
  /** Hard-refresh the whole profiler now. */
  onRefresh?: () => void;
  /** True while a refresh is running (spins the icon). */
  refreshing?: boolean;
  /** Closes the drawer — rendered as the surface's own header close. */
  onClose?: () => void;
  /** Builder-only: extra title-row controls (Open / Logs). */
  headerRight?: ReactNode;
  /** Builder-only: per-panel footer (run logs) under each section. */
  footerFor?: (panel: DisplayPanel) => ReactNode;
  /** Builder-only: highlight the panel being edited. */
  selectedId?: string;
}

/** Relative "Updated N ago" label from a timestamp (ms). */
function relUpdated(ms: number): string {
  const secs = Math.floor((Date.now() - ms) / 1000);
  if (secs < 45) return 'Updated just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `Updated ${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `Updated ${hrs}h ago`;
  return `Updated ${Math.round(hrs / 24)}d ago`;
}

export function ProfilerPanels({ panels, ask, onAsk, onRefresh, refreshing, onClose, headerRight, footerFor, selectedId }: Props) {
  const [askOpen, setAskOpen] = useState(false);

  const display: DisplayPanel[] = panels.map(p => ({
    id: p.id,
    title: p.title,
    render: p.render,
    text: p.text,
    values: p.values,
    placement: p.placement,
  }));

  // "Updated N ago" — mocked from the freshest panel's ranAt (relative).
  const lastRan = panels.reduce((m, p) => Math.max(m, p.ranAt ?? 0), 0);
  const updatedLabel = lastRan ? relUpdated(lastRan) : undefined;

  const headerActions = (
    <>
      {onRefresh && (
        <button
          type="button"
          className={`${s.refreshPill} ${refreshing ? s.spinning : ''}`}
          onClick={onRefresh}
          disabled={refreshing}
          title="Refresh profile"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v4h-4" />
          </svg>
          Refresh
        </button>
      )}
      {ask?.enabled && (
        <button type="button" className={s.askBtn} onClick={() => setAskOpen(true)} title="Ask the profile">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.5 8.5 0 0 1-12 7.7L3 21l1.8-6A8.5 8.5 0 1 1 21 11.5z" />
          </svg>
          Ask Profiler
        </button>
      )}
    </>
  );

  return (
    <div className={s.wrap}>
      <PanelSurface
        panels={display}
        icon="👤"
        iconSvg="M30 30 Q40 20 42 30 Q44 40 30 42 Q16 44 14 30 Q12 16 30 14 Q48 12 50 30 Q52 48 30 50 Q8 52 6 30"
        title="Customer Profiler"
        subtitle="Live profile built from the conversation"
        updatedLabel={updatedLabel}
        headerActions={headerActions}
        headerRight={headerRight}
        footerFor={footerFor}
        selectedId={selectedId}
        onClose={onClose}
        emptyLabel="The profile fills in as the conversation unfolds."
      />
      {askOpen && ask?.enabled && (
        <AskDrawer chips={ask.chips} onAsk={onAsk} onClose={() => setAskOpen(false)} />
      )}
    </div>
  );
}

/** The "talk to the profile" drawer: preset chips + free text → a streamed
 *  (here: awaited) answer. Slides up over the panel body. */
function AskDrawer({ chips, onAsk, onClose }: {
  chips: string[];
  onAsk: (q: string) => Promise<string>;
  onClose: () => void;
}) {
  const [input, setInput] = useState('');
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || busy) return;
    setQuestion(trimmed);
    setAnswer(null);
    setErr(null);
    setBusy(true);
    try {
      const a = await onAsk(trimmed);
      setAnswer(a || 'No answer.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ask failed');
    } finally {
      setBusy(false);
    }
  }, [busy, onAsk]);

  const reset = () => { setQuestion(null); setAnswer(null); setErr(null); setInput(''); };

  return (
   <div className={s.askScrim} onClick={onClose}>
    <div className={s.ask} onClick={e => e.stopPropagation()}>
      <div className={s.askHead}>
        <span className={s.askIcon} aria-hidden>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.5 8.5 0 0 1-12 7.7L3 21l1.8-6A8.5 8.5 0 1 1 21 11.5z" />
          </svg>
        </span>
        <div className={s.askTitleWrap}>
          <div className={s.askTitle}>Ask Profiler</div>
          <div className={s.askSub}>The profile can explain itself</div>
        </div>
        <button type="button" className={s.askClose} onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className={s.askBody}>
        {question === null ? (
          <>
            <div className={s.askHint}>
              Ask anything about this profile — why the assistant inferred, classified or highlighted something.
            </div>
            <div className={s.chips}>
              {chips.map((c, i) => (
                <button key={i} type="button" className={s.chip} onClick={() => run(c)}>
                  <span className={s.chipQ}>?</span>{c}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className={s.thread}>
            <div className={s.qBubble}>{question}</div>
            {busy && <div className={s.aBubble}><span className={s.dot} /><span className={s.dot} /><span className={s.dot} /></div>}
            {err && <div className={s.aBubble}>{err}</div>}
            {answer && (
              <div className={s.aBubble}>
                <div className={s.aTag}>PROFILER</div>
                {answer}
              </div>
            )}
            {!busy && <button type="button" className={s.askAnother} onClick={reset}>← Ask another</button>}
          </div>
        )}
      </div>

      <form
        className={s.askInputRow}
        onSubmit={e => { e.preventDefault(); run(input); }}
      >
        <input
          className={s.askInput}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask the profile anything…"
          disabled={busy}
        />
        <button type="submit" className={s.askSend} disabled={busy || !input.trim()} aria-label="Send">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
    </div>
   </div>
  );
}
