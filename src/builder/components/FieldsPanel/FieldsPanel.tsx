/**
 * FieldsPanel — crew dashboard view of all fields, grouped by domain.
 *
 * Each named domain is its own collapsible group. Domainless fields
 * appear under "(no domain)" at the bottom. Clicking any row opens
 * the field editor modal. + opens the add modal.
 */

import { useMemo, useState } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import { useCrewFields } from '../../state/useCrewFields';
import { AddFieldModal } from './AddFieldModal';
import { FieldEditorModal } from './FieldEditorModal';
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
  crewId: ID;
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
  const { allFields, domains } = useCrewFields(agentId, crewId);
  const { conversationMemory, previewConversationId } = useBuilder();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<CrewField | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Map field name → live value (or undefined). Recomputed when
  // memory or fields change. Empty when there's no active preview
  // conversation; the row simply omits the value chip in that case.
  const liveValueByField = useMemo(() => {
    const map: Record<string, unknown> = {};
    if (previewConversationId === null) return map;
    for (const cf of allFields) {
      const v = findLiveValue(conversationMemory, cf.field.name);
      if (v !== undefined) map[cf.field.name] = v;
    }
    return map;
  }, [conversationMemory, previewConversationId, allFields]);

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
          <button type="button" className={styles.addBtn} onClick={() => setAddOpen(true)}>
            + Add field
          </button>
        </div>

        {allFields.length === 0 ? (
          <div className={styles.empty}>
            No fields yet. Click <strong>+ Add field</strong> — if you don't have a
            Field Extractor yet, one will be created automatically.
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
                />
              ))}
          </div>
        )}
      </div>

      <AddFieldModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        agentId={agentId}
        crewId={crewId}
      />

      <FieldEditorModal
        crewField={editing}
        onClose={() => setEditing(null)}
        agentId={agentId}
        crewId={crewId}
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
}

function DomainGroup({ group, collapsed, onToggle, onPick, liveValueByField }: DomainGroupProps) {
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
              key={cf.field.id}
              cf={cf}
              onPick={onPick}
              liveValue={liveValueByField[cf.field.name]}
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
}

function UngroupedFields({ group, onPick, liveValueByField }: UngroupedProps) {
  return (
    <div className={styles.ungrouped}>
      <div className={styles.list}>
        {group.fields.map(cf => (
          <FieldRow
            key={cf.field.id}
            cf={cf}
            onPick={onPick}
            liveValue={liveValueByField[cf.field.name]}
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
}

function FieldRow({ cf, onPick, liveValue }: FieldRowProps) {
  const { updateConversationMemoryField, previewConversationId } = useBuilder();
  const src = SOURCE_LABEL[cf.field.source];
  const hasValue = liveValue !== undefined;
  const canClear = hasValue && previewConversationId !== null;

  const onClear = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await updateConversationMemoryField({ field: cf.field.name, clear: true });
  };

  // Outer is a div now (not a <button>) so the inner clear button
  // doesn't violate the no-nested-buttons rule.
  return (
    <div className={styles.row} role="button" tabIndex={0} onClick={() => onPick(cf)}>
      <div className={styles.rowMain}>
        <span className={styles.fieldName}>{cf.field.name || '(unnamed)'}</span>
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
        <span className={styles.extractorChip}>{cf.extractorLabel}</span>
      </div>
      {cf.field.howToExtract && (
        <span className={styles.desc}>{cf.field.howToExtract}</span>
      )}
    </div>
  );
}
