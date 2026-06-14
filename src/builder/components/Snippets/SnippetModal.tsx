/**
 * SnippetModal — add / edit / delete an agent-level snippet.
 *
 * A snippet is a named, reusable, optionally-gated chunk of prompt
 * content. Referenced from any addon's prompt via `{{snippet:NAME}}`.
 * See `docs/guides/BUILDER_V2_SNIPPETS.md` for the full design.
 *
 * Layout:
 *   1. Name              — short canonical key (`lowercase_underscores`).
 *      The token rendered in prompts uses this verbatim.
 *   2. Display name      — optional free-text label for the snippets
 *      list and the picker description.
 *   3. Filter launcher   — same affordance as the AddonModal launcher.
 *      No filter = always renders; a filter gates substitution.
 *   4. Content           — MentionTextarea, full picker available. Can
 *      reference fields / params / memory / dynamic / etc. Nested
 *      `{{snippet:OTHER}}` tokens land as literal text (no recursive
 *      expansion in v1 — see assembler).
 *
 * Delete always confirms even when no references are visible — snippet
 * tokens can sit unresolved inside any prompt across any crew, and a
 * silent delete makes existing prompts mysteriously thin.
 */

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../Modal/Modal';
import { useConfirm } from '../Confirm/Confirm';
import { useBuilder } from '../../state/BuilderContext';
import { MentionTextarea } from '../MentionTextarea/MentionTextarea';
import { useMentionOptions } from '../MentionTextarea/useMentionOptions';
import { ConditionsEditor } from '../Conditions/ConditionsEditor';
import { conditionLine } from '../Filter/filterFormat';
import type {
  AddonFilter,
  ID,
  SnippetDef,
  TransitionCondition,
} from '../../types';
import addonStyles  from '../AddonModal/AddonModal.module.css';
import filterStyles from '../Filter/AddonFilterSection.module.css';
import styles       from './SnippetModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  agentId: ID;
  /** Existing snippet being edited, or null when adding. */
  initial: SnippetDef | null;
}

function isValidName(s: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(s);
}

function newSnippetId(): ID {
  return `snippet_${Math.random().toString(36).slice(2, 9)}`;
}

/** Local label for the launcher button. Differs from the addon
 *  `filterShortSummary` so the copy reads "snippet renders" instead of
 *  "addon runs every turn". */
function snippetFilterLabel(filter: AddonFilter | undefined): string {
  if (!filter || !Array.isArray(filter.conditions) || filter.conditions.length === 0) {
    return 'No filter — snippet renders whenever referenced';
  }
  const verb = filter.mode === 'exclude' ? 'Skip when' : 'Render when';
  const first = conditionLine(filter.conditions[0]);
  if (filter.conditions.length === 1) return `${verb} ${first}`;
  const extra = filter.conditions.length - 1;
  return `${verb} ${first} (+${extra} more)`;
}

