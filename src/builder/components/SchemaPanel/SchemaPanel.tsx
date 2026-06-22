/**
 * SchemaPanel — agent-level schema editor.
 *
 * Stacks five sections in the AgentView sidebar:
 *   1. Parameters       — static agent-wide values (`agent.parameters`)
 *   2. Enums            — agent-level value vocabularies (`agent.enums`)
 *   3. Snippets         — reusable prompt content (`agent.snippets`)
 *   4. Domains          — declared memory groupings (`agent.domains`)
 *   5. Fields           — agent-level field declarations (`agent.fields`)
 *
 * Runtime impact: zero from raw schema. The enum bible is the only
 * section with runtime effects — but only when its tokens
 * (`{{enum:…}}` / `{{dc:…}}`) are referenced inside an addon's prompt.
 * Inert otherwise.
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBuilder } from '../../state/BuilderContext';
import { useAgentFields } from '../../state/useAgentFields';
import { DomainModal } from './DomainModal';
import { ParameterModal } from './ParameterModal';
import { WireFieldModal } from './WireFieldModal';
import { SnippetModal } from '../Snippets/SnippetModal';
import { SystemFieldsSection } from '../FieldsPanel/SystemFieldsSection';
import type { EnumTypeDef, FieldDef, ID, ParameterDef, SnippetDef } from '../../types';
import styles from './SchemaPanel.module.css';

export type SchemaSectionKind =
  | 'parameters'
  | 'enums'
  | 'domains'
  | 'fields'
  | 'snippets';

interface Props {
  agentId: ID;
  /** Subset of sections to render. Omit (or pass `undefined`) to
   *  render the default 4-section stack. The Setup-zone modals use
   *  this to focus the panel on one section at a time. */
  sections?: SchemaSectionKind[];
  /** When true the sections drop their own card chrome (panel border,
   *  title text, item count) so they can sit inside a host modal
   *  without doubling up on the framing the modal already provides.
   *  The "+ Add" affordance stays visible. */
  embedded?: boolean;
}

export function SchemaPanel({ agentId, sections, embedded }: Props) {
  const show = (k: SchemaSectionKind) => !sections || sections.includes(k);
  return (
    <div className={styles.stack}>
      {show('parameters') && <ParametersSection agentId={agentId} embedded={embedded} />}
      {show('enums')      && <EnumsSection      agentId={agentId} embedded={embedded} />}
      {show('snippets')   && <SnippetsSection   agentId={agentId} embedded={embedded} />}
      {show('domains')    && <DomainsSection    agentId={agentId} embedded={embedded} />}
      {show('fields')     && <FieldsSection     agentId={agentId} embedded={embedded} />}
    </div>
  );
}

/* ─── Enums (the bible) ───────────────────────────────────────── */

