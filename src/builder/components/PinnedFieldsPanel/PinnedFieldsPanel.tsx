/**
 * PinnedFieldsPanel — sidebar panel that lists pinned fields with the
 * same row chrome the Memory (FieldsPanel) sidebar uses.
 *
 * Same visual rhythm as FieldsPanel rows so the author reads "Pinned"
 * as a focused slice of fields — just filtered to `source: 'pinned'`.
 * Used in two places:
 *
 *   - SchemaPanel (agent view) — between Parameters and Targeted KB,
 *     where `embedded` chrome can be off because the SchemaPanel
 *     stacks its own headers.
 *   - CrewView — below the Memory panel, so the per-conversation
 *     pinned-value swap is one click away from the chat.
 *
 * Clicking the row name jumps to the Pinned Fields page for full
 * editing. The row ALSO exposes an inline value-picker so the agent
 * author can swap the default Targeted-KB value without leaving the
 * panel — that's the most frequent edit ("which bank is this agent
 * acting as today?") so it earns a one-click affordance here.
 */

import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBuilder } from '../../state/BuilderContext';
import type { EnumTypeDef, FieldDef, ID } from '../../types';
import styles from './PinnedFieldsPanel.module.css';

interface Props {
  agentId: ID;
}

export function PinnedFieldsPanel({ agentId }: Props) {
  const navigate = useNavigate();
  const { doc, updateAgent } = useBuilder();
  const agent = doc.agents.find(a => a.id === agentId);
  const slug = agent?.slug ?? '';

  const pinnedFields = useMemo<FieldDef[]>(
    () => (agent?.fields ?? []).filter(f => f.source === 'pinned'),
    [agent?.fields],
  );
  const enumsById = useMemo(() => {
    const map = new Map<string, EnumTypeDef>();
    for (const e of agent?.enums ?? []) map.set(e.id, e);
    return map;
  }, [agent?.enums]);

  const commitDefault = useCallback((field: FieldDef, next: string) => {
    if (!agent) return;
    if (next === (field.defaultValue ?? '')) return;
    const fields = agent.fields.map(f =>
      f.id === field.id
        ? { ...f, defaultValue: next || undefined }
        : f,
    );
    updateAgent(agent.id, { fields });
  }, [agent, updateAgent]);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>🎯 Pinned</span>
        <span className={styles.count}>{pinnedFields.length}</span>
        <span className={styles.spacer} />
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => agent && navigate(`/${slug}/builder/pinned`)}
          title="Open the pinned-fields page (wizard + management)"
        >
          + Add
        </button>
      </div>

      {pinnedFields.length === 0 ? (
        <div className={styles.empty}>
          Targeted-KB values set at agent-config time (e.g. which bank
          this agent is acting as). Click <strong>+ Add</strong> to pin one.
        </div>
      ) : (
        <div className={styles.list}>
          {pinnedFields.map(f => {
            const kb = f.enumType ? enumsById.get(f.enumType) : undefined;
            const kbValues = (kb?.values ?? [])
              .map(v => v?.value)
              .filter((v): v is string => typeof v === 'string' && v.length > 0);
            const hasMissingDefault =
              !!f.defaultValue && !kbValues.includes(f.defaultValue);

            // Row chrome matches FieldsPanel rows so a pinned field
            // reads the same in agent view as it does in the crew
            // Memory panel: name on top with the inline value picker
            // beside it, type pill below. We drop the "Pinned" source
            // pill — the section header already says it.
            return (
              <div
                key={f.id}
                className={styles.fieldRow}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/${slug}/builder/pinned`)}
              >
                <div className={styles.fieldRowMain}>
                  <span className={styles.fieldRowName}>{f.name || '(unnamed)'}</span>
                  {kbValues.length > 0 ? (
                    <>
                      <span className={styles.equals}>=</span>
                      <select
                        className={styles.valueSelect}
                        value={f.defaultValue ?? ''}
                        onClick={e => e.stopPropagation()}
                        onMouseDown={e => e.stopPropagation()}
                        onChange={e => {
                          e.stopPropagation();
                          commitDefault(f, e.target.value);
                        }}
                        title="Change the pinned default value"
                      >
                        {!f.defaultValue && <option value="">— pick —</option>}
                        {kbValues.map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                        {hasMissingDefault && (
                          <option value={f.defaultValue}>
                            {f.defaultValue} (off KB)
                          </option>
                        )}
                      </select>
                    </>
                  ) : (
                    <span className={styles.noValues} title="The bound Targeted KB has no values yet">
                      — no KB values —
                    </span>
                  )}
                </div>
                <div className={styles.fieldRowPills}>
                  <span
                    className={styles.typePill}
                    // Opt this pill out of the lowercase text-transform
                    // so "Targeted KB" reads correctly. Other type pills
                    // (string/int/bool) stay lowercased.
                    style={{ textTransform: 'none' }}
                    title={kb ? `Targeted KB "${kb.name}"` : 'No KB bound'}
                  >
                    {kb ? `Targeted KB · ${kb.name}` : 'Targeted KB · (missing)'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