export function SnippetModal({ open, onClose, agentId, initial }: Props) {
  const { doc, updateAgent } = useBuilder();
  const confirm = useConfirm();
  const mentionOptions = useMentionOptions(agentId);

  const agent = doc.agents.find(a => a.id === agentId);
  const editing = initial !== null;

  const [name,        setName]        = useState('');
  const [displayName, setDisplayName] = useState('');
  const [content,     setContent]     = useState('');
  const [filter,      setFilter]      = useState<AddonFilter | undefined>(undefined);
  const [filterOpen,  setFilterOpen]  = useState(false);

  // Reset whenever the modal opens — `initial` may have changed
  // (different snippet) or we may be adding a fresh one.
  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setDisplayName(initial?.displayName ?? '');
    setContent(initial?.content ?? '');
    setFilter(initial?.filter);
    setFilterOpen(false);
  }, [open, initial]);

  const siblings = useMemo(() => agent?.snippets ?? [], [agent?.snippets]);

  const trimmedName = name.trim().toLowerCase();
  const validName   = trimmedName === '' || isValidName(trimmedName);
  const collides    = trimmedName !== ''
    && siblings.some(s => s.id !== initial?.id && s.name === trimmedName);
  const canSave = trimmedName !== '' && validName && !collides;

  const writeSnippets = (nextList: SnippetDef[]) => {
    updateAgent(agentId, { snippets: nextList });
  };

  const handleSave = () => {
    if (!canSave) return;
    const next: SnippetDef = {
      id:          initial?.id ?? newSnippetId(),
      name:        trimmedName,
      ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
      content,
      ...(filter && Array.isArray(filter.conditions) && filter.conditions.length > 0
        ? { filter }
        : {}),
    };
    const list = siblings.some(s => s.id === next.id)
      ? siblings.map(s => (s.id === next.id ? next : s))
      : [...siblings, next];
    writeSnippets(list);
    onClose();
  };

  const handleDelete = async () => {
    if (!initial) return;
    const ok = await confirm({
      title:   `Delete snippet "${initial.name}"?`,
      message:
        `Any prompt that references {{snippet:${initial.name}}} will resolve to empty ` +
        `from now on — references aren't removed automatically. Snippet content can't ` +
        `be recovered from anywhere else.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    writeSnippets(siblings.filter(s => s.id !== initial.id));
    onClose();
  };

  const filterActive = !!filter
    && Array.isArray(filter.conditions)
    && filter.conditions.length > 0;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={editing ? 'Edit snippet' : 'New snippet'}
        badge={editing && trimmedName ? trimmedName : undefined}
        width={680}
        footer={
          <>
            {editing && (
              <button type="button" className={styles.btnDanger} onClick={handleDelete}>
                Delete
              </button>
            )}
            <span className={styles.spacer} />
            <button type="button" className={styles.btnGhost} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={!canSave}
              onClick={handleSave}
            >
              {editing ? 'Save' : 'Add'}
            </button>
          </>
        }
      >
        <div className={styles.form}>
          <div className={styles.row2}>
            <div>
              <div className={styles.label}>Name</div>
              <input
                className={styles.input}
                value={name}
                onChange={e => setName(e.target.value.toLowerCase())}
                placeholder="e.g. vibe_acknowledgment"
                autoFocus
                spellCheck={false}
              />
              {trimmedName && !validName && (
                <div className={styles.hintError}>
                  Use a lowercase letter to start, then letters / digits / underscores.
                </div>
              )}
              {collides && (
                <div className={styles.hintError}>
                  A snippet with this name already exists on this agent.
                </div>
              )}
              {trimmedName && validName && !collides && (
                <div className={styles.hint}>
                  Reference in prompts as <code>{`{{snippet:${trimmedName}}}`}</code>
                </div>
              )}
            </div>
            <div>
              <div className={styles.label}>
                Display name <span className={styles.optional}>(optional)</span>
              </div>
              <input
                className={styles.input}
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Free-form label for the snippets list"
              />
            </div>
          </div>

          <button
            type="button"
            className={`${styles.filterLauncher} ${filterActive ? styles.filterLauncherActive : ''}`}
            onClick={() => setFilterOpen(true)}
          >
            <span aria-hidden className={styles.filterLauncherIcon}>▽</span>
            <span className={styles.filterLauncherText}>{snippetFilterLabel(filter)}</span>
            <span className={styles.filterLauncherEdit}>
              {filterActive ? 'Edit' : 'Add'}
            </span>
          </button>

          <div>
            <div className={styles.label}>Content</div>
            <MentionTextarea
              value={content}
              onChange={setContent}
              options={mentionOptions}
              placeholder="The prompt text this snippet inserts. Type @ for memory, # for parameters, * for dynamic, / for all."
              rows={12}
              storageKey={initial ? `snippet:${initial.id}` : undefined}
            />
            <div className={styles.hint}>
              Embedded tokens (<code>{'{{field:X}}'}</code>, <code>{'{{param:Y}}'}</code>, …) resolve when
              this snippet is inlined into an addon's prompt. Nested <code>{'{{snippet:…}}'}</code>{' '}
              references aren't recursively expanded in v1.
            </div>
          </div>
        </div>
      </Modal>

      <SnippetFilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        agentId={agentId}
        snippetName={trimmedName || 'new snippet'}
        filter={filter}
        onChange={setFilter}
      />
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// SnippetFilterModal — local wrapper over the shared ConditionsEditor.
// We can't reuse the addon `FilterModal` because that one talks to
// `useAddonMutations` which assumes a live addon instance; snippets
// aren't addons. Visually we mirror `AddonFilterSection` (same polarity
// toggle, same conditions list, same hint copy) so the author sees one
// pattern across both surfaces.
// ────────────────────────────────────────────────────────────────────

interface SnippetFilterModalProps {
  open: boolean;
  onClose: () => void;
  agentId: ID;
  /** Used as the modal badge. */
  snippetName: string;
  filter: AddonFilter | undefined;
  onChange: (next: AddonFilter | undefined) => void;
}

function SnippetFilterModal({
  open, onClose, agentId, snippetName, filter, onChange,
}: SnippetFilterModalProps) {
  const safe: AddonFilter = filter ?? { conditions: [], mode: 'include' };
  const setMode = (mode: AddonFilter['mode']) =>
    onChange({ conditions: safe.conditions, mode });
  const setConditions = (conditions: TransitionCondition[]) => {
    if (conditions.length === 0) {
      onChange(undefined);                                  // no conditions → no filter
    } else {
      onChange({ mode: safe.mode, conditions });
    }
  };
  const hasConditions = safe.conditions.length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={620}
      title="Snippet render filter"
      badge={snippetName}
      footer={
        <>
          <span className={addonStyles.spacer} />
          <button type="button" className={addonStyles.primaryBtn} onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <section className={filterStyles.section}>
        <header className={filterStyles.header}>
          <span className={filterStyles.title}>Render filter</span>
          <span className={filterStyles.modePill} role="group" aria-label="Filter polarity">
            <button
              type="button"
              className={`${filterStyles.modeBtn} ${safe.mode !== 'exclude' ? filterStyles.modeBtnActive : ''}`}
              onClick={() => setMode('include')}
              title="Render this snippet only when ALL conditions match."
            >
              Render when matches
            </button>
            <button
              type="button"
              className={`${filterStyles.modeBtn} ${safe.mode === 'exclude' ? filterStyles.modeBtnActive : ''}`}
              onClick={() => setMode('exclude')}
              title="Skip this snippet when conditions match; render when at least one fails."
            >
              Skip when matches
            </button>
          </span>
        </header>

        <ConditionsEditor
          conditions={safe.conditions}
          onChange={setConditions}
          agentId={agentId}
          crewId={''}
          title=""
          emptyMessage="No conditions — snippet renders every time it's referenced."
        />

        {hasConditions && (
          <p className={filterStyles.hint}>
            {safe.mode === 'exclude'
              ? 'Renders UNLESS every condition above matches. Otherwise the token resolves to empty.'
              : 'Renders ONLY when every condition above matches. Otherwise the token resolves to empty.'}
          </p>
        )}
      </section>
    </Modal>
  );
}
