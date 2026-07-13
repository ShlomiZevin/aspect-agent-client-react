/**
 * Built-in Live Brain panel renderers.
 *
 * Each render type has a FIXED data shape (see `returns` below). A
 * `prompt` source is told to return that shape; a `text` source composes
 * it from free text + `{{tokens}}`. This is the reuse target for the
 * customer surface later — `/:agent/live` renders the same components fed
 * by real runtime values instead of the sample values used here.
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { BrainPanel, PanelRender } from '../../types';
import styles from './LiveBrainScreen.module.css';

// ── Runtime value shapes, one per render type ──────────────────────
export interface PanelRuntime {
  text?: string;
  pairs?: { k: string; v: string; tag?: boolean }[];
  goals?: { label: string; state: string; done: boolean }[];
  bars?: { label: string; value: number; color?: string }[];
  donut?: { value: number; label: string; items: { label: string; value: number }[] };
}

export const RENDER_OPTIONS: {
  value: PanelRender;
  label: string;
  hint: string;
  /** What a prompt must return to fill this renderer (pretty). */
  returns: string;
}[] = [
  {
    value: 'text', label: 'Text / Markdown', hint: 'Plain or rich text — bold, lists, tables.',
    returns: 'Return a plain string. Markdown is rendered (bold, lists, tables).',
  },
  {
    value: 'keyvalue', label: 'Key / value', hint: 'A labelled list of facts.',
    returns: `{
  "pairs": [
    { "k": "Stage", "v": "perimenopause", "tag": true },
    { "k": "Top symptom", "v": "Insomnia" }
  ]
}`,
  },
  {
    value: 'goals', label: 'Checklist', hint: 'Items with a done state + status.',
    returns: `{
  "goals": [
    { "label": "Sleep through the night", "state": "active", "done": true },
    { "label": "Avoid medication", "state": "noted", "done": false }
  ]
}`,
  },
  {
    value: 'bars', label: 'Bars', hint: 'Labelled 0–100 bars (e.g. mood).',
    returns: `{
  "bars": [
    { "label": "Calm", "value": 62 },
    { "label": "Anxious", "value": 34 }
  ]
}`,
  },
  {
    value: 'donut', label: 'Donut + bars', hint: 'A headline ring + a few bars.',
    returns: `{
  "donut": {
    "value": 68,
    "label": "reassurance",
    "items": [
      { "label": "Reassurance", "value": 68 },
      { "label": "Symptom relief", "value": 52 }
    ]
  }
}`,
  },
];

export function returnsFor(render: PanelRender): string {
  return RENDER_OPTIONS.find(o => o.value === render)?.returns ?? '';
}

/** Sample data so the author sees each render type's look in the preview. */
export function sampleRuntime(render: PanelRender): PanelRuntime {
  switch (render) {
    case 'text':
      return { text: '**Right now:** build trust first.\n\n- Hold off on tools\n- Reflect her worry back\n- Offer to log *with* her, not *at* her' };
    case 'keyvalue':
      return { pairs: [
        { k: 'Stage', v: 'perimenopause', tag: true },
        { k: 'Top symptom', v: 'Insomnia' },
        { k: 'Prefers', v: 'Natural approaches' },
        { k: 'Wants me to be', v: 'Reassuring' },
      ] };
    case 'goals':
      return { goals: [
        { label: 'Sleep through the night', state: 'active', done: true },
        { label: "Understand what's normal", state: 'active', done: true },
        { label: 'Avoid medication if possible', state: 'noted', done: false },
      ] };
    case 'bars':
      return { bars: [
        { label: 'Calm', value: 62, color: '#0d8a7d' },
        { label: 'Anxious', value: 34, color: '#d98a2b' },
        { label: 'Hopeful', value: 71, color: '#c65a7d' },
      ] };
    case 'donut':
      return { donut: {
        value: 68, label: 'reassurance',
        items: [
          { label: 'Reassurance', value: 68 },
          { label: 'Symptom relief', value: 52 },
          { label: 'Information', value: 30 },
        ],
      } };
    default:
      return {};
  }
}

