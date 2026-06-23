/**
 * TagsScreen — agent-level tag registry editor.
 *
 * Lists every declared tag (`agent.tags`) plus any tag actually used
 * on a field (so a tag never silently disappears from the registry
 * because the user typed it directly on a field). Clicking a tag opens
 * the editor pane: inline rename + list of every field carrying it +
 * delete button.
 *
 *   URL routing
 *     /<agent>/builder/tags
 *     /<agent>/builder/tags/<name>
 *
 * Rename cascades through `applyTokenRenameCascade(agentId, 'tag', …)`
 * — rewrites every `{{tag:OLD}}` / `{{tag:OLD:values}}` / `{{tag:OLD:names}}`
 * token across every prompt-text surface, plus the data side (`agent.tags`
 * + every `FieldDef.tags[]`). Delete strips the tag from `agent.tags`
 * and every field's `tags[]`; tokens are intentionally left in place so
 * the broken reference surfaces (matches the resolver's unknown-tag
 * behavior elsewhere in the builder).
 */

import { useCallback, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useBuilder } from '../../state/BuilderContext';
import { useConfirm } from '../Confirm/Confirm';
import { sanitiseName } from '../DynamicContextScreen/helpers';
import type { FieldDef } from '../../types';
import styles from './TagsScreen.module.css';

/** Make a unique placeholder name in the form `new_tag`, `new_tag_2`,
 *  … so the auto-create button always lands on a non-colliding start. */
