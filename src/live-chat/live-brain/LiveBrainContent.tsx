/**
 * LiveBrainContent — the reusable customer-facing Live Brain body.
 *
 * Renders `config.panels` against the current `values`. This is the
 * integration unit: drop it into SidePanel's `.panel-body` (replacing the
 * placeholder) and feed it a live config + the conversation memory blob.
 * Everything below is presentation only — no data fetching.
 */

import { renderTemplate } from './renderTemplate';
import type { BrainPanel, PanelRuntime, PanelSource, LiveBrainConfig, BrainValues } from './types';
import './liveBrain.css';

function sourceChip(source: PanelSource): string {
  if (source.kind === 'bind') return 'bind';
  return source.output === 'html' ? 'addon · html' : 'addon · text';
}

function footNote(panel: BrainPanel): { label: string; code?: string } | null {
  const { source } = panel;
  if (source.kind === 'bind') return { label: 'reads', code: source.token };
  if (source.output === 'html') {
    const n = panel.schema?.length ?? 0;
    return { label: `template + ${n} values` };
  }
  return null;
}

function KeyValueBody({ runtime }: { runtime: PanelRuntime }) {
  return (
    <div className="lb-kv">
      {(runtime.pairs ?? []).map((p, i) => (
        <div className="lb-row" key={i}>
          <span className="lb-k">{p.k}</span>
          <span className="lb-v">{p.tag ? <span className="lb-tag">{p.v}</span> : p.v}</span>
        </div>
      ))}
    </div>
  );
}

function GoalsBody({ runtime }: { runtime: PanelRuntime }) {
  return (
    <div className="lb-goals">
      {(runtime.goals ?? []).map((g, i) => (
        <div className={`lb-goal ${g.done ? 'on' : ''}`} key={i}>
          <span className="lb-mark" aria-hidden="true">
            {g.done ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5 9-11" /></svg>
            ) : null}
          </span>
          <span className="lb-goal-label">{g.label}</span>
          <span className="lb-state">{g.state}</span>
        </div>
      ))}
    </div>
  );
}

function PanelBody({ panel, runtime }: { panel: BrainPanel; runtime: PanelRuntime }) {
  switch (panel.render) {
    case 'text':
      return <div className="lb-body lb-muted">{runtime.text}</div>;
    case 'keyvalue':
      return <div className="lb-body"><KeyValueBody runtime={runtime} /></div>;
    case 'goals':
      return <div className="lb-body"><GoalsBody runtime={runtime} /></div>;
    case 'html':
      return (
        <div
          className="lb-body"
          // Safe: template is author-approved static HTML; only escaped,
          // schema-validated values are injected. See renderTemplate.ts.
          dangerouslySetInnerHTML={{
            __html: renderTemplate(panel.template ?? '', runtime.values, panel.schema),
          }}
        />
      );
    default:
      return null;
  }
}

function PanelCard({ panel, runtime }: { panel: BrainPanel; runtime: PanelRuntime }) {
  const foot = footNote(panel);
  return (
    <div className="lb-panel">
      <div className="lb-phead">
        {panel.emoji && <span className="lb-emoji" aria-hidden="true">{panel.emoji}</span>}
        <h3>{panel.title}</h3>
        <span className={`lb-chip ${panel.source.kind === 'addon' ? 'addon' : ''}`}>
          {sourceChip(panel.source)}
        </span>
      </div>
      <PanelBody panel={panel} runtime={runtime} />
      {foot && (
        <div className="lb-pfoot">
          {foot.label}
          {foot.code && <code>{foot.code}</code>}
        </div>
      )}
    </div>
  );
}

interface Props {
  config: LiveBrainConfig;
  values: BrainValues;
}

export function LiveBrainContent({ config, values }: Props) {
  return (
    <div className="lb-panels">
      {config.panels.map((panel) => (
        <PanelCard key={panel.id} panel={panel} runtime={values[panel.id] ?? {}} />
      ))}
    </div>
  );
}
