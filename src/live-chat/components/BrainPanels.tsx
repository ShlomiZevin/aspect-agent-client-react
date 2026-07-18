/**
 * BrainPanels — renders the customer-facing Live Brain panels for the
 * live chat. Consumes the resolved `LiveBrainPanelData[]` from
 * `GET .../live-brain` and draws each by its render type, reusing the
 * `.lybi-chat`-scoped `.lb-*` styles.
 */

import { MarkdownBody } from '../../builder/components/ChatPanel/MarkdownBody';
import type { LiveBrainPanelData } from '../../builder/state/builderApi';
import '../live-brain/liveBrain.css';

const clamp = (n: number) => Math.max(0, Math.min(100, Number(n) || 0));

function KeyValue({ pairs }: { pairs: NonNullable<LiveBrainPanelData['values']>['pairs'] }) {
  return (
    <div className="lb-kv">
      {(pairs ?? []).map((p, i) => (
        <div className="lb-row" key={i}>
          <span className="lb-k">{p.k}</span>
          <span className="lb-v">{p.tag ? <span className="lb-tag">{p.v}</span> : p.v}</span>
        </div>
      ))}
    </div>
  );
}

function Goals({ goals }: { goals: NonNullable<LiveBrainPanelData['values']>['goals'] }) {
  return (
    <div className="lb-goals">
      {(goals ?? []).map((g, i) => (
        <div className={`lb-goal ${g.done ? 'on' : ''}`} key={i}>
          <span className="lb-mark" aria-hidden="true">
            {g.done ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5 9-11" /></svg> : null}
          </span>
          <span className="lb-goal-label">{g.label}</span>
          {g.state ? <span className="lb-state">{g.state}</span> : null}
        </div>
      ))}
    </div>
  );
}

function Bars({ bars }: { bars: NonNullable<LiveBrainPanelData['values']>['bars'] }) {
  return (
    <div className="lb-bars">
      {(bars ?? []).map((b, i) => (
        <div className="lb-bar" key={i}>
          <div className="lb-brow">
            <span className="lb-lab"><i className="lb-sw" style={{ background: b.color || 'var(--mag)' }} />{b.label}</span>
            <span className="lb-num">{b.value}</span>
          </div>
          <div className="lb-track"><div className="lb-fill" style={{ width: `${clamp(b.value)}%`, background: b.color || 'var(--grad)' }} /></div>
        </div>
      ))}
    </div>
  );
}

function Donut({ donut }: { donut: NonNullable<NonNullable<LiveBrainPanelData['values']>['donut']> }) {
  return (
    <div className="lb-needs">
      <div className="lb-donut" style={{ ['--v' as string]: String(clamp(donut.value)) } as React.CSSProperties}>
        <div className="lb-dc"><b>{donut.value}%</b><span>{donut.label}</span></div>
      </div>
      <div className="lb-nlist">
        {donut.items.map((n, i) => (
          <div className="lb-n" key={i}>
            <div className="lb-brow"><span className="lb-lab">{n.label}</span><span className="lb-num">{n.value}%</span></div>
            <div className="lb-track"><div className="lb-fill lb-brandfill" style={{ width: `${clamp(n.value)}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PanelBody({ panel }: { panel: LiveBrainPanelData }) {
  switch (panel.render) {
    case 'text':
      return <div className="lb-body"><MarkdownBody text={panel.text ?? ''} /></div>;
    case 'keyvalue':
      return <KeyValue pairs={panel.values?.pairs} />;
    case 'goals':
      return <Goals goals={panel.values?.goals} />;
    case 'bars':
      return <Bars bars={panel.values?.bars} />;
    case 'donut':
      return panel.values?.donut ? <Donut donut={panel.values.donut} /> : null;
    default:
      return null;
  }
}

export function BrainPanels({ panels }: { panels: LiveBrainPanelData[] }) {
  return (
    <div className="lb-panels">
      {panels.map((p) => (
        <div className="lb-panel" key={p.id}>
          <div className="lb-phead"><h3>{p.title}</h3></div>
          <PanelBody panel={p} />
        </div>
      ))}
    </div>
  );
}
