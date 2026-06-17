/**
 * PromptPreviewView — read-only render of an addon's FULL assembled
 * prompt with every `{{}}` token opened:
 *   - static tokens (persona, param, enum, extractor schema…) inlined
 *     and lightly highlighted so you can see where they came from;
 *   - snippets as blocks showing their content AND their `if` (filter);
 *   - dynamic tokens (field / memory / thinking / summary / dc) as
 *     runtime chips — never blank. `dc` opens an in-place branch viewer.
 *
 * Nothing here is editable — it's a preview. Edit in source view.
 */

import { useMemo, useState } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import { getPlugin } from '../../registry/plugins';
import { Modal } from '../Modal/Modal';
import { filterShortSummary } from '../Filter/filterFormat';
import { buildPreviewNodes, type PreviewContext, type PreviewNode } from './previewSegments';
import type { AddonInstance, CrewDoc, EnumTypeDef, FieldDef, ID } from '../../types';
import styles from './PromptPreviewView.module.css';

interface Props {
  instance: AddonInstance;
  /** Live config being edited (preferred over instance.config). */
  config: { prompt?: string } & Record<string, unknown>;
  agentId: ID;
  crewId: ID | null;
  /** Pass the SAME rows + storageKey the sibling MentionTextarea uses so
   *  the preview occupies the exact same pixel height — toggling between
   *  edit and preview never shifts the layout. */
  rows?: number;
  storageKey?: string;
}

// Mirror MentionTextarea's metrics so the preview height matches the
// textarea it replaces (kept in sync with ExpandedPromptView). The whole
// surface (banner + body) is locked to this height; the body scrolls.
const TA_FONT = 12.5;
const TA_LINE = 1.55;
const TA_VPAD = 20;
const TA_BORDER = 2;
const TA_MIN = 110;
const MTA_HEIGHT_KEY_PREFIX = 'mta:height:';

function computeSurfaceHeight(rows: number | undefined, storageKey: string | undefined): number {
  if (storageKey) {
    try {
      const raw = localStorage.getItem(`${MTA_HEIGHT_KEY_PREFIX}${storageKey}`);
      const n = raw ? Number(raw) : NaN;
      if (Number.isFinite(n) && n > 0) return n;
    } catch { /* private mode — fall through */ }
  }
  const r = rows && rows > 0 ? rows : 10;
  return Math.max(TA_MIN, Math.round(r * TA_FONT * TA_LINE) + TA_VPAD + TA_BORDER);
}

const DKIND_META: Record<string, { icon: string; word: string }> = {
  field:    { icon: '🔢', word: 'field' },
  memory:   { icon: '🧠', word: 'memory' },
  thinking: { icon: '💭', word: 'thinking' },
  summary:  { icon: '📊', word: 'summary' },
  dc:       { icon: '🎯', word: 'dc' },
};

export function PromptPreviewView({ instance, config, agentId, crewId, rows, storageKey }: Props) {
  const { doc } = useBuilder();
  const surfaceHeight = useMemo(() => computeSurfaceHeight(rows, storageKey), [rows, storageKey]);
  const agent = doc.agents.find(a => a.id === agentId);
  const crew  = crewId ? agent?.crews.find(c => c.id === crewId) ?? null : null;
  const [dcView, setDcView] = useState<{ field: string; section?: string } | null>(null);
  const [fieldView, setFieldView] = useState<string | null>(null);
  const open = useMemo<OpenHandlers>(() => ({ dc: setDcView, field: setFieldView }), []);

  const ctx = useMemo<PreviewContext | null>(() => {
    if (!agent) return null;
    const plugin = getPlugin(instance.pluginId);
    const agentFields = agent.fields ?? [];
    const crewFields  = crew?.fields ?? [];
    const fieldPool   = [...agentFields, ...crewFields];
    const extractsIds = Array.isArray((config as { extractsFields?: ID[] }).extractsFields)
      ? (config as { extractsFields?: ID[] }).extractsFields!
      : [];
    const extractorFields = extractsIds
      .map(id => fieldPool.find(f => f.id === id))
      .filter((f): f is FieldDef => !!f);
    return {
      instance,
      config,
      pluginFieldMode: plugin?.fieldMode,
      personas:   agent.personas ?? [],
      parameters: agent.parameters ?? [],
      enums:      agent.enums ?? [],
      fieldPool,
      extractorFields,
      snippets:   agent.snippets ?? [],
    };
  }, [agent, crew, instance, config]);

  const nodes = useMemo(
    () => (ctx ? buildPreviewNodes(ctx, filterShortSummary) : []),
    [ctx],
  );

  if (!agent || !ctx) return null;

  return (
    <div className={styles.surface} style={{ height: surfaceHeight }} role="region" aria-label="Full prompt preview (read-only)">
      <div className={styles.banner}>
        <span aria-hidden>👁</span>
        <span>Full prompt — read-only. Static tokens are filled in; runtime tokens show as chips.</span>
      </div>
      <div className={styles.body}>
        {nodes.length === 0
          ? <span className={styles.empty}>(prompt is empty)</span>
          : nodes.map((n, i) => <NodeView key={i} node={n} open={open} />)}
      </div>

      {dcView && (
        <Modal open onClose={() => setDcView(null)} width={620}
          title={`🎯 dc: ${dcView.field}`} badge="runtime branch">
          <DcViewer field={dcView.field} section={dcView.section}
            fieldPool={ctx.fieldPool} enums={ctx.enums} />
        </Modal>
      )}

      {fieldView && (
        <Modal open onClose={() => setFieldView(null)} width={560}
          title={`🔢 field: ${fieldView}`} badge="runtime value">
          <FieldViewer
            name={fieldView}
            agentFields={agent.fields ?? []}
            crew={crew}
            enums={ctx.enums}
          />
        </Modal>
      )}
    </div>
  );
}

