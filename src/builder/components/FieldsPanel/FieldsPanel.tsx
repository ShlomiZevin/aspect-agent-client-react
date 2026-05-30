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
import { useBuilder } from '../../state/BuilderContext';
import { useAgentFields } from '../../state/useAgentFields';
import { useCrewFields } from '../../state/useCrewFields';
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
          <span className={styles.title}>💾 Memory</span>
          <span className={styles.count}>{allFields.length}</span>
          <span className={styles.spacer} />
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

        {allFields.length === 0 ? (
          <div className={styles.empty}>
            {crewId
              ? <>No fields yet. Click <strong>+ Add field</strong> — if you don't have a Field Extractor yet, one will be created automatically.</>
              : 'No fields yet. Add one from a crew view.'
            }
          </div>
        ) : (
          <div className={styles.groups}>
            {domains
              .filter(g => g.name !== null)
              .map(group => (
                <DomainGroup
                  key={group.name as string}
                  group={group}
                  collapsed={collapsed.has(group.name as string)}
                  onToggle={() => toggleCollapse(group.name as string)}
                  onPick={setEditing}
                  liveValueByField={liveValueByField}
                  showCrewChip={showCrewChip}
                />
              ))}
            {domains
              .filter(g => g.name === null)
              .map(group => (
                <UngroupedFields
                  key="__ungrouped__"
                  group={group}
                  onPick={setEditing}
                  liveValueByField={liveValueByField}
                  showCrewChip={showCrewChip}
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
  liveValueByField: Record<string, unknown>;
  showCrewChip: boolean;
}

function DomainGroup({
  group, collapsed, onToggle, onPick, liveValueByField, showCrewChip,
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
              liveValue={liveValueByField[cf.field.name]}
              showCrewChip={showCrewChip}
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
  liveValueByField: Record<string, unknown>;
  showCrewChip: boolean;
}

function UngroupedFields({ group, onPick, liveValueByField, showCrewChip }: UngroupedProps) {
  return (
    <div className={styles.ungrouped}>
      <div className={styles.list}>
        {group.fields.map(cf => (
          <FieldRow
            key={`${cf.crewId}/${cf.field.id}`}
            cf={cf}
            onPick={onPick}
            liveValue={liveValueByField[cf.field.name]}
            showCrewChip={showCrewChip}
          />
        ))}
      </div>
    </div>
  );
}

interface FieldRowProps {
  cf: CrewField;
  onPick: (cf: CrewField) => void;
  liveValue?: unknown;
  showCrewChip: boolean;
}

function FieldRow({ cf, onPick, liveValue, showCrewChip }: FieldRowProps) {
  const { updateConversationMemoryField, previewConversationId } = useBuilder();
  const src = SOURCE_LABEL[cf.field.source];
  const hasValue = liveValue !== undefined;
  const canClear = hasValue && previewConversationId !== null;
  const isCrewScoped = cf.scope === 'crew';
  const extractorCount = cf.extractors.length;

  const onClear = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await updateConversationMemoryField({ field: cf.field.name, clear: true });
  };

  return (
    <div className={styles.row} role="button" tabIndex={0} onClick={() => onPick(cf)}>
      <div className={styles.rowMain}>
        <span className={styles.fieldName}>{cf.field.name || '(unnamed)'}</span>
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
      </div>
      <div className={styles.pills}>
        <span className={styles.typePill}>
          {TYPE_LABEL[cf.field.type] ?? cf.field.type}
        </span>
        <span className={styles.sourcePill} title={src?.label}>
          {src?.icon ?? ''} {src?.label ?? cf.field.source}
        </span>
        {extractorCount === 0 ? (
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
      </div>
      {cf.field.howToExtract && (
        <span className={styles.desc}>{cf.field.howToExtract}</span>
      )}
    </div>
  );
}
