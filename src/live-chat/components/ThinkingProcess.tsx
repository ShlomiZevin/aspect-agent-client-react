import type { LiveTurn, ThinkRun } from '../useLiveChat';

interface Props {
  turn: LiveTurn;
  open: boolean;
}

/** Renders one think-run as either key:value rows (plain object) or raw text. */
function RunBody({ run }: { run: ThinkRun }) {
  const po = run.parsedOutput;
  if (po && typeof po === 'object' && !Array.isArray(po)) {
    const entries = Object.entries(po as Record<string, unknown>);
    if (entries.length > 0) {
      return (
        <>
          {entries.map(([k, v]) => (
            <div className="tstep" key={k}>
              <span className="tk">{k}:</span> {renderVal(v)}
            </div>
          ))}
        </>
      );
    }
  }
  const text = run.rawOutput ?? (po !== undefined ? JSON.stringify(po) : '');
  return <div className="tstep">{text}</div>;
}

function renderVal(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/**
 * Debug-only "thinking process" body. Controlled `open` so it can sit
 * BELOW the action row (full width) instead of inside the flex row, and
 * is forced to LTR so the technical key:value view isn't mirrored by RTL.
 */
export function ThinkingProcess({ turn, open }: Props) {
  return (
    <div className={`think-body ${open ? 'open' : ''}`} dir="ltr">
      {turn.thinkRuns.length === 0 && <div className="tstep">—</div>}
      {turn.thinkRuns.map(run => (
        <div key={run.instanceId}>
          <div className="trun-head">{run.label || run.pluginId}</div>
          <RunBody run={run} />
        </div>
      ))}
    </div>
  );
}
