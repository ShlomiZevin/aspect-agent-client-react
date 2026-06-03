/**
 * SchemaPanel — agent-level schema editor.
 *
 * Stacks four sections in the AgentView sidebar:
 *   1. Parameters       — static agent-wide values (`agent.parameters`)
 *   2. Dynamic context  — value-switched prompts (`agent.dynamicContexts`)
 *   3. Domains          — declared memory groupings (`agent.domains`)
 *   4. Fields           — agent-level field declarations (`agent.fields`)
 *
 * Runtime impact: zero from raw schema. Dynamic Context is the only
 * section with runtime effects — but only when its tokens are referenced
 * inside an addon's prompt. Inert otherwise.
 */

import { useMemo, useState } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import { useAgentFields } from '../../state/useAgentFields';
import { DomainModal } from './DomainModal';
import { ParameterModal } from './ParameterModal';
import { SchemaFieldModal } from './SchemaFieldModal';
import { WireFieldModal } from './WireFieldModal';
import { DynamicContextModal } from './DynamicContextModal';
import type { DynamicContextDef, FieldDef, ID, ParameterDef } from '../../types';
import styles from './SchemaPanel.module.css';

interface Props {
  agentId: ID;
}

export function SchemaPanel({ agentId }: Props) {
  // DC editor is owned here so both DynamicContextsSection AND
  // FieldsSection can open it. From the DCs section the user opens
  // an existing DC; from a Field row, the cross-link 🎯 chip opens
  // the DC attached to that field.
  const [dcModalOpen, setDcModalOpen] = useState(false);
  const [dcInitial,    setDcInitial]    = useState<DynamicContextDef | null>(null);
  const openDcAdd  = () => { setDcInitial(null); setDcModalOpen(true); };
  const openDcEdit = (dc: DynamicContextDef) => { setDcInitial(dc); setDcModalOpen(true); };

  return (
    <div className={styles.stack}>
      <ParametersSection agentId={agentId} />
      <DynamicContextsSection
        agentId={agentId}
        openAdd={openDcAdd}
        openEdit={openDcEdit}
      />
      <DomainsSection agentId={agentId} />
      <FieldsSection agentId={agentId} openDcEdit={openDcEdit} />
      <DynamicContextModal
        open={dcModalOpen}
        onClose={() => setDcModalOpen(false)}
        agentId={agentId}
        initial={dcInitial}
      />
    </div>
  );
}

/* ─── Dynamic Context ─────────────────────────────────────────── */