function EnumsSection({ agentId, embedded }: { agentId: ID; embedded?: boolean }) {
  const { doc } = useBuilder();
  const agent = doc.agents.find(a => a.id === agentId);
  const enums = useMemo(() => agent?.enums ?? [], [agent?.enums]);
  const slug = agent?.slug ?? '';

  return (
    <div className={`${styles.panel} ${embedded ? styles.panelEmbedded : ''}`}>
      <div className={`${styles.header} ${embedded ? styles.headerEmbedded : ''}`}>
        {!embedded && <span className={styles.title}>🎯 Enums</span>}
        {!embedded && <span className={styles.count}>{enums.length}</span>}
        <span className={styles.spacer} />
        <Link to={`/${slug}/builder/enums`} className={styles.addBtn}>+ Add</Link>
      </div>

      {enums.length === 0 ? (
        <div className={styles.empty}>
          Shared value vocabularies. Bind a field's type to one and the bible
          drives <code>{'{{enum:…}}'}</code> and <code>{'{{dc:…}}'}</code>.
        </div>
      ) : (
        <div className={styles.paramList}>
          {enums.map((en: EnumTypeDef) => (
            <Link
              key={en.id}
              to={`/${slug}/builder/enums/${encodeURIComponent(en.name)}`}
              className={styles.paramRow}
            >
              <div className={styles.paramHead}>
                <span className={styles.paramName}>{en.name}</span>
                <span className={styles.spacerInline} />
                <span className={styles.paramSigil}>
                  {en.values.length} value{en.values.length === 1 ? '' : 's'}
                </span>
              </div>
              <span className={styles.paramDesc}>
                Reference as <code>{`{{enum:${en.name}}}`}</code>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Domains ─────────────────────────────────────────────────── */

function DomainsSection({ agentId, embedded }: { agentId: ID; embedded?: boolean }) {
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
    <div className={`${styles.panel} ${embedded ? styles.panelEmbedded : ''}`}>
      <div className={`${styles.header} ${embedded ? styles.headerEmbedded : ''}`}>
        {!embedded && <span className={styles.title}>🗂 Domains</span>}
        {!embedded && <span className={styles.count}>{allNames.length}</span>}
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

function ParametersSection({ agentId, embedded }: { agentId: ID; embedded?: boolean }) {
  const { doc, updateAgent, applyTokenRenameCascade } = useBuilder();
  const agent = doc.agents.find(a => a.id === agentId);
  const parameters = useMemo(() => agent?.parameters ?? [], [agent?.parameters]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ParameterDef | null>(null);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (p: ParameterDef) => { setEditing(p); setModalOpen(true); };

  const handleSave = (next: ParameterDef) => {
    // Parameter rename: rewrite {{param:OLDNAME}} tokens across every
    // prompt-text surface BEFORE the parameter list is updated, so
    // the cascade walks the doc with the old name still in place.
    if (editing && editing.name && editing.name !== next.name) {
      applyTokenRenameCascade(agentId, 'param', editing.name, next.name);
    }
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
    <div className={`${styles.panel} ${embedded ? styles.panelEmbedded : ''}`}>
      <div className={`${styles.header} ${embedded ? styles.headerEmbedded : ''}`}>
        {!embedded && <span className={styles.title}>⚙️ Parameters</span>}
        {!embedded && <span className={styles.count}>{parameters.length}</span>}
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

/* ─── Snippets ────────────────────────────────────────────────── */

function SnippetsSection({ agentId, embedded }: { agentId: ID; embedded?: boolean }) {
  const { doc } = useBuilder();
  const agent = doc.agents.find(a => a.id === agentId);
  const snippets = useMemo(() => agent?.snippets ?? [], [agent?.snippets]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<SnippetDef | null>(null);

  const openAdd  = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (s: SnippetDef) => { setEditing(s); setModalOpen(true); };

  return (
    <div className={`${styles.panel} ${embedded ? styles.panelEmbedded : ''}`}>
      <div className={`${styles.header} ${embedded ? styles.headerEmbedded : ''}`}>
        {!embedded && <span className={styles.title}>+ Snippets</span>}
        {!embedded && <span className={styles.count}>{snippets.length}</span>}
        <span className={styles.spacer} />
        <button type="button" className={styles.addBtn} onClick={openAdd}>
          + Add
        </button>
      </div>

      {snippets.length === 0 ? (
        <div className={styles.empty}>
          Reusable, optionally-gated chunks of prompt text. Drop them into any
          prompt as <code>{'{{snippet:name}}'}</code>. A snippet with a filter renders
          only when its conditions match — otherwise the token resolves to empty.
        </div>
      ) : (
        <div className={styles.paramList}>
          {snippets.map(s => {
            const gated = !!s.filter && Array.isArray(s.filter.conditions) && s.filter.conditions.length > 0;
            return (
              <button
                key={s.id}
                type="button"
                className={styles.paramRow}
                onClick={() => openEdit(s)}
              >
                <div className={styles.paramHead}>
                  <span className={styles.paramSigil}>+</span>
                  <span className={styles.paramName}>{s.name}</span>
                  {s.displayName && (
                    <span className={styles.paramSigil}>· {s.displayName}</span>
                  )}
                  <span className={styles.spacerInline} />
                  {gated && (
                    <span
                      className={styles.paramSigil}
                      title={
                        s.filter!.mode === 'exclude'
                          ? `Skip when ${s.filter!.conditions.length} condition(s) match`
                          : `Render when ${s.filter!.conditions.length} condition(s) match`
                      }
                    >
                      ▽ filtered
                    </span>
                  )}
                </div>
                <span className={styles.paramDesc}>
                  Reference as <code>{`{{snippet:${s.name}}}`}</code>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <SnippetModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        agentId={agentId}
        initial={editing}
      />
    </div>
  );
}

/* ─── Fields (agent-level declarations) ──────────────────────── */

function FieldsSection({ agentId, embedded }: { agentId: ID; embedded?: boolean }) {
  const { allFields } = useAgentFields(agentId);
  const {
    doc,
    conversationMemory,
    previewConversationId,
    updateConversationMemoryField,
  } = useBuilder();
  const agent = doc.agents.find(a => a.id === agentId);
  /** Map from field.id → the enum bound to that field via enumType.
   *  Used to render the "🎯 enum" chip on enum-typed fields. */
  const enumByFieldId = useMemo(() => {
    const map = new Map<string, EnumTypeDef>();
    const enumsById = new Map((agent?.enums ?? []).map(e => [e.id, e]));
    for (const f of agent?.fields ?? []) {
      if (f.type !== 'enum' || !f.enumType) continue;
      const en = enumsById.get(f.enumType);
      if (en) map.set(f.id, en);
    }
    return map;
  }, [agent?.fields, agent?.enums]);

  // Fields owned by a Field Reasoner addon — used to render the
  // 🧠 chip. Value carries the crew where the reasoner lives so the
  // tooltip can name it. One field → at most one reasoner (UI enforces
  // it; first-found wins on a hand-edited doc).
  const reasonerByFieldId = useMemo(() => {
    const map = new Map<string, { crewId: ID; crewName: string }>();
    for (const c of agent?.crews ?? []) {
      for (const a of c.addons) {
        if (a.pluginId !== 'field-reasoner') continue;
        const list = (a.config as { extractsFields?: ID[] }).extractsFields ?? [];
        for (const fid of list) {
          if (!map.has(fid)) map.set(fid, { crewId: c.id, crewName: c.name });
        }
      }
    }
    return map;
  }, [agent?.crews]);

  // Field add/edit now navigates to the dedicated Fields page instead
  // of opening a modal. Single source of truth: one place to edit a
  // field, regardless of where you clicked from.
  const navigate = useNavigate();
  const [wiringField, setWiringField] = useState<FieldDef | null>(null);

  const fieldsPagePath = agent?.slug ? `/${agent.slug}/builder/fields` : null;
  const openAdd = () => {
    // The Fields page hosts its own + Declare button that creates the
    // stub and routes to it — keep this entry point dumb and just
    // navigate to the list. Avoids two creation code paths.
    if (!fieldsPagePath) return;
    navigate(fieldsPagePath);
  };
  const openEdit = (f: FieldDef) => {
    if (!fieldsPagePath) return;
    navigate(`${fieldsPagePath}/${encodeURIComponent(f.name)}`);
  };
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
    <div className={`${styles.panel} ${embedded ? styles.panelEmbedded : ''}`}>
      <div className={`${styles.header} ${embedded ? styles.headerEmbedded : ''}`}>
        {!embedded && <span className={styles.title}>🏷 Fields</span>}
        {!embedded && <span className={styles.count}>{allFields.length}</span>}
        <span className={styles.spacer} />
        <button type="button" className={styles.addBtn} onClick={openAdd}>
          + Declare
        </button>
      </div>

      {/* System fields — sticky top section. Always visible so the
          author knows what reserved names exist before typing one
          into the Declare modal. Read-only; the registry owns them. */}
      <SystemFieldsSection conversationMemory={conversationMemory} />

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
              enumByFieldId={enumByFieldId}
              reasonerByFieldId={reasonerByFieldId}
              agentSlug={agent?.slug ?? ''}
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
              enumByFieldId={enumByFieldId}
              reasonerByFieldId={reasonerByFieldId}
              agentSlug={agent?.slug ?? ''}
              onClearLive={onClearLive}
            />
          )}
        </div>
      )}

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
  enumByFieldId, reasonerByFieldId, agentSlug,
}: {
  label: string;
  fields: FieldDef[];
  onPick: (f: FieldDef) => void;
  onWire: (f: FieldDef) => void;
  extractorCountFor: (id: ID) => number;
  liveValueByField: Record<string, unknown>;
  canClearLive: boolean;
  onClearLive: (name: string) => Promise<void> | void;
  enumByFieldId: Map<string, EnumTypeDef>;
  reasonerByFieldId: Map<string, { crewId: ID; crewName: string }>;
  agentSlug: string;
}) {
  return (
    <div>
      <div className={styles.label} style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {fields.map(f => {
          const n = extractorCountFor(f.id);
          const live = liveValueByField[f.name];
          const hasValue = live !== undefined;
          const boundEnum = enumByFieldId.get(f.id) ?? null;
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
                {boundEnum && (
                  <Link
                    to={`/${agentSlug}/builder/enums/${encodeURIComponent(boundEnum.name)}`}
                    className={styles.dcChip}
                    title={`Open the "${boundEnum.name}" enum bible (drives {{dc:${f.name}…}} and {{enum:${boundEnum.name}…}}).`}
                  >
                    🎯 {boundEnum.name}
                  </Link>
                )}
                {reasonerByFieldId.has(f.id) && (
                  <span
                    className={styles.reasonerChip}
                    title={`Populated by a Field Reasoner in crew "${reasonerByFieldId.get(f.id)!.crewName}". Open that crew's chain to edit it.`}
                  >
                    🧠 reasoned
                  </span>
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
