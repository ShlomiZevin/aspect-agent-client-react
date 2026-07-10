/**
 * Live Brain — data model (client).
 *
 * A Live Brain is a list of PANELS. A panel is a title + one content
 * SOURCE. A source is either:
 *   - `bind`  — render an existing brain token ({{field:…}} / {{memory:…}}).
 *               No compute; reuses what a Thinker/Extractor already wrote.
 *   - `addon` — a dedicated non-blocking Live-Brain addon computes the
 *               content, producing either `text` or a rich-HTML
 *               { template + typed values } payload.
 *
 * See docs/guides/BUILDER_V2_LIVE_BRAIN.md. This mirrors the (future)
 * server-side type; kept intentionally small for v1.
 */

/** How a panel draws its resolved content. */
export type PanelRender = 'text' | 'keyvalue' | 'goals' | 'html';

/** When a non-blocking addon fires. `client_event:*` includes the manual
 *  panel Refresh. Time/cron triggers are out of v1. */
export type AddonTrigger =
  | 'message_done'
  | `every_n_messages:${number}`
  | `field_set:${string}`
  | `client_event:${string}`;

export type PanelSource =
  | { kind: 'bind'; token: string }
  | {
      kind: 'addon';
      /** Addon output mode. */
      output: 'text' | 'html';
      /** Shown in the setup surface — it's a normal addon envelope. */
      trigger: AddonTrigger;
      model?: string;
      historyLabel?: string;
      reads?: string[];
    };

/** One dynamic slot in a rich-HTML template — the value CONTRACT the
 *  runtime LLM must return. Deterministic inject; never LLM-authored HTML. */
export interface SlotDef {
  name: string;
  type: 'string' | 'int' | 'enum';
  description: string;
  enumValues?: string[];
  /** Rendered when the value is missing/invalid. */
  fallback: string;
}

export interface BrainPanel {
  id: string;
  title: string;
  emoji?: string;
  render: PanelRender;
  source: PanelSource;

  // rich-HTML panels (source.kind === 'addon' && output === 'html'):
  template?: string;
  schema?: SlotDef[];
  fillPrompt?: string;

  /** Author's design-time description (drives the generator / setup view). */
  description?: string;
}

export interface LiveBrainConfig {
  panels: BrainPanel[];
}

// ── Runtime values (what the brain/addons produced this conversation) ──

export interface KeyValueEntry {
  k: string;
  v: string;
  /** Render the value as an accent pill. */
  tag?: boolean;
}

export interface GoalEntry {
  label: string;
  state: string;
  done: boolean;
}

/** One panel's live payload. Only the field matching the panel's render
 *  kind is used. */
export interface PanelRuntime {
  text?: string;
  pairs?: KeyValueEntry[];
  goals?: GoalEntry[];
  /** For `html` panels — the values injected into the template. */
  values?: Record<string, string | number>;
  ranAt?: number;
}

/** Keyed by panel id. */
export type BrainValues = Record<string, PanelRuntime>;