interface OpenHandlers {
  dc: (v: { field: string; section?: string }) => void;
  field: (name: string) => void;
}

function NodeView({ node, open }: {
  node: PreviewNode;
  open: OpenHandlers;
}) {
  if (node.kind === 'prose') {
    return <span className={styles.prose}>{node.text}</span>;
  }

  if (node.kind === 'static') {
    // Empty static (token resolved to nothing) — show a faint marker so
    // the author knows the token is there but currently empty.
    if (node.children.length === 0) {
      return <span className={styles.staticEmpty} title={`${node.token} → (empty)`} />;
    }
    return (
      <span className={styles.static} title={`from ${node.token}`}>
        {node.children.map((c, i) => <NodeView key={i} node={c} open={open} />)}
      </span>
    );
  }

  if (node.kind === 'snippet') {
    if (node.missing) {
      return (
        <span className={`${styles.snippet} ${styles.snippetMissing}`} title={`No snippet "${node.name}"`}>
          <span className={styles.snippetHead}>
            <span className={styles.snippetSigil}>+</span>
            <span className={styles.snippetName}>{node.name}</span>
            <span className={styles.snippetFilter}>{node.filterText}</span>
          </span>
        </span>
      );
    }
    return (
      <span className={`${styles.snippet} ${node.gated ? styles.snippetGated : styles.snippetOpen}`}>
        <span className={styles.snippetHead}>
          <span className={styles.snippetSigil}>+</span>
          <span className={styles.snippetName}>{node.name}</span>
          <span className={`${styles.snippetFilter} ${node.gated ? styles.snippetFilterGated : ''}`}>
            {node.gated ? '⎇ ' : ''}{node.filterText}
          </span>
        </span>
        <span className={styles.snippetBody}>
          {node.children.length === 0
            ? <span className={styles.snippetEmpty}>(empty)</span>
            : node.children.map((c, i) => <NodeView key={i} node={c} open={open} />)}
        </span>
      </span>
    );
  }

  // dynamic
  const meta = DKIND_META[node.dkind] ?? { icon: '⏱', word: node.dkind };
  const label = node.label ? `${meta.word}: ${node.label}` : meta.word;
  if (node.dkind === 'dc') {
    return (
      <button
        type="button"
        className={`${styles.chip} ${styles.chipDc}`}
        onClick={() => open.dc({ field: node.field ?? '', section: node.section })}
        title="Resolved at runtime from the field's value — click to view the branches"
      >
        <span aria-hidden>{meta.icon}</span> {label}{node.section ? ` · ${node.section}` : ''} <span className={styles.chipRt}>view ↗</span>
      </button>
    );
  }
  if (node.dkind === 'field') {
    return (
      <button
        type="button"
        className={`${styles.chip} ${styles.chipField}`}
        onClick={() => open.field(node.label)}
        title="Filled at runtime with this field's value — click to view the field"
      >
        <span aria-hidden>{meta.icon}</span> {label} <span className={styles.chipRt}>view ↗</span>
      </button>
    );
  }
  return (
    <span className={styles.chip} title="Filled at runtime">
      <span aria-hidden>{meta.icon}</span> {label} <span className={styles.chipRt}>runtime</span>
    </span>
  );
}

