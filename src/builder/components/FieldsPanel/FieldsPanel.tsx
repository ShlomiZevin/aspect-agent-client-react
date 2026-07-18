/**
 * FieldsPanel — memory view for the agent's fields.
 *
 * Memory is conceptually agent-wide: one conversation memory blob
 * shared by every crew. So the panel ALWAYS shows fields from every
 * crew of the agent. After a Transition Router fires and swaps the
 * active crew, the values captured by the previous crew still appear
 * here — nothing visually "disappears".
 *
 * Behaviour differences between crew view and agent view:
 *   - crewId prop set   → "+ Add field" creates a field in THIS crew
 *                         (falls back to creating an extractor if none
 *                         exists). Used by CrewView.
 *   - crewId prop unset → no "+ Add" button (user picks a crew first).
 *                         Used by AgentView.
 *
 * Editing an existing field always routes to its OWNING crew (from
 * `crewField.crewId`), regardless of which view we were rendered in.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBuilder } from '../../state/BuilderContext';
import { useAgentFields } from '../../state/useAgentFields';
import { useCrewFields } from '../../state/useCrewFields';
import { useFieldnameMentions, type FieldMentionRef } from '../../state/useFieldMentions';
import { useConfirm } from '../Confirm/Confirm';
import { AddFieldModal } from './AddFieldModal';
import { FieldEditorModal } from './FieldEditorModal';
import { WireToCrewModal } from './WireToCrewModal';
import type { CrewField, CrewDomain } from '../../state/useCrewFields';
import type { ID } from '../../types';
import styles from './FieldsPanel.module.css';

/**
 * Pluck the live value of a field from the memory blob. Searches
 * across all domain buckets so we don't have to know which one the
 * extractor used.
 */
function findLiveValue(
  memory: Record<string, Record<string, unknown>>,
  fieldName: string,
): unknown | undefined {
  for (const bucket of Object.values(memory)) {
    if (bucket && Object.prototype.hasOwnProperty.call(bucket, fieldName)) {
      const v = bucket[fieldName];
      if (v !== null && v !== undefined) return v;
    }
  }
  return undefined;
}