function DynamicContextsSection({
  agentId, openAdd, openEdit,
}: {
  agentId: ID;
  openAdd: () => void;
  openEdit: (dc: DynamicContextDef) => void;
}) {
  const { doc } = useBuilder();
  const agent = doc.agents.find(a => a.id === agentId);
  const dcs = useMemo(() => agent?.dynamicContexts ?? [], [agent?.dynamicContexts]);

  const fieldNameById = useMemo(() => {
    const map = new Map<string, { name: string; type: string }>();
    for (const f of agent?.fields ?? []) map.set(f.id, { name: f.name, type: f.type });
    return map;
  }, [agent?.fields]);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>🎯 Dynamic context</span>
        <span className={styles.count}>{dcs.length}</span>
        <span className={styles.spacer} />
        <button type="button" className={styles.addBtn} onClick={openAdd}>
          + Add
        </button>
      </div>

      {dcs.length === 0 ? (
        <div className={styles.empty}>
          Switch a chunk of prompt text based on a memory field's current value.
          Authored once at agent level, dropped into any prompt via
          <code> {'{{dynamic:fieldname}}'}</code>.
        </div>
      ) : (
        <div className={styles.paramList}>
          {dcs.map(dc => {
            const field = fieldNameById.get(dc.fieldId);
            const caseCount = Array.isArray(dc.cases) ? dc.cases.length : 0;
            return (
              <button
                key={dc.id}
                type="button"
                className={styles.paramRow}
                onClick={() => openEdit(dc)}
              >
                <div className={styles.paramHead}>
                  <span className={styles.paramName}>
                    {field?.name ?? '(field deleted)'}
                  </span>
                  <span className={styles.paramSigil}>· {field?.type ?? '?'}</span>
                  <span className={styles.spacerInline} />
                  <span className={styles.paramSigil}>
                    {caseCount} case{caseCount === 1 ? '' : 's'}
                  </span>
                </div>
                {field && (
                  <span className={styles.paramDesc}>
                    Reference as <code>{`{{dynamic:${field.name}}}`}</code>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Domains ─────────────────────────────────────────────────── */

function DomainsSection({ agentId }: { agentId: ID }) {
  const { doc, updateAgent, renameAgentDomain } = useBuilder();
  const agent = doc.agents.find(a => a.id === agentId);
  const declared = useMemo(() => agent?.domains ?? [], [agent?.domains]);
  const allFields = useMemo(() => {
    if (!agent) return [];
    return [...agent.fields, ...agent.crews.flatMap(c => c.fields)];
  }, [agent]);

  // Merge declared domains with any in-use-but-undeclared domains so
  // the user always sees a complete picture. Undeclared domains are
  // shown but can't be deleted (they come from the fields themselves).
  const inUse = useMemo(() => {
    const set = new Set<string>();
    for (const f of allFields) if (f.domain) set.add(f.domain);
    return set;
  }, [allFields]);

  const allNames = useMemo(() => {
    const set = new Set<string>(declared);
    for (const n of inUse) set.add(n);
    return Array.from(set).sort();
  }, [declared, inUse]);

  const usageCount = (name: string) =>
    allFields.filter(f => f.domain === name).length;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (name: string) => { setEditing(name); setModalOpen(true); };

  const handleSave = (newName: string) => {
    // Add: push the new declared name. Rename: cascade through declared
    // list AND every field's `domain` (agent + every crew) via the
    // atomic helper in BuilderContext.
    if (editing === null) {
      if (!declared.includes(newName)) {
        updateAgent(agentId, { domains: [...declared, newName].sort() });
      }
    } else if (newName !== editing) {
      renameAgentDomain(agentId, editing, newName);
    }
    setModalOpen(false);
  };

  const handleDelete = () => {
    if (editing === null) return;
    updateAgent(agentId, { domains: declared.filter(d => d !== editing) });
    setModalOpen(false);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>🗂 Domains</span>
        <span className={styles.count}>{allNames.length}</span>
        <span className={styles.spacer} />
        <button type="button" className={styles.addBtn} onClick={openAdd}>
          + Add
        </button>
      </div>

      {allNames.length === 0 ? (
        <div className={styles.empty}>
          Declare a domain (e.g. <strong>customer</strong>) to pre-shape your schema.
          Fields can be slotted into it as you build.
        </div>
      ) : (
        <div className={styles.chipGrid}>
          {allNames.map(name => {
            const count = usageCount(name);
            return (
              <button
                key={name}
                type="button"
                className={styles.chip}
                onClick={() => openEdit(name)}
                title={
                  declared.includes(name)
                    ? `Declared domain · ${count} field(s)`
                    : `In use by ${count} field(s) but not declared`
                }
              >
                {name}
                {count > 0 && <span className={styles.chipCount}>· {count}</span>}
              </button>
            );
          })}
        </div>
      )}

      <DomainModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialName={editing}
        existing={declared}
        usageCount={editing ? usageCount(editing) : 0}
        onSave={handleSave}
        onDelete={editing !== null && declared.includes(editing) ? handleDelete : undefined}
      />
    </div>
  );
}

/* ─── Parameters ──────────────────────────────────────────────── */

function ParametersSection({ agentId }: { agentId: ID }) {
  const { doc, updateAgent } = useBuilder();
  const agent = doc.agents.find(a => a.id === agentId);
  const parameters = useMemo(() => agent?.parameters ?? [], [agent?.parameters]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ParameterDef | null>(null);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (p: ParameterDef) => { setEditing(p); setModalOpen(true); };

  const handleSave = (next: ParameterDef) => {
    const exists = parameters.some(p => p.id === next.id);
    const nextList = exists
      ? parameters.map(p => (p.id === next.id ? next : p))
      : [...parameters, next];
    updateAgent(agentId, { parameters: nextList });
    setModalOpen(false);
  };

  const handleDelete = () => {
    if (!editing) return;
    updateAgent(agentId, { parameters: parameters.filter(p => p.id !== editing.id) });
    setModalOpen(false);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>⚙️ Parameters</span>
        <span className={styles.count}>{parameters.length}</span>
        <span className={styles.spacer} />
        <button type="button" className={styles.addBtn} onClick={openAdd}>
          + Add
        </button>
      </div>

      {parameters.length === 0 ? (
        <div className={styles.empty}>
          Static values that don't change per conversation
          (e.g. <code>bankName</code>, <code>supportPhone</code>).
          Reference them in prompts as <code>#name</code>.
        </div>
      ) : (
        <div className={styles.paramList}>
          {parameters.map(p => (
            <button
              key={p.id}
              type="button"
              className={styles.paramRow}
              onClick={() => openEdit(p)}
            >
              <div className={styles.paramHead}>
                <span className={styles.paramSigil}>#</span>
                <span className={styles.paramName}>{p.name}</span>
              </div>
              <span className={styles.paramValue} title={p.value}>
                {p.value || <em>(empty)</em>}
              </span>
              {p.description && (
                <span className={styles.paramDesc}>{p.description}</span>
              )}
            </button>
          ))}
        </div>
      )}

      <ParameterModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={editing}
        siblings={parameters}
        onSave={handleSave}
        onDelete={editing ? handleDelete : undefined}
      />
    </div>
  );
}

/* ─── Fields (agent-level declarations) ──────────────────────── */

function FieldsSection({
  agentId, openDcEdit,
}: {
  agentId: ID;
  openDcEdit: (dc: DynamicContextDef) => void;
}) {
  const { allFields } = useAgentFields(agentId);
  const {
    doc,
    conversationMemory,
    previewConversationId,
    updateConversationMemoryField,
  } = useBuilder();
  const agent = doc.agents.find(a => a.id === agentId);
  const dcByFieldId = useMemo(() => {
    const map = new Map<string, DynamicContextDef>();
    for (const dc of agent?.dynamicContexts ?? []) map.set(dc.fieldId, dc);
    return map;
  }, [agent?.dynamicContexts]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FieldDef | null>(null);
  const [wiringField, setWiringField] = useState<FieldDef | null>(null);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (f: FieldDef) => { setEditing(f); setModalOpen(true); };
  const openWire = (f: FieldDef) => setWiringField(f);

  // Live value lookup — only meaningful when a preview conversation
  // exists. The same brain section logic FieldsPanel uses: search
  // every domain bucket for a non-null/undefined entry under the name.
  const liveValueByField = useMemo(() => {
    const map: Record<string, unknown> = {};
    if (previewConversationId === null) return map;
    for (const bucket of Object.values(conversationMemory.memory)) {
      if (!bucket) continue;
      for (const [name, v] of Object.entries(bucket)) {
        if (v !== null && v !== undefined && !(name in map)) map[name] = v;
      }
    }
    return map;
  }, [conversationMemory, previewConversationId]);

  const onClearLive = async (name: string) => {
    await updateConversationMemoryField({ field: name, clear: true });
  };

  // Group by domain for at-a-glance scanning. Undeclared / domain-less
  // fields land in an "ungrouped" bucket at the bottom.
  const grouped = useMemo(() => {
    const byDomain = new Map<string, FieldDef[]>();
    const orphan: FieldDef[] = [];
    for (const cf of allFields) {
      const d = cf.field.domain?.trim();
      if (d) {
        if (!byDomain.has(d)) byDomain.set(d, []);
        byDomain.get(d)!.push(cf.field);
      } else {
        orphan.push(cf.field);
      }
    }
    return {
      groups: Array.from(byDomain.entries()).sort(([a], [b]) => a.localeCompare(b)),
      orphan,
    };
  }, [allFields]);

  const extractorCountFor = (fieldId: ID): number => {
    const cf = allFields.find(x => x.field.id === fieldId);
    return cf?.extractors.length ?? 0;
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>🏷 Fields</span>
        <span className={styles.count}>{allFields.length}</span>
        <span className={styles.spacer} />
        <button type="button" className={styles.addBtn} onClick={openAdd}>
          + Declare
        </button>
      </div>

      {allFields.length === 0 ? (
        <div className={styles.empty}>
          Declare agent-wide fields here. They stay inert until you wire them
          to an extractor inside a crew.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {grouped.groups.map(([domainName, list]) => (
            <FieldsGroup
              key={domainName}
              label={domainName}
              fields={list}
              onPick={openEdit}
              onWire={openWire}
              extractorCountFor={extractorCountFor}
              liveValueByField={liveValueByField}
              canClearLive={previewConversationId !== null}
              onClearLive={onClearLive}
              dcByFieldId={dcByFieldId}
              onOpenDc={openDcEdit}
            />
          ))}
          {grouped.orphan.length > 0 && (
            <FieldsGroup
              label="(no domain)"
              fields={grouped.orphan}
              onPick={openEdit}
              onWire={openWire}
              extractorCountFor={extractorCountFor}
              liveValueByField={liveValueByField}
              canClearLive={previewConversationId !== null}
              dcByFieldId={dcByFieldId}
              onOpenDc={openDcEdit}
              onClearLive={onClearLive}
            />
          )}
        </div>
      )}

      <SchemaFieldModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        agentId={agentId}
        initial={editing}
      />
      <WireFieldModal
        open={wiringField !== null}
        onClose={() => setWiringField(null)}
        agentId={agentId}
        field={wiringField}
      />
    </div>
  );
}

function formatLiveValue(v: unknown): string {
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

function FieldsGroup({
  label, fields, onPick, onWire, extractorCountFor,
  liveValueByField, canClearLive, onClearLive,
  dcByFieldId, onOpenDc,
}: {
  label: string;
  fields: FieldDef[];
  onPick: (f: FieldDef) => void;
  onWire: (f: FieldDef) => void;
  extractorCountFor: (id: ID) => number;
  liveValueByField: Record<string, unknown>;
  canClearLive: boolean;
  onClearLive: (name: string) => Promise<void> | void;
  dcByFieldId: Map<string, DynamicContextDef>;
  onOpenDc: (dc: DynamicContextDef) => void;
}) {
  return (
    <div>
      <div className={styles.label} style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {fields.map(f => {
          const n = extractorCountFor(f.id);
          const live = liveValueByField[f.name];
          const hasValue = live !== undefined;
          const hasDc = dcByFieldId.has(f.id);
          return (
            <div
              key={f.id}
              className={styles.fieldRow}
            >
              {/* Top row: name + action — name leads, Wire stays anchored
                * to the right. Live value / clear / DC chip live on the
                * name line because they relate to the field's identity. */}
              <div className={styles.fieldRowTop}>
                <button
                  type="button"
                  onClick={() => onPick(f)}
                  className={styles.fieldRowName}
                  title="Edit this field's shape"
                >
                  {f.name}
                </button>
                {hasValue && (
                  <span className={styles.liveChip} title="Current value in this preview conversation">
                    = {formatLiveValue(live)}
                  </span>
                )}
                {hasValue && canClearLive && (
                  <button
                    type="button"
                    onClick={() => onClearLive(f.name)}
                    className={styles.clearBtn}
                    title="Clear this field's current value"
                  >
                    ✕
                  </button>
                )}
                <span className={styles.spacerInline} />
                <button
                  type="button"
                  onClick={() => onWire(f)}
                  className={styles.fieldRowWire}
                  title="Pick which crew(s) should collect this field"
                >
                  Wire
                </button>
              </div>

              {/* Bottom row: small badges (type · status · dc-link). Smaller
                * font, muted colour — secondary information that doesn't
                * compete with the field name for attention. */}
              <div className={styles.fieldRowMeta}>
                <span className={styles.fieldTypePill}>{f.type}</span>
                {n === 0 ? (
                  <span
                    className={styles.fieldStatusUnwired}
                    title="Declared but not collected by any crew yet"
                  >
                    ⚠ unwired
                  </span>
                ) : (
                  <span
                    className={styles.fieldStatusWired}
                    title={`Collected by ${n} extractor${n === 1 ? '' : 's'}`}
                  >
                    ✓ wired · {n}
                  </span>
                )}
                {hasDc && (
                  <button
                    type="button"
                    className={styles.dcChip}
                    onClick={() => onOpenDc(dcByFieldId.get(f.id)!)}
                    title={`Open the Dynamic Context attached to ${f.name}`}
                  >
                    🎯 dynamic
                  </button>
                )}
              </div>

              {f.howToExtract && (
                <span className={styles.paramDesc}>{f.howToExtract}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