function uniqueTagName(base: string, existing: ReadonlyArray<string>): string {
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

export function TagsScreen() {
  const navigate = useNavigate();
  const {
    doc,
    updateAgent,
    applyTokenRenameCascade,
    removeAgentTag,
  } = useBuilder();
  const confirm = useConfirm();
  const agent = doc.agents[0];
  const agentSlug = agent?.slug ?? '';

  const { tagName: paramName } = useParams<{ tagName?: string }>();

  // Union of declared tags + tags actually in use on any field. The
  // user may have added a tag straight on a field without it being
  // promoted to `agent.tags` (e.g. before commitTags ran); we surface
  // those here so the editor never claims they don't exist.
  const allTags = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const t of agent?.tags ?? []) set.add(t);
    for (const f of agent?.fields ?? []) {
      for (const t of f.tags ?? []) set.add(t);
    }
    for (const c of agent?.crews ?? []) {
      for (const f of c.fields ?? []) {
        for (const t of f.tags ?? []) set.add(t);
      }
    }
    return Array.from(set).sort();
  }, [agent?.tags, agent?.fields, agent?.crews]);

  const activeTag = useMemo<string | null>(() => {
    if (!paramName) return null;
    return allTags.includes(paramName) ? paramName : null;
  }, [allTags, paramName]);

  // Every field carrying the active tag (agent + crew scope). Used
  // to render the editor pane's "fields under this tag" list.
  const taggedFields = useMemo<
    Array<{ scope: 'agent' | 'crew'; crewName?: string; field: FieldDef }>
  >(() => {
    if (!agent || !activeTag) return [];
    const out: Array<{ scope: 'agent' | 'crew'; crewName?: string; field: FieldDef }> = [];
    for (const f of agent.fields ?? []) {
      if (f.tags?.includes(activeTag)) out.push({ scope: 'agent', field: f });
    }
    for (const c of agent.crews ?? []) {
      for (const f of c.fields ?? []) {
        if (f.tags?.includes(activeTag)) out.push({ scope: 'crew', crewName: c.name, field: f });
      }
    }
    return out;
  }, [agent, activeTag]);

  const urlTag = (name: string) =>
    `/${agentSlug}/builder/tags/${encodeURIComponent(name)}`;
  const urlList = `/${agentSlug}/builder/tags`;

  // ── Create / rename / delete ─────────────────────────────────────
  const handleCreate = useCallback(() => {
    if (!agent) return;
    const name = uniqueTagName('new_tag', allTags);
    updateAgent(agent.id, { tags: [...(agent.tags ?? []), name] });
    navigate(urlTag(name));
  }, [agent, allTags, navigate, updateAgent]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRename = useCallback((oldName: string, raw: string): boolean => {
    if (!agent) return false;
    const next = sanitiseName(raw);
    if (!next || next === oldName) return false;
    if (allTags.includes(next)) return false;
    // Rewrite `{{tag:OLD…}}` tokens + every `FieldDef.tags[]` entry +
    // the `agent.tags` registry entry BEFORE we follow up with any
    // navigation. Cascade is atomic.
    applyTokenRenameCascade(agent.id, 'tag', oldName, next);
    navigate(urlTag(next));
    return true;
  }, [agent, allTags, navigate, applyTokenRenameCascade]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = useCallback(async (tag: string) => {
    if (!agent) return;
    const fieldsCount = taggedFields.length;
    const message = fieldsCount === 0
      ? `Removes "${tag}" from the registry. No fields carry it.`
      : `Removes "${tag}" from the registry and strips it from ${fieldsCount} field${fieldsCount === 1 ? '' : 's'}. Any prompt using {{tag:${tag}}} will resolve to empty.`;
    const ok = await confirm({
      title:        `Delete tag "${tag}"?`,
      message,
      confirmLabel: 'Delete',
      danger:       true,
    });
    if (!ok) return;
    removeAgentTag(agent.id, tag);
    navigate(urlList);
  }, [agent, taggedFields.length, confirm, navigate, removeAgentTag, urlList]);

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
            onClick={() => navigate(urlList)}
          >
            Tags
          </button>
          {activeTag && (
            <>
              <span> / </span>
              <span className={`${styles.crumb} ${styles.crumbCurrent}`}>{activeTag}</span>
            </>
          )}
        </div>
        <div className={styles.hint}>
          Cross-domain grouping. Use{' '}
          <code>{`{{tag:NAME}}`}</code>,{' '}
          <code>{`{{tag:NAME:values}}`}</code>, or{' '}
          <code>{`{{tag:NAME:names}}`}</code> in any prompt.
        </div>
      </div>

      <div className={styles.split}>
        {/* ── Left: tag list ──────────────────────────────────────── */}
        <div className={styles.listCol}>
          <button
            type="button"
            className={styles.addBtn}
            onClick={handleCreate}
          >
            + Add tag
          </button>
          {allTags.length === 0 ? (
            <div className={styles.listEmpty}>
              No tags yet. Add one here or tag a field directly from the Fields page.
            </div>
          ) : (
            <ul className={styles.list}>
              {allTags.map(t => {
                const usageCount =
                  ((agent.fields ?? []).filter(f => f.tags?.includes(t)).length) +
                  ((agent.crews ?? []).reduce(
                    (n, c) => n + (c.fields ?? []).filter(f => f.tags?.includes(t)).length,
                    0,
                  ));
                const active = t === activeTag;
                return (
                  <li key={t}>
                    <button
                      type="button"
                      className={`${styles.row} ${active ? styles.rowActive : ''}`}
                      onClick={() => navigate(urlTag(t))}
                    >
                      <span className={styles.rowName}>{t}</span>
                      <span className={styles.rowCount}>{usageCount}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ── Right: editor pane ──────────────────────────────────── */}
        <div className={styles.editorCol}>
          {activeTag ? (
            <TagEditor
              key={activeTag}
              tag={activeTag}
              taggedFields={taggedFields}
              agentSlug={agentSlug}
              onRename={(next) => handleRename(activeTag, next)}
              onDelete={() => handleDelete(activeTag)}
            />
          ) : (
            <div className={styles.editorEmpty}>
              <div className={styles.editorEmptyHeadline}>Pick a tag on the left</div>
              <div className={styles.editorEmptyHint}>
                Or click <strong>+ Add tag</strong> to declare a new one.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Tag editor pane ─────────────────────────────────────────────── */

interface TagEditorProps {
  tag: string;
  taggedFields: Array<{ scope: 'agent' | 'crew'; crewName?: string; field: FieldDef }>;
  agentSlug: string;
  onRename: (raw: string) => boolean;
  onDelete: () => void;
}

function TagEditor({ tag, taggedFields, agentSlug, onRename, onDelete }: TagEditorProps) {
  return (
    <div className={styles.editor}>
      <div>
        <div className={styles.label}>Name</div>
        <input
          key={tag}
          className={styles.nameInput}
          defaultValue={tag}
          spellCheck={false}
          onBlur={e => {
            const ok = onRename(e.currentTarget.value);
            if (!ok) e.currentTarget.value = tag;
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
            if (e.key === 'Escape') {
              e.preventDefault();
              e.currentTarget.value = tag;
              e.currentTarget.blur();
            }
          }}
        />
        <div className={styles.nameHint}>
          Renaming rewrites every <code>{`{{tag:${tag}…}}`}</code> token in every prompt,
          plus the tag entry on every field carrying it.
        </div>
      </div>

      <div>
        <div className={styles.label}>
          Fields under this tag <span className={styles.labelCount}>{taggedFields.length}</span>
        </div>
        {taggedFields.length === 0 ? (
          <div className={styles.editorEmptyHint}>
            No fields carry this tag yet. Open a field on the Fields page and add it there.
          </div>
        ) : (
          <ul className={styles.fieldList}>
            {taggedFields.map(({ field, scope, crewName }) => (
              <li key={`${scope}::${field.id}`}>
                <Link
                  to={`/${agentSlug}/builder/fields/${encodeURIComponent(field.name)}`}
                  className={styles.fieldRow}
                >
                  <span className={styles.fieldName}>{field.name}</span>
                  <span className={styles.fieldMeta}>
                    {field.type}
                    {field.domain ? ` · ${field.domain}` : ''}
                    {scope === 'crew' && crewName ? ` · 🔒 ${crewName}` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.editorActions}>
        <button type="button" className={styles.deleteBtn} onClick={onDelete}>
          Delete tag
        </button>
      </div>
    </div>
  );
}