function Bars({ bars }: { bars: NonNullable<PanelRuntime['bars']> }) {
  return (
    <div className={styles.bars}>
      {bars.map((b, i) => (
        <div className={styles.bar} key={i}>
          <div className={styles.barRow}>
            <span className={styles.barLab}>
              <i className={styles.swatch} style={{ background: b.color ?? '#6d28d9' }} />
              {b.label}
            </span>
            <span className={styles.barNum}>{b.value}</span>
          </div>
          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${Math.max(0, Math.min(100, b.value))}%`, background: b.color ?? '#6d28d9' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Donut({ donut }: { donut: NonNullable<PanelRuntime['donut']> }) {
  return (
    <div className={styles.needs}>
      <div className={styles.donut} style={{ ['--v' as string]: String(donut.value) } as React.CSSProperties}>
        <div className={styles.donutC}><b>{donut.value}%</b><span>{donut.label}</span></div>
      </div>
      <div className={styles.needList}>
        {donut.items.map((n, i) => (
          <div className={styles.need} key={i}>
            <div className={styles.barRow}>
              <span className={styles.barLab}>{n.label}</span>
              <span className={styles.barNum}>{n.value}%</span>
            </div>
            <div className={styles.track}><div className={styles.fill} style={{ width: `${n.value}%`, background: '#E0198A' }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PanelBody({ panel, runtime }: { panel: BrainPanel; runtime: PanelRuntime }) {
  switch (panel.render) {
    case 'text':
      // Render markdown directly here (not via the chat MarkdownBody,
      // which hard-codes tight chat-bubble spacing) so `.bodyMd` fully
      // owns the panel's typographic rhythm.
      return (
        <div className={styles.bodyMd}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{runtime.text ?? ''}</ReactMarkdown>
        </div>
      );
    case 'keyvalue':
      return (
        <div className={styles.kv}>
          {(runtime.pairs ?? []).map((p, i) => (
            <div className={styles.kvRow} key={i}>
              <span className={styles.kvK}>{p.k}</span>
              <span className={styles.kvV}>{p.tag ? <span className={styles.tag}>{p.v}</span> : p.v}</span>
            </div>
          ))}
        </div>
      );
    case 'goals':
      return (
        <div className={styles.goals}>
          {(runtime.goals ?? []).map((g, i) => (
            <div className={`${styles.goal} ${g.done ? styles.goalOn : ''}`} key={i}>
              <span className={styles.mark} aria-hidden="true">
                {g.done ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5 9-11" /></svg> : null}
              </span>
              <span className={styles.goalLabel}>{g.label}</span>
              <span className={styles.state}>{g.state}</span>
            </div>
          ))}
        </div>
      );
    case 'bars':
      return <Bars bars={runtime.bars ?? []} />;
    case 'donut':
      return runtime.donut ? <Donut donut={runtime.donut} /> : null;
    default:
      return null;
  }
}

function sourceChip(panel: BrainPanel): string {
  return panel.source.kind === 'text' ? 'text' : 'addon';
}

/** The whole customer-facing brain, rendered with sample values. */
export function LiveBrainPreview({ panels, selectedId }: { panels: BrainPanel[]; selectedId?: string }) {
  if (panels.length === 0) {
    return <div className={styles.previewEmpty}>No panels yet. Add one to see it here.</div>;
  }
  return (
    <div className={styles.previewPanels}>
      {panels.map((panel) => (
        <div className={`${styles.previewPanel} ${panel.id === selectedId ? styles.previewPanelSel : ''}`} key={panel.id}>
          <div className={styles.previewHead}>
            <span className={styles.previewTitle}>{panel.title || 'Untitled'}</span>
            <span className={`${styles.previewSourceChip} ${panel.source.kind === 'prompt' ? styles.previewSourceAddon : ''}`}>{sourceChip(panel)}</span>
          </div>
          <PanelBody panel={panel} runtime={sampleRuntime(panel.render)} />
        </div>
      ))}
    </div>
  );
}
