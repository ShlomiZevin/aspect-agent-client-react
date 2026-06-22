/**
 * FieldsScreen — agent-level field editor (the "fields page").
 *
 * Counterpart to the EnumBibleScreen / PersonasScreen: a dedicated
 * page that hosts the list of every declared field on the left + the
 * editor for the active one on the right.
 *
 *   URL routing
 *     /<agent>/builder/fields
 *     /<agent>/builder/fields/<fieldName>
 *
 * Adding a field is a one-click action — `+ Declare field` creates a
 * stub field with a unique placeholder name (`new_field`, `new_field_2`,
 * …), writes it to the doc, and navigates to its edit URL. Same model
 * as the enum + persona pages. The editor pane has no Save button:
 * every input auto-commits on blur (the rename cascade fires from
 * inside `SchemaFieldEditor` when the name commits).
 */

import { useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBuilder } from '../../state/BuilderContext';
import { SchemaFieldEditor } from '../SchemaPanel/SchemaFieldEditor';
import { SystemFieldsSection } from '../FieldsPanel/SystemFieldsSection';
import type { FieldDef } from '../../types';
import styles from './FieldsScreen.module.css';

function newFieldId(): string {
  return `field_${Math.random().toString(36).slice(2, 10)}`;
}

/** Make a unique name in the form `new_field`, `new_field_2`, … so
 *  the auto-create button always lands on a valid (non-colliding)
 *  starting point. Matches the enum/section naming pattern on the
 *  Dynamic Context screen. */
function uniqueFieldName(base: string, existing: ReadonlyArray<FieldDef>): string {
  const taken = new Set(existing.map(f => f.name));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

export function FieldsScreen() {
  const navigate = useNavigate();
  const { doc, conversationMemory, updateAgent } = useBuilder();
  const agent = doc.agents[0];
  const agentSlug = agent?.slug ?? '';

  const { fieldName: paramName } = useParams<{ fieldName?: string }>();

  const fields = useMemo(() => agent?.fields ?? [], [agent?.fields]);

  // Resolve URL param → active field. Unknown name → no selection
  // (right pane shows the "pick a field" placeholder).
  const activeField = useMemo<FieldDef | null>(() => {
    if (!paramName) return null;
    return fields.find(f => f.name === paramName) ?? null;
  }, [fields, paramName]);

  // Group fields by domain so a long list reads as a structured map
  // of the schema (matches the SchemaPanel grouping pattern).
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

  // ── Declare a new field ──────────────────────────────────────
  // Create a stub with a unique placeholder name and route to it.
  // The editor handles every subsequent edit inline so this flow
  // doesn't need its own "declare" form.
  const handleDeclare = useCallback(() => {
    if (!agent) return;
    const name = uniqueFieldName('new_field', fields);
    const stub: FieldDef = {
      id:           newFieldId(),
      name,
      type:         'string',
      source:       'explicit',
      howToExtract: '',
    };
    updateAgent(agent.id, { fields: [...agent.fields, stub] });
    navigate(urlField(name));
  }, [agent, fields, navigate, updateAgent, urlField]);

  // ── Editor callbacks ─────────────────────────────────────────
  const handleAfterRename = useCallback((saved: FieldDef) => {
    navigate(urlField(saved.name));
  }, [navigate, urlField]);

  const handleAfterDelete = useCallback(() => {
    navigate(urlFields);
  }, [navigate, urlFields]);

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
        </div>
      </div>

      <div className={styles.split}>
        {/* ── Left: fields list grouped by domain ───────────────── */}
        <div className={styles.listCol}>
          <button
            type="button"
            className={styles.addBtn}
            onClick={handleDeclare}
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
          {activeField ? (
            <SchemaFieldEditor
              key={activeField.id}
              agentId={agent.id}
              initial={activeField}
              onAfterRename={handleAfterRename}
              onAfterDelete={handleAfterDelete}
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