// ─── dc branch viewer (in-place) ────────────────────────────────────

function DcViewer({ field, section, fieldPool, enums }: {
  field: string;
  section?: string;
  fieldPool: FieldDef[];
  enums: EnumTypeDef[];
}) {
  const fieldDef = fieldPool.find(f => f.name === field) ?? null;
  const enumDef = fieldDef && fieldDef.type === 'enum' && fieldDef.enumType
    ? enums.find(e => e.id === fieldDef.enumType) ?? null
    : null;

  if (!fieldDef) {
    return <div className={styles.dcMsg}>No field named <code>{field}</code> is declared on this agent.</div>;
  }
  if (!enumDef) {
    return <div className={styles.dcMsg}>Field <code>{field}</code> isn’t wired to an enum, so <code>{`{{dc:${field}}}`}</code> can’t resolve.</div>;
  }

  const wanted = section === '*' ? '*' : (section ?? null);

  return (
    <div className={styles.dc}>
      <div className={styles.dcIntro}>
        At runtime this resolves to whatever value <code>{field}</code> currently holds on enum
        {' '}<code>{enumDef.name}</code>. One of these branches fires:
      </div>
      <div className={styles.dcList}>
        {enumDef.values.map(v => {
          const blocks: Array<{ label: string; body: string }> = [];
          if (wanted === null) {
            blocks.push({ label: 'umbrella', body: (v.umbrellaText ?? '').trim() });
          } else if (wanted === '*') {
            for (const s of enumDef.sections ?? []) {
              blocks.push({ label: s.name, body: ((v.sectionTexts ?? {})[s.name] ?? '').trim() });
            }
          } else {
            blocks.push({ label: wanted, body: ((v.sectionTexts ?? {})[wanted] ?? '').trim() });
          }
          return (
            <div key={v.id} className={styles.dcBranch}>
              <div className={styles.dcValue}>{v.value}</div>
              {blocks.map((b, i) => (
                <div key={i} className={styles.dcBlock}>
                  {wanted !== null && <div className={styles.dcBlockLabel}>{b.label}</div>}
                  <div className={styles.dcBody}>{b.body || <span className={styles.dcEmpty}>(empty)</span>}</div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── field viewer (in-place) ────────────────────────────────────────

function FieldViewer({ name, agentFields, crew, enums }: {
  name: string;
  agentFields: FieldDef[];
  crew: CrewDoc | null;
  enums: EnumTypeDef[];
}) {
  const inAgent = agentFields.find(f => f.name === name) ?? null;
  const inCrew  = crew?.fields?.find(f => f.name === name) ?? null;
  const f = inAgent ?? inCrew;
  if (!f) {
    return <div className={styles.dcMsg}>No field named <code>{name}</code> is declared on this agent.</div>;
  }
  const scope = inAgent ? 'Agent' : `Crew · ${crew?.name ?? ''}`;
  const enumDef = f.type === 'enum' && f.enumType
    ? enums.find(e => e.id === f.enumType) ?? null
    : null;

  return (
    <div className={styles.fv}>
      <div className={styles.fvIntro}>
        At runtime <code>{`{{field:${name}}}`}</code> is replaced by this field’s current value from memory.
      </div>
      <div className={styles.fvGrid}>
        <FvRow label="Name" value={f.name} mono />
        <FvRow label="Type" value={f.type} />
        <FvRow label="Source" value={f.source} />
        <FvRow label="Scope" value={scope} />
        {f.domain ? <FvRow label="Domain" value={f.domain} /> : null}
        {enumDef ? <FvRow label="Enum" value={enumDef.name} /> : null}
      </div>
      {enumDef && enumDef.values.length > 0 && (
        <div>
          <div className={styles.fvLabel}>Allowed values</div>
          <div className={styles.fvVals}>
            {enumDef.values.map(v => <span key={v.id} className={styles.fvVal}>{v.value}</span>)}
          </div>
        </div>
      )}
      {(f.howToExtract ?? '').trim() && (
        <div>
          <div className={styles.fvLabel}>How to extract</div>
          <div className={styles.fvHow}>{f.howToExtract}</div>
        </div>
      )}
    </div>
  );
}

function FvRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className={styles.fvRow}>
      <span className={styles.fvRowLabel}>{label}</span>
      <span className={mono ? styles.fvRowValueMono : styles.fvRowValue}>{value}</span>
    </div>
  );
}
