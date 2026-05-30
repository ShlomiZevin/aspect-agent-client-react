/**
 * SchemaPanel — agent-level schema editor.
 *
 * Stacks four sections in the AgentView sidebar:
 *   1. Parameters — static agent-wide values (`agent.parameters`)
 *   2. Domains    — declared memory groupings (`agent.domains`)
 *   3. Fields     — agent-level field declarations (`agent.fields`)
 *                   added in "schema mode" — no extractor wiring required.
 *                   Fields stay inert until a crew's extractor references
 *                   them. The wiring step happens in the CrewView.
 *   4. Memory     — existing FieldsPanel, kept so the live-value view
 *                   stays available alongside the schema editor.
 *
 * Runtime impact: zero. Declared domains, parameters, and bare field
 * declarations are inert until referenced. Nothing ships them into
 * prompts on its own.
 */

import { useMemo, useState } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import { FieldsPanel } from '../FieldsPanel/FieldsPanel';
import { useAgentFields } from '../../state/useAgentFields';
import { DomainModal } from './DomainModal';
import { ParameterModal } from './ParameterModal';
import { SchemaFieldModal } from './SchemaFieldModal';
import { WireFieldModal } from './WireFieldModal';
import type { FieldDef, ID, ParameterDef } from '../../types';
import styles from './SchemaPanel.module.css';

interface Props {
  agentId: ID;
}

export function SchemaPanel({ agentId }: Props) {
  return (
    <div className={styles.stack}>
      <ParametersSection agentId={agentId} />
      <DomainsSection agentId={agentId} />
      <FieldsSection agentId={agentId} />
      <FieldsPanel agentId={agentId} />
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

function FieldsSection({ agentId }: { agentId: ID }) {
  const { allFields } = useAgentFields(agentId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FieldDef | null>(null);
  const [wiringField, setWiringField] = useState<FieldDef | null>(null);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (f: FieldDef) => { setEditing(f); setModalOpen(true); };
  const openWire = (f: FieldDef) => setWiringField(f);

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
            />
          ))}
          {grouped.orphan.length > 0 && (
            <FieldsGroup
              label="(no domain)"
              fields={grouped.orphan}
              onPick={openEdit}
              onWire={openWire}
              extractorCountFor={extractorCountFor}
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

function FieldsGroup({
  label, fields, onPick, onWire, extractorCountFor,
}: {
  label: string;
  fields: FieldDef[];
  onPick: (f: FieldDef) => void;
  onWire: (f: FieldDef) => void;
  extractorCountFor: (id: ID) => number;
}) {
  return (
    <div>
      <div className={styles.label} style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {fields.map(f => {
          const n = extractorCountFor(f.id);
          return (
            <div
              key={f.id}
              className={styles.paramRow}
              style={{ cursor: 'default' }}
            >
              <div className={styles.paramHead}>
                <button
                  type="button"
                  onClick={() => onPick(f)}
                  className={styles.paramName}
                  style={{
                    background: 'transparent',
                    border: 0,
                    padding: 0,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                  }}
                  title="Edit this field's shape"
                >
                  {f.name}
                </button>
                <span className={styles.paramSigil}>· {f.type}</span>
                <span className={styles.spacerInline} />
                {n === 0 ? (
                  <span
                    className={styles.paramSigil}
                    style={{ color: '#b45309' }}
                    title="Declared but not collected by any crew yet"
                  >
                    ⚠ unwired
                  </span>
                ) : (
                  <span
                    className={styles.paramSigil}
                    title={`Collected by ${n} extractor${n === 1 ? '' : 's'}`}
                  >
                    ✓ {n}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onWire(f)}
                  className={styles.addBtn}
                  style={{ padding: '2px 8px', fontSize: 11 }}
                  title="Pick which crew(s) should collect this field"
                >
                  Wire
                </button>
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
