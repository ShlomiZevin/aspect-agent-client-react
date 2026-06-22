/**
 * FieldsScreen — agent-level field editor (the "fields page").
 *
 * Counterpart to the EnumBibleScreen / PersonasScreen: a dedicated
 * page that hosts the list of every declared field on the left + the
 * editor for the active one on the right. Replaces the modal-only
 * editing flow when the author wants to do real schema work
 * (multiple fields in a row, comparing properties across fields, etc).
 *
 *   URL routing
 *     /<agent>/builder/fields
 *     /<agent>/builder/fields/<fieldName>
 *     /<agent>/builder/fields/-/new            ← declare flow
 *
 * The `-/new` form keeps the URL bookmarkable while in the "adding a
 * new field" mode (so a refresh lands you back at "Declare field" if
 * that's what you were doing).
 *
 * Editor body comes from `SchemaFieldEditor` — single source of truth
 * for declaring + editing a field across the builder.
 */

import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBuilder } from '../../state/BuilderContext';
import { SchemaFieldEditor } from '../SchemaPanel/SchemaFieldEditor';
import { SystemFieldsSection } from '../FieldsPanel/SystemFieldsSection';
import type { FieldDef } from '../../types';
import styles from './FieldsScreen.module.css';

/** Sentinel for "no field picked, declaring new" inside URLs. */
const NEW_SENTINEL = '__new__';

export function FieldsScreen() {
  const navigate = useNavigate();
  const { doc, conversationMemory } = useBuilder();
  const agent = doc.agents[0];
  const agentSlug = agent?.slug ?? '';

  const { fieldName: paramName } = useParams<{ fieldName?: string }>();

  const fields = useMemo(() => agent?.fields ?? [], [agent?.fields]);

  // Resolve URL param → active field. `__new__` means we're in
  // declare-new mode (right pane shows the empty editor); a real
  // name resolves to an existing field; nothing means "no selection"
  // and the right pane shows a placeholder.
  const isNewMode = paramName === NEW_SENTINEL;
  const activeField = useMemo<FieldDef | null>(() => {
    if (!paramName || isNewMode) return null;
    return fields.find(f => f.name === paramName) ?? null;
  }, [fields, paramName, isNewMode]);

  // Group fields by domain so a long list reads as a structured map
  // of the schema (matches the SchemaPanel grouping pattern). The
  // user can scan "where does the address stuff live?" without
  // ctrl-F'ing through a flat list.
  const grouped = useMemo(() => {
    const byDomain = new Map<string, FieldDef[]>();
    const orphan: FieldDef[] = [];
    for (const f of fields) {
      const d = f.domain?.trim();
      if (d) {
        if (!byDomain.has(d)) byDomain.set(d, []);
        byDomain.get(d)!.push(f);
      } else {
        orphan.push(f);
      }
    }
    return {
      groups: Array.from(byDomain.entries()).sort((a, b) => a[0].localeCompare(b[0])),
      orphan,
    };
  }, [fields]);

  const urlFields = `/${agentSlug}/builder/fields`;
  const urlField = (name: string) => `${urlFields}/${encodeURIComponent(name)}`;
  const urlNew   = `${urlFields}/${NEW_SENTINEL}`;

  // Callbacks the editor uses to drive navigation. Save → land on
  // the saved field's URL; delete → land on the list; cancel from
  // declare → list; cancel from edit → list.
  const handleAfterSave = (saved: FieldDef) => {
    navigate(urlField(saved.name));
  };
  const handleAfterDelete = () => {
    navigate(urlFields);
  };
  const handleCancel = () => {
    navigate(urlFields);
  };

  if (!agent) {
    return <div className={styles.empty}>Loading agent…</div>;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.crumbs}>
          <button
            type="button"
            className={`${styles.crumb} ${!paramName ? styles.crumbCurrent : ''}`}
            onClick={() => navigate(urlFields)}
          >
            Fields
          </button>
          {activeField && (
            <>
              <span> / </span>
              <span className={`${styles.crumb} ${styles.crumbCurrent}`}>{activeField.name}</span>
            </>
          )}
          {isNewMode && (
            <>
              <span> / </span>
              <span className={`${styles.crumb} ${styles.crumbCurrent}`}>new field</span>
            </>
          )}
        </div>
      </div>

      <div className={styles.split}>
        {/* ── Left: fields list grouped by domain ───────────────── */}
        <div className={styles.listCol}>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => navigate(urlNew)}
          >
            + Declare field
          </button>

          {/* System fields — read-only, sticky top section. Same
              component used in the FieldsPanel + SchemaPanel so the
              user sees the platform-defined names from every angle. */}
          <SystemFieldsSection conversationMemory={conversationMemory} />

          {fields.length === 0 ? (
            <div className={styles.listEmpty}>
              No fields declared yet. Click <strong>+ Declare field</strong> to start.
            </div>
          ) : (
            <div className={styles.groups}>
              {grouped.groups.map(([domainName, list]) => (
                <FieldsGroup
                  key={domainName}
                  domain={domainName}
                  fields={list}
                  activeFieldId={activeField?.id ?? null}
                  onPick={f => navigate(urlField(f.name))}
                />
              ))}
              {grouped.orphan.length > 0 && (
                <FieldsGroup
                  domain={null}
                  fields={grouped.orphan}
                  activeFieldId={activeField?.id ?? null}
                  onPick={f => navigate(urlField(f.name))}
                />
              )}
            </div>
          )}
        </div>

        {/* ── Right: editor pane ────────────────────────────────── */}
        <div className={styles.editorCol}>
          {isNewMode ? (
            <SchemaFieldEditor
              key="new"
              agentId={agent.id}
              initial={null}
              onAfterSave={handleAfterSave}
              onAfterDelete={handleAfterDelete}
              onCancel={handleCancel}
            />
          ) : activeField ? (
            <SchemaFieldEditor
              key={activeField.id}
              agentId={agent.id}
              initial={activeField}
              onAfterSave={handleAfterSave}
              onAfterDelete={handleAfterDelete}
              onCancel={handleCancel}
            />
          ) : (
            <div className={styles.editorEmpty}>
              <div className={styles.editorEmptyHeadline}>Pick a field on the left</div>
              <div className={styles.editorEmptyHint}>
                Or click <strong>+ Declare field</strong> to add a new one.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Fields group (one domain bucket) ─────────────────────────── */

function FieldsGroup({
  domain, fields, activeFieldId, onPick,
}: {
  domain: string | null;
  fields: FieldDef[];
  activeFieldId: string | null;
  onPick: (f: FieldDef) => void;
}) {
  return (
    <div className={styles.group}>
      <div className={styles.groupHeader}>
        <span className={styles.groupName}>
          {domain ?? '(no domain)'}
        </span>
        <span className={styles.groupCount}>{fields.length}</span>
      </div>
      <ul className={styles.groupList}>
        {fields.map(f => {
          const active = f.id === activeFieldId;
          return (
            <li key={f.id}>
              <button
                type="button"
                className={`${styles.row} ${active ? styles.rowActive : ''}`}
                onClick={() => onPick(f)}
              >
                <span className={styles.rowName}>{f.name}</span>
                <span className={styles.rowType}>{f.type}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