function formatLiveValue(v: unknown): string {
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

interface Props {
  agentId: ID;
  /** Owning crew when this panel is rendered inside CrewView.
   *  Absent in AgentView; the "+ Add field" affordance is hidden then. */
  crewId?: ID;
}

const TYPE_LABEL: Record<string, string> = {
  string: 'string',
  int: 'int',
  enum: 'enum',
  boolean: 'bool',
};

const SOURCE_LABEL: Record<string, { label: string; icon: string }> = {
  explicit: { label: 'Explicit', icon: '🗣️' },
  inferred: { label: 'Inferred', icon: '🧐' },
};

export function FieldsPanel({ agentId, crewId }: Props) {
  // Pick the right source: crew view sees agent + this-crew's
  // fields; agent view sees only agent-scoped fields. The hooks
  // own scope filtering — this component doesn't.
  const crewSource = useCrewFields(agentId, crewId ?? '');
  const agentSource = useAgentFields(agentId);
  const { allFields, domains } = crewId ? crewSource : agentSource;
  // Delete works in both view modes: removeField takes the field's own
  // scope + owning crew, so the hook's crewId doesn't matter here.
  const { removeField } = crewSource;
  const confirm = useConfirm();
  // Heuristic {{fieldname:X}} refs — "this addon's prompt likely
  // returns this field" chips next to the structured extractor chips.
  const mentions = useFieldnameMentions(agentId);

  // Same confirm copy + behaviour as the FieldEditorModal's Delete
  // button — this is just a shortcut to it from the row itself.
  const onDeleteField = async (cf: CrewField) => {
    const ok = await confirm({
      title: `Delete field "${cf.field.name || '(unnamed)'}"?`,
      message: 'Removes the field definition and unhooks it from every extractor that references it.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) removeField(cf.scope, cf.ownerCrewId, cf.field.id);
  };

  // Split pinned fields out — they render under a small "Pinned"
  // subheader at the bottom of the panel so org-KB defaults read
  // distinctly from collected fields. The domain groups above
  // filter pinned out.
  const pinnedFields = useMemo(
    () => allFields.filter(cf => cf.field.source === 'pinned'),
    [allFields],
  );
  const collectedDomains = useMemo(() => {
    return domains
      .map(g => ({
        ...g,
        fields: g.fields.filter(cf => cf.field.source !== 'pinned'),
      }))
      .filter(g => g.fields.length > 0);
  }, [domains]);

  const { conversationMemory, previewConversationId, doc } = useBuilder();
  const [addOpen, setAddOpen] = useState(false);
  const [wireOpen, setWireOpen] = useState(false);
  // When the AddFieldModal's "Wire it here" path fires, it carries the
  // colliding field's id up so we open the WireToCrewModal with that
  // field pre-checked — the user lands in the right next step.
  const [wirePreselectId, setWirePreselectId] = useState<ID | null>(null);
  const [editing, setEditing] = useState<CrewField | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Are there any declared agent fields not yet wired to this crew?
  // Drives whether the "+ Wire field" button is offered or hidden —
  // when nothing's left to wire, the button is just noise.
  const hasUnwiredCandidates = useMemo(() => {
    if (!crewId) return false;
    const agent = doc.agents.find(a => a.id === agentId);
    const crew = agent?.crews.find(c => c.id === crewId);
    if (!agent || !crew) return false;
    const wiredHere = new Set<string>();
    for (const a of crew.addons) {
      const cfg = (a.config as { extractsFields?: string[] } | undefined);
      const list = Array.isArray(cfg?.extractsFields) ? cfg!.extractsFields : [];
      for (const id of list) wiredHere.add(id);
    }
    return (agent.fields ?? []).some(f => !wiredHere.has(f.id));
  }, [doc, agentId, crewId]);

  const liveValueByField = useMemo(() => {
    const map: Record<string, unknown> = {};
    if (previewConversationId === null) return map;
    // FieldsPanel only renders facts, so read from the memory section.
    // Thinker output lives in conversationMemory.thinking and is
    // rendered by the Thinking panel below the Cortex instead.
    for (const cf of allFields) {
      const v = findLiveValue(conversationMemory.memory, cf.field.name);
      if (v !== undefined) map[cf.field.name] = v;
    }
    return map;
  }, [conversationMemory, previewConversationId, allFields]);

  // Whether to render a crew chip per field row. Only useful when the
  // agent has more than one crew — otherwise it's noise.
  const showCrewChip = useMemo(() => {
    const agent = doc.agents.find(a => a.id === agentId);
    return (agent?.crews.length ?? 0) > 1;
  }, [doc, agentId]);

  // Enum id → {name, owner, values} lookup so each FieldRow can label
  // an enum-typed field's pill (`enum · <name>`, or `choice · <name>`
  // for a field-owned quick list) and offer the value list in the
  // starting-value editor — without walking doc itself. Computed once
  // at the panel level — list is short and stable per render.
  const enumNameById = useMemo(() => {
    const agent = doc.agents.find(a => a.id === agentId);
    const m = new Map<string, { name: string; ownedBy?: ID; values: string[] }>();
    for (const en of agent?.enums ?? []) {
      m.set(en.id, {
        name: en.name,
        ownedBy: en.ownedByFieldId,
        values: (en.values ?? []).map(v => v?.value).filter((v): v is string => typeof v === 'string' && v.length > 0),
      });
    }
    return m;
  }, [doc, agentId]);

  const toggleCollapse = (key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <>
      <div className={styles.panel}>
        <div className={styles.header}>
          {/* The title doubles as the entry point to the full Fields
              page — standard "click the section header to see all"
              pattern (Spotify, YouTube, GitHub). One affordance per
              role: title navigates, action buttons act. */}
          {(() => {
            const agent = doc.agents.find(a => a.id === agentId);
            const titleNode = (
              <>
                <span className={styles.title}>💾 Memory</span>
                <span className={styles.count}>{allFields.length}</span>
              </>
            );
            return agent ? (
              <Link
                to={`/${agent.slug}/builder/fields`}
                className={styles.titleLink}
                title="Open the full Fields page"
              >
                {titleNode}
              </Link>
            ) : (
              <span className={styles.titleLink}>{titleNode}</span>
            );
          })()}
          <span className={styles.spacer} />
          <div className={styles.headerActions}>
            {crewId && hasUnwiredCandidates && (
              <button
                type="button"
                className={styles.addBtn}
                onClick={() => setWireOpen(true)}
                title="Pick an already-declared agent field to collect in this crew"
              >
                + Wire
              </button>
            )}
            {crewId && (
              <button
                type="button"
                className={styles.addBtn}
                onClick={() => setAddOpen(true)}
                title="Declare a new field and wire it to this crew"
              >
                + Add
              </button>
            )}
          </div>
        </div>

        {/* System-fields visible section retired: the generalized
            "any json key matching a declared field name is auto-written
            to memory" capability covers the same use case. Authors
            declare what they want; the runtime harvests it. */}

        {allFields.length === 0 ? (
          <div className={styles.empty}>
            {crewId
              ? <>No fields yet. Click <strong>+ Add field</strong> — if you don't have a Field Extractor yet, one will be created automatically.</>
              : 'No fields yet. Add one from a crew view.'
            }
          </div>
        ) : (
          <div className={styles.groups}>
            {/* Pinned FIRST — org-level defaults read at a glance
                before the collected fields below them. Uses the same
                FieldRow component as the rest of Memory so a pinned
                field reads as "just a field with a different source".
                FieldRow itself skips the "no extractor" warning for
                pinned fields. */}
            {pinnedFields.length > 0 && (
              <div className={styles.pinnedGroup}>
                <div className={styles.pinnedHeader}>
                  <span className={styles.pinnedHeaderTitle}>🎯 Pinned</span>
                  <span className={styles.pinnedHeaderCount}>{pinnedFields.length}</span>
                </div>
                <div className={styles.list}>
                  {pinnedFields.map(cf => (
                    <FieldRow
                      key={`${cf.crewId}/${cf.field.id}`}
                      cf={cf}
                      onPick={setEditing}
                      onDelete={onDeleteField}
                      liveValue={liveValueByField[cf.field.name]}
                      showCrewChip={showCrewChip}
                      enumNameById={enumNameById}
                      mentions={mentions}
                    />
                  ))}
                </div>
              </div>
            )}
            {collectedDomains
              .filter(g => g.name !== null)
              .map(group => (
                <DomainGroup
                  key={group.name as string}
                  group={group}
                  collapsed={collapsed.has(group.name as string)}
                  onToggle={() => toggleCollapse(group.name as string)}
                  onPick={setEditing}
                  onDelete={onDeleteField}
                  liveValueByField={liveValueByField}
                  showCrewChip={showCrewChip}
                  enumNameById={enumNameById}
                  mentions={mentions}
                />
              ))}
            {collectedDomains
              .filter(g => g.name === null)
              .map(group => (
                <UngroupedFields
                  key="__ungrouped__"
                  group={group}
                  onPick={setEditing}
                  onDelete={onDeleteField}
                  liveValueByField={liveValueByField}
                  showCrewChip={showCrewChip}
                  enumNameById={enumNameById}
                  mentions={mentions}
                />
              ))}
          </div>
        )}
      </div>

      {crewId && (
        <>
          <AddFieldModal
            open={addOpen}
            onClose={() => setAddOpen(false)}
            agentId={agentId}
            crewId={crewId}
            onWireExisting={(fieldId) => {
              setWirePreselectId(fieldId);
              setWireOpen(true);
            }}
          />
          <WireToCrewModal
            open={wireOpen}
            onClose={() => {
              setWireOpen(false);
              setWirePreselectId(null);
            }}
            agentId={agentId}
            crewId={crewId}
            initiallySelectedFieldId={wirePreselectId}
          />
        </>
      )}

      <FieldEditorModal
        crewField={editing}
        onClose={() => setEditing(null)}
        agentId={agentId}
        // The crewId here is the "destination crew" if the user
        // switches scope from agent → crew. CrewView passes its own
        // crew id; AgentView passes '' (Scope dropdown disables the
        // crew option in that case).
        crewId={crewId ?? ''}
      />
    </>
  );
}

interface DomainGroupProps {
  group: CrewDomain;
  collapsed: boolean;
  onToggle: () => void;
  onPick: (cf: CrewField) => void;
  onDelete: (cf: CrewField) => void;
  liveValueByField: Record<string, unknown>;
  showCrewChip: boolean;
  enumNameById: Map<string, { name: string; ownedBy?: ID; values: string[] }>;
  mentions: Map<string, FieldMentionRef[]>;
}

function DomainGroup({
  group, collapsed, onToggle, onPick, onDelete, liveValueByField, showCrewChip, enumNameById, mentions,
}: DomainGroupProps) {
  return (
    <div className={styles.group}>
      <button
        type="button"
        className={styles.groupHeader}
        onClick={onToggle}
      >
        <span className={styles.groupCaret}>{collapsed ? '▸' : '▾'}</span>
        <span className={styles.groupName}>{group.name}</span>
        <span className={styles.groupCount}>{group.fields.length}</span>
      </button>
      {!collapsed && (
        <div className={styles.list}>
          {group.fields.map(cf => (
            <FieldRow
              key={`${cf.crewId}/${cf.field.id}`}
              cf={cf}
              onPick={onPick}
              onDelete={onDelete}
              liveValue={liveValueByField[cf.field.name]}
              showCrewChip={showCrewChip}
              enumNameById={enumNameById}
              mentions={mentions}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface UngroupedProps {
  group: CrewDomain;
  onPick: (cf: CrewField) => void;
  onDelete: (cf: CrewField) => void;
  liveValueByField: Record<string, unknown>;
  showCrewChip: boolean;
  enumNameById: Map<string, { name: string; ownedBy?: ID; values: string[] }>;
  mentions: Map<string, FieldMentionRef[]>;
}

function UngroupedFields({ group, onPick, onDelete, liveValueByField, showCrewChip, enumNameById, mentions }: UngroupedProps) {
  return (
    <div className={styles.ungrouped}>
      <div className={styles.list}>
        {group.fields.map(cf => (
          <FieldRow
            key={`${cf.crewId}/${cf.field.id}`}
            cf={cf}
            onPick={onPick}
            onDelete={onDelete}
            liveValue={liveValueByField[cf.field.name]}
            showCrewChip={showCrewChip}
            enumNameById={enumNameById}
            mentions={mentions}
          />
        ))}
      </div>
    </div>
  );
}

interface FieldRowProps {
  cf: CrewField;
  onPick: (cf: CrewField) => void;
  onDelete: (cf: CrewField) => void;
  liveValue?: unknown;
  showCrewChip: boolean;
  enumNameById: Map<string, { name: string; ownedBy?: ID; values: string[] }>;
  mentions: Map<string, FieldMentionRef[]>;
}

function FieldRow({ cf, onPick, onDelete, liveValue, showCrewChip, enumNameById, mentions }: FieldRowProps) {
  const {
    updateConversationMemoryField, previewConversationId,
    pendingSeeds, setPendingSeed, clearPendingSeed,
  } = useBuilder();
  const src = SOURCE_LABEL[cf.field.source];
  const hasValue = liveValue !== undefined;
  const canClear = hasValue && previewConversationId !== null;
  const isCrewScoped = cf.scope === 'crew';
  const extractorCount = cf.extractors.length;

  // Starting-value staging (#765): editable only while NO preview
  // conversation is active — these are the values the NEXT chat is
  // born with (passed as seedMemory on conversation create). Pinned
  // fields are excluded: their pre-chat value IS the config default
  // (locked until the conversation starts).
  const canSeed = previewConversationId === null && cf.field.source !== 'pinned';
  const seed = canSeed ? pendingSeeds[cf.field.name] : undefined;
  const [editingSeed, setEditingSeed] = useState(false);
  const [seedDraft, setSeedDraft] = useState('');
  const enumValues = cf.field.type === 'enum' && cf.field.enumType
    ? (enumNameById.get(cf.field.enumType)?.values ?? [])
    : [];

  const commitSeedText = () => {
    setEditingSeed(false);
    const raw = seedDraft.trim();
    if (!raw) return;
    let v: unknown = raw;
    if (cf.field.type === 'int') {
      const n = Number(raw);
      v = Number.isFinite(n) ? n : raw;
    } else if (cf.field.type === 'boolean') {
      v = /^(true|1|yes)$/i.test(raw);
    }
    setPendingSeed(cf.field.name, v, cf.field.domain);
  };

  // Heuristic writers: addons whose prompt references this field via
  // {{fieldname:…}} but that don't already extract it structurally.
  const mentionRefs = (mentions.get(cf.field.name) ?? []).filter(
    m => !cf.extractors.some(e => e.instanceId === m.instanceId),
  );

  const onClear = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await updateConversationMemoryField({ field: cf.field.name, clear: true });
  };

  return (
    <div className={styles.row} role="button" tabIndex={0} onClick={() => onPick(cf)}>
      <div className={styles.rowMain}>
        <span className={styles.fieldName}>{cf.field.name || '(unnamed)'}</span>
        {/* Pinned-source badge intentionally NOT shown here — the
            section header ("🎯 PINNED") already groups these rows,
            and the source pill below carries the redundant info. */}
        {isCrewScoped && (
          <span className={styles.scopeBadge} title="Crew-scoped — visible only in this crew">
            🔒 crew
          </span>
        )}
        {hasValue && (
          <span className={styles.liveValue} title="Current value in this conversation">
            = {formatLiveValue(liveValue)}
          </span>
        )}
        {canClear && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={onClear}
            title="Clear current value"
          >
            ✕
          </button>
        )}
        {/* Starting value (#765): staged chip / inline editor while no
            conversation is active. The next chat is born with these. */}
        {canSeed && editingSeed && (
          <span onClick={e => e.stopPropagation()}>
            {cf.field.type === 'enum' && enumValues.length > 0 ? (
              <select
                className={styles.seedInput}
                autoFocus
                value=""
                onChange={e => {
                  if (e.target.value) setPendingSeed(cf.field.name, e.target.value, cf.field.domain);
                  setEditingSeed(false);
                }}
                onBlur={() => setEditingSeed(false)}
              >
                <option value="">pick…</option>
                {enumValues.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            ) : cf.field.type === 'boolean' ? (
              <select
                className={styles.seedInput}
                autoFocus
                value=""
                onChange={e => {
                  if (e.target.value) setPendingSeed(cf.field.name, e.target.value === 'true', cf.field.domain);
                  setEditingSeed(false);
                }}
                onBlur={() => setEditingSeed(false)}
              >
                <option value="">pick…</option>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input
                className={styles.seedInput}
                autoFocus
                value={seedDraft}
                placeholder="starting value…"
                onChange={e => setSeedDraft(e.target.value)}
                onBlur={commitSeedText}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitSeedText();
                  else if (e.key === 'Escape') setEditingSeed(false);
                }}
              />
            )}
          </span>
        )}
        {canSeed && !editingSeed && seed !== undefined && (
          <>
            <button
              type="button"
              className={styles.seedChip}
              onClick={e => {
                e.stopPropagation();
                setSeedDraft(String(seed.value ?? ''));
                setEditingSeed(true);
              }}
              title="The next chat starts with this value — click to change"
            >
              ▶ starts: {formatLiveValue(seed.value)}
            </button>
            <button
              type="button"
              className={styles.clearBtn}
              onClick={e => { e.stopPropagation(); clearPendingSeed(cf.field.name); }}
              title="Remove the starting value"
            >
              ✕
            </button>
          </>
        )}
        {canSeed && !editingSeed && seed === undefined && (
          <button
            type="button"
            className={styles.seedBtn}
            onClick={e => {
              e.stopPropagation();
              setSeedDraft('');
              setEditingSeed(true);
            }}
            title="Set a starting value — the next chat begins with it already filled"
          >
            ▶
          </button>
        )}
        <button
          type="button"
          className={styles.deleteBtn}
          onClick={e => {
            e.stopPropagation();
            onDelete(cf);
          }}
          title="Delete this field"
        >
          🗑
        </button>
      </div>
      <div className={styles.pills}>
        <span
          className={styles.typePill}
          title={(() => {
            if (cf.field.type !== 'enum' || !cf.field.enumType) return undefined;
            const meta = enumNameById.get(cf.field.enumType);
            if (!meta) return `Enum binding "${cf.field.enumType}" is missing from the bible`;
            return meta.ownedBy === cf.field.id
              ? `Quick value list "${meta.name}" (created inline on this field)`
              : `Enum type "${meta.name}"`;
          })()}
        >
          {(() => {
            if (cf.field.type !== 'enum' || !cf.field.enumType) {
              return TYPE_LABEL[cf.field.type] ?? cf.field.type;
            }
            const meta = enumNameById.get(cf.field.enumType);
            if (!meta) return 'enum · (missing)';
            return `${meta.ownedBy === cf.field.id ? 'choice' : 'enum'} · ${meta.name}`;
          })()}
        </span>
        {/* Source pill suppressed for pinned — the "🎯 PINNED"
            section header above already says it; repeating it here
            would be the second of the "twice mentioned" the user
            flagged. Pinned rows therefore wear only the typePill. */}
        {cf.field.source !== 'pinned' && (
          <span className={styles.sourcePill} title={src?.label}>
            {src?.icon ?? ''} {src?.label ?? cf.field.source}
          </span>
        )}
        {cf.field.source === 'pinned' ? (
          // Pinned fields are pre-set at config time — no collector
          // is expected. Skip the "no extractor" warning so the row
          // doesn't carry a false-positive error chip.
          null
        ) : extractorCount === 0 && mentionRefs.length === 0 ? (
          <span
            className={styles.unwired}
            title="No Field Extractor references this field — open the editor to wire one"
          >
            ⚠ no extractor
          </span>
        ) : (
          // List every "Crew → Extractor" pair that extracts this
          // field. The plugin icon prefixes the chip so Vibe vs Field
          // extractors are visually distinguishable at-a-glance.
          // Crew prefix dropped when there's only one crew in the
          // agent (it's just noise then).
          cf.extractors.map(e => (
            <span
              key={e.instanceId}
              className={styles.locationChip}
              title={`Extracted by ${e.crewName} → ${e.label}`}
            >
              <span className={styles.locationChipIcon} aria-hidden>{e.icon}</span>
              {showCrewChip ? `${e.crewName} → ${e.label}` : e.label}
            </span>
          ))
        )}
        {/* Softer "likely written by" chips — the addon's prompt
            references {{fieldname:X}}, which almost always means it
            was asked to RETURN that attribute (auto-harvested into
            this field). Heuristic, hence the dashed styling. */}
        {cf.field.source !== 'pinned' && mentionRefs.map(m => (
          <span
            key={`mention-${m.instanceId}`}
            className={styles.mentionChip}
            title={`Prompt references {{fieldname:${cf.field.name}}} — likely returns this field. (${m.crewName ? `${m.crewName} → ` : ''}${m.label})`}
          >
            <span className={styles.locationChipIcon} aria-hidden>{m.icon}</span>
            {showCrewChip && m.crewName ? `${m.crewName} → ${m.label}` : m.label}
          </span>
        ))}
      </div>
      {cf.field.howToExtract && (
        <span className={styles.desc}>{cf.field.howToExtract}</span>
      )}
    </div>
  );
}
