/**
 * Builder-side helpers for the Live Brain screen: the render library
 * (options + samples + "what to return" copy snippets) and the preview,
 * which reuses the SHARED surface/templates so the builder preview and
 * the customer chat render identically.
 */

import { useState, type ReactNode } from 'react';
import type { BrainPanel, PanelRender } from '../../types';
import { type PanelValues } from './PanelTemplates';
import { PanelSurface, type DisplayPanel } from './PanelSurface';
import { AddonRunCard, type AddonRunSnapshot } from '../AddonRun/AddonRunCard';
import styles from './LiveBrainScreen.module.css';

// ── Render library ─────────────────────────────────────────────────
export const RENDER_OPTIONS: {
  value: PanelRender;
  label: string;
  hint: string;
  /** The exact shape the LLM must return (shown as an example). */
  returns: string;
  /** A ready-to-paste instruction block for the author's prompt. */
  snippet: string;
}[] = [
  {
    value: 'text', label: 'Text / Markdown', hint: 'Free-form prose — bold, lists, tables.',
    returns: 'Just write the text:\n\nBuild trust first — hold off on tools.',
    snippet: 'Write a short line or two. Output only the text.',
  },
  {
    value: 'html', label: 'HTML', hint: 'Safe HTML — styled cards, custom layout.',
    returns: 'Return a small HTML snippet:\n\n<div style="padding:10px">Build trust first</div>',
    snippet: 'Return one small HTML snippet using inline style="…". No <html>, <head> or <style>, and no code fences.',
  },
  {
    value: 'tags', label: 'Tags', hint: 'Labels; the fitting one(s) highlight.',
    returns: 'Return the label(s) that fit (one or more):\n\n{ "active": ["Worried"] }',
    snippet: 'Return only this: {"active":["the fitting label(s)"]}',
  },
  {
    value: 'fields', label: 'Fields', hint: 'Key→value rows; values fill in.',
    returns: 'Return a value for each field:\n\n{ "Stage": "perimenopause", "Top need": "Sleep" }',
    snippet: 'Return only a JSON object with a short value for each field, like: {"Stage":"…","Top need":"…"}',
  },
  {
    value: 'bars', label: 'Bars', hint: 'Labelled 0–100 meters.',
    returns: 'Return a number 0–100 for each:\n\n{ "Calm": 62, "Anxious": 34 }',
    snippet: 'Return only a JSON object mapping each label to a number from 0 to 100, like: {"Calm":62,"Anxious":34}',
  },
  {
    value: 'cards', label: 'Cards', hint: 'Title + body blocks.',
    returns: 'Return a short note for each card:\n\n{ "Sleep": "Waking at 3am, wants natural options.", "Mood": "Anxious but hopeful." }',
    snippet: 'Return only a JSON object mapping each card title to a short note, like: {"Sleep":"…","Mood":"…"}',
  },
];

export function returnsFor(render: PanelRender): string {
  return RENDER_OPTIONS.find(o => o.value === render)?.returns ?? '';
}
export function snippetFor(render: PanelRender): string {
  return RENDER_OPTIONS.find(o => o.value === render)?.snippet ?? '';
}

/** Sample data so the author sees each template's look before any run. */
export function sampleRuntime(render: PanelRender): PanelValues {
  switch (render) {
    case 'text':
      return { text: '**Right now:** build trust first.\n\n- Hold off on tools\n- Reflect her worry back' };
    case 'html':
      return { text: '<div style="padding:12px 14px;border-radius:12px;background:linear-gradient(135deg,#fce7f3,#ede9fe);color:#6b21a8"><b>Focus right now</b><br/>Build trust first — hold off on tools.</div>' };
    case 'tags':
      return { tags: ['Curious', 'Worried', 'Ready', 'Confused'], active: ['Worried'] };
    case 'fields':
      return { pairs: [
        { k: 'Stage', v: 'perimenopause', tag: true },
        { k: 'Top need', v: 'Sleep' },
        { k: 'Prefers', v: 'Natural approaches' },
      ] };
    case 'bars':
      return { bars: [
        { label: 'Calm', value: 62 },
        { label: 'Anxious', value: 34 },
        { label: 'Hopeful', value: 71 },
      ] };
    case 'cards':
      return { cards: [
        { title: 'Sleep', body: 'Waking at 3am; wants natural options before medication.' },
        { title: 'Mood', body: 'Anxious but hopeful — responds well to reassurance.' },
      ] };
    default:
      return {};
  }
}

/** A stored panel value from the live conversation. */
export interface LivePanelValue { render?: string; text?: string; values?: PanelValues }

/** Map authoring panels + live values (falling back to sample data) into
 *  the render-ready DisplayPanel[] the surfaces consume. Shared by the
 *  inline preview and the full-screen sheet. */
export function buildDisplayPanels(
  panels: BrainPanel[],
  liveValues?: Record<string, LivePanelValue>,
): DisplayPanel[] {
  return panels.map(p => {
    const live = liveValues?.[p.id];
    const isString = p.render === 'text' || p.render === 'html';
    const sample = sampleRuntime(p.render);
    return {
      id: p.id,
      title: p.title,
      render: p.render,
      text: live ? live.text : (isString ? sample.text : undefined),
      values: live ? (live.values as PanelValues) : (isString ? undefined : sample),
    };
  });
}

/**
 * A panel's attached run log. Newest-first; shows only the latest run by
 * default with a tiny "+N more", using the SAME AddonRunCard as the chat.
 */
function PanelLogs({ runs }: { runs: AddonRunSnapshot[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? runs : runs.slice(0, 1);
  return (
    <div className={styles.panelLogs}>
      {visible.map((r, i) => <AddonRunCard key={`${r.instanceId}_${i}`} run={r} />)}
      {runs.length > 1 && (
        <button type="button" className={styles.moreRuns} onClick={() => setShowAll(s => !s)}>
          {showAll ? 'Show less' : `+${runs.length - 1} more`}
        </button>
      )}
    </div>
  );
}

/**
 * The builder preview — the customer surface, fed by the working-copy
 * panels + live values (falling back to sample data), with an optional
 * per-panel run log attached beneath each panel.
 */
export function LiveBrainPreview({ panels, selectedId, liveValues, runsByPanel, showLogs, headerAccessory }: {
  panels: BrainPanel[];
  selectedId?: string;
  liveValues?: Record<string, LivePanelValue>;
  runsByPanel?: Record<string, AddonRunSnapshot[]>;
  showLogs?: boolean;
  headerAccessory?: ReactNode;
}) {
  const display = buildDisplayPanels(panels, liveValues);
  return (
    <PanelSurface
      panels={display}
      selectedId={selectedId}
      headerRight={headerAccessory}
      emptyLabel="No panels yet. Add one to see it here."
      footerFor={showLogs
        ? (p) => {
            const runs = runsByPanel?.[p.id] ?? [];
            return runs.length ? <PanelLogs runs={runs} /> : null;
          }
        : undefined}
    />
  );
}
