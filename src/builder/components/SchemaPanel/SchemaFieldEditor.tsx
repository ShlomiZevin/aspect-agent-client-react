/**
 * SchemaFieldEditor — single-field editor for the dedicated Fields
 * page. Every input auto-commits (blur for text, change for selects),
 * matching the inline-rename pattern used by the enum bible + personas
 * page. No Save button — the doc is the source of truth, and changes
 * land as soon as the user moves focus.
 *
 * Name renames fire the rename cascade (rewriting tokens like
 * `{{field:OLD}}`, `{{fieldname:OLD}}`, `{{dc:OLD…}}` in addon
 * prompts / snippet bodies / persona bodies / enum value sections,
 * plus the data-side condition + filter references) BEFORE the
 * FieldDef itself is swapped.
 *
 * Expects an existing `initial` field. The new-field "Declare" flow
 * lives in the host page (`FieldsScreen.handleDeclare`) — it creates
 * a stub field with a unique placeholder name and routes the user
 * here. Same pattern as the enum + persona pages.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBuilder } from '../../state/BuilderContext';
import { useAgentFields } from '../../state/useAgentFields';
import { useCrewFields } from '../../state/useCrewFields';
import { useConfirm } from '../Confirm/Confirm';
import {
  autoChoiceName,
  buildChoiceEnum,
  choiceValuesOf,
  isEnumSharedBeyond,
  ownedChoiceEnum,
  withChoiceValues,
} from '../../state/choiceList';
import { ChoiceValuesInput } from '../FieldsPanel/ChoiceValuesInput';
import { DomainInput } from '../FieldsPanel/DomainInput';
import { TagsInput } from '../FieldsPanel/TagsInput';
import {
  validateFieldName,
  stripInvalid,
  hadInvalidStripped,
  SPACE_BLOCKED_MESSAGE,
} from '../FieldsPanel/fieldNameValidation';
import type { FieldDef, FieldSource, FieldType, ID } from '../../types';
import { autoDir } from '../../../utils/textDirection';
import styles from './SchemaPanel.module.css';

interface Props {
  agentId: ID;
  /** The field being edited. Must be set — the editor no longer
   *  renders a "declare new" flow; the host page handles new-field
   *  creation by upserting a stub and navigating here. */
  initial: FieldDef;
  /** Called after a rename commits with the saved field. The host
   *  uses this to navigate to the new URL (since `name` is the route
   *  param). Other property commits don't fire this — they just
   *  update the doc in place. */
  onAfterRename?: (saved: FieldDef) => void;
  /** Called after the field is deleted. The host navigates back to
   *  the list. */
  onAfterDelete?: () => void;
}

const PRIMITIVE_TYPES: { value: FieldType; label: string }[] = [
  { value: 'string',  label: 'String' },
  { value: 'int',     label: 'Integer' },
  { value: 'boolean', label: 'Boolean' },
];

const SOURCES: FieldSource[] = ['explicit', 'inferred', 'pinned'];
const SOURCE_LABEL: Record<FieldSource, string> = {
  explicit: 'Explicit — only when the user literally says it',
  inferred: 'Inferred — can be concluded from conversation',
  pinned:   'Pinned — pre-set value, no collector (Targeted KB only)',
};

export function SchemaFieldEditor({
  agentId, initial, onAfterRename, onAfterDelete,
}: Props) {
  const { doc, updateAgent, applyFieldRenameCascade, applyTokenRenameCascade } = useBuilder();
  const { domainNames, tagNames } = useAgentFields(agentId);
  // `removeField` lives on useCrewFields but only needs agent context —
  // safe to call with crewId='' for agent-scoped deletion.
  const { removeField } = useCrewFields(agentId, '');
  const confirm = useConfirm();
  const agent = doc.agents.find(a => a.id === agentId);

  // Local state for inputs that commit on blur. Selects + the domain
  // autocomplete fire commits directly from their handlers, so they
  // could read straight off the FieldDef — but keeping all values in
  // local state keeps the editor uniform.
  const [name,             setName]             = useState(initial.name);
  const [nameSpaceBlocked, setNameSpaceBlocked] = useState(false);
  const [domain,           setDomain]           = useState(initial.domain ?? '');
  const [definition,       setDefinition]       = useState(initial.definition ?? '');
  const [howToExtract,     setHowToExtract]     = useState(initial.howToExtract ?? '');

  // Re-seat local state when the user picks a different field in the
  // left column. Keyed off the field id so the screen mount can host
  // many fields over its lifetime without remounting the editor.
  useEffect(() => {
    setName(initial.name);
    setNameSpaceBlocked(false);
    setDomain(initial.domain ?? '');
    setDefinition(initial.definition ?? '');
    setHowToExtract(initial.howToExtract ?? '');
  }, [initial.id, initial.name, initial.domain, initial.definition, initial.howToExtract]);

  // ── Validation ────────────────────────────────────────────────
  const trimmedName = name.trim();
  const siblings = useMemo(() => {
    if (!agent) return [] as FieldDef[];
    return agent.fields.filter(f => f.id !== initial.id);
  }, [agent, initial.id]);
  const collides = trimmedName !== '' && siblings.some(f => f.name === trimmedName);
  const nameValidation = trimmedName.length > 0
    ? validateFieldName(trimmedName)
    : { ok: true, reason: '' };

  // ── Commit helpers ────────────────────────────────────────────
  // One write path. Each input's blur/change calls this with a patch.
  // The cascade only fires when `patch.name` is present and changed.
  const writePatch = (patch: Partial<FieldDef>) => {
    if (!agent) return;
    const next: FieldDef = { ...initial, ...patch };
    const renamed = patch.name !== undefined && patch.name !== initial.name;
    if (renamed) {
      applyFieldRenameCascade(agentId, initial.name, next.name);
      // The field's owned Choice list follows the field name
      // (`gender` → `gender_choices`) — cascade the {{enum:…}} tokens
      // BEFORE swapping the enum's own name, same order the Targeted
      // KB page's rename uses.
      const owned = ownedChoiceEnum(agent, initial);
      if (owned) {
        const nextEnumName = autoChoiceName(agent, next.name, owned.id);
        if (nextEnumName !== owned.name) {
          applyTokenRenameCascade(agentId, 'enum', owned.name, nextEnumName);
          updateAgent(agentId, {
            enums: (agent.enums ?? []).map(e => (e.id === owned.id ? { ...e, name: nextEnumName } : e)),
          });
        }
      }
    }
    const fields = agent.fields.map(f => f.id === next.id ? next : f);
    updateAgent(agentId, { fields });
    if (renamed) onAfterRename?.(next);
  };

  const commitName = () => {
    if (!agent) return;
    if (!trimmedName || collides || !nameValidation.ok) {
      // Roll back to the saved name on invalid commit — same UX as
      // the InlineRename helper on the enum page.
      setName(initial.name);
      setNameSpaceBlocked(false);
      return;
    }
    if (trimmedName === initial.name) return;
    writePatch({ name: trimmedName });
  };

  const commitDomain = (next: string) => {
    const trimmed = next.trim();
    if (trimmed === (initial.domain ?? '')) return;
    writePatch(trimmed
      ? { domain: trimmed }
      : { domain: undefined });
  };

  const commitDefinition = () => {
    const trimmed = definition.trim();
    if (trimmed === (initial.definition ?? '')) return;
    writePatch(trimmed
      ? { definition: trimmed }
      : { definition: undefined });
  };

  const commitHowToExtract = () => {
    const trimmed = howToExtract.trim();
    if (trimmed === (initial.howToExtract ?? '')) return;
    writePatch({ howToExtract: trimmed });
  };

  // Tag commit: write the field's tags AND promote any fresh tag names
  // into `agent.tags` so the declared-list registry stays in sync.
  // Without this side-effect, a tag only ever lives on its first
  // field, and the Tags page would only show ones the user has
  // explicitly visited there.
  const commitTags = (next: string[]) => {
    const prev = initial.tags ?? [];
    const same = prev.length === next.length && prev.every((t, i) => t === next[i]);
    if (same) return;
    if (agent) {
      const declared = new Set(agent.tags ?? []);
      const fresh = next.filter(t => !declared.has(t));
      if (fresh.length > 0) {
        updateAgent(agentId, { tags: [...(agent.tags ?? []), ...fresh] });
      }
    }
    writePatch(next.length > 0 ? { tags: next } : { tags: undefined });
  };

  // The field's owned Choice list, if its type is "Choice" (an enum
  // auto-created for this one field, values edited inline below).
  const ownedEnum = ownedChoiceEnum(agent, initial);

  const commitChoiceValues = (values: string[]) => {
    if (!agent || !ownedEnum) return;
    updateAgent(agentId, {
      enums: (agent.enums ?? []).map(e => (e.id === ownedEnum.id ? withChoiceValues(e, values) : e)),
    });
  };

  const commitTypeChange = async (raw: string) => {
    if (raw === '__choice__') {
      if (ownedEnum) return; // already Choice
      // Mint the owned list (empty — values typed right below) and bind.
      const en = buildChoiceEnum(autoChoiceName(agent, initial.name), initial.id, []);
      updateAgent(agentId, { enums: [...(agent?.enums ?? []), en] });
      writePatch({ type: 'enum', enumType: en.id });
      return;
    }
    // Leaving Choice deletes the owned list — unless another field
    // has since bound to it (then it graduated to a shared enum).
    if (ownedEnum && !isEnumSharedBeyond(agent, ownedEnum.id, initial.id)) {
      const ok = await confirm({
        title: 'Delete this field\'s value list?',
        message: `The list "${ownedEnum.name}" was created for this field and nothing else uses it. Changing the type deletes it.`,
        confirmLabel: 'Delete list',
        danger: true,
      });
      if (!ok) return;
      updateAgent(agentId, { enums: (agent?.enums ?? []).filter(e => e.id !== ownedEnum.id) });
    }
    if (raw.startsWith('enum:')) {
      const enumId = raw.slice('enum:'.length) as ID;
      if (initial.type === 'enum' && initial.enumType === enumId) return;
      writePatch({ type: 'enum', enumType: enumId });
    } else {
      const t = raw as FieldType;
      if (initial.type === t && !initial.enumType) return;
      writePatch({ type: t, enumType: undefined });
    }
  };

  const commitSourceChange = (raw: string) => {
    const s = raw as FieldSource;
    if (s === initial.source) return;
    // When swapping AWAY from 'pinned', drop `defaultValue` — it's
    // dead weight under any other source. When swapping TO 'pinned'
    // for an enum-typed field with a single declared value, prefill
    // `defaultValue` so the user lands on a sane starting point.
    if (s !== 'pinned' && initial.defaultValue !== undefined) {
      writePatch({ source: s, defaultValue: undefined });
      return;
    }
    if (s === 'pinned' && initial.type === 'enum' && !initial.defaultValue && agent) {
      const en = (agent.enums ?? []).find(e => e.id === initial.enumType);
      const firstValue = en?.values?.find(v => v?.value)?.value;
      if (typeof firstValue === 'string') {
        writePatch({ source: s, defaultValue: firstValue });
        return;
      }
    }
    writePatch({ source: s });
  };

  /** Commit a new pinned-default selection. Only meaningful when
   *  source === 'pinned' + type === 'enum'. */
  const commitDefaultValue = (next: string) => {
    if (next === (initial.defaultValue ?? '')) return;
    writePatch(next ? { defaultValue: next } : { defaultValue: undefined });
  };

  // ── Extractors-wired counter (for delete confirmation) ────────
  const wiredCount = useMemo(() => {
    if (!agent) return 0;
    let n = 0;
    for (const c of agent.crews) {
      for (const a of c.addons) {
        const list = (a.config as { extractsFields?: ID[] })?.extractsFields;
        if (Array.isArray(list) && list.includes(initial.id)) n += 1;
      }
    }
    return n;
  }, [initial, agent]);

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete field "${initial.name}"?`,
      message: wiredCount > 0
        ? `Removes the declaration and scrubs it from ${wiredCount} extractor${wiredCount === 1 ? '' : 's'} that currently collect it.`
        : 'Removes the declaration. No extractors collect this field today, so nothing else is affected.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    removeField('agent', '', initial.id);
    onAfterDelete?.();
  };

  return (
    <div className={styles.form}>
      <div>
        <div className={styles.label}>Name</div>
        <input
          key={initial.id}
          className={`${styles.input} ${(!nameValidation.ok || nameSpaceBlocked || collides) ? styles.inputInvalid : ''}`}
          value={name}
          onChange={e => {
            const raw = e.target.value;
            setNameSpaceBlocked(hadInvalidStripped(raw));
            setName(stripInvalid(raw));
          }}
          onBlur={commitName}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
            if (e.key === 'Escape') {
              e.preventDefault();
              setName(initial.name);
              setNameSpaceBlocked(false);
              e.currentTarget.blur();
            }
          }}
          placeholder="e.g. employment_status"
          spellCheck={false}
        />
        {collides && (
          <div className={styles.hint} style={{ color: '#b91c1c' }}>
            An agent field with this name already exists.
          </div>
        )}
        <div className={styles.nameWarning}>
          {collides
            ? ''
            : nameSpaceBlocked
              ? SPACE_BLOCKED_MESSAGE
              : !nameValidation.ok
                ? nameValidation.reason
                : ''}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div className={styles.label}>Type</div>
          <select
            className={styles.input}
            value={
              ownedEnum
                ? '__choice__'
                : initial.type === 'enum' && initial.enumType ? `enum:${initial.enumType}` : initial.type
            }
            onChange={e => void commitTypeChange(e.target.value)}
          >
            {PRIMITIVE_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
            <option value="__choice__">Choice — one of a list</option>
            {(agent?.enums?.length ?? 0) > 0 && (
              <optgroup label="Enums">
                {(agent?.enums ?? []).map(en => (
                  <option key={en.id} value={`enum:${en.id}`}>{en.name}</option>
                ))}
              </optgroup>
            )}
            {!ownedEnum
              && initial.type === 'enum'
              && initial.enumType
              && !(agent?.enums ?? []).some(en => en.id === initial.enumType)
              && (
                <option value={`enum:${initial.enumType}`}>(missing enum)</option>
              )}
          </select>
        </div>
        <div>
          <div className={styles.label}>Source</div>
          <select
            className={styles.input}
            value={initial.source}
            onChange={e => commitSourceChange(e.target.value)}
          >
            {SOURCES.map(s => (
              <option key={s} value={s} title={SOURCE_LABEL[s]}>
                {SOURCE_LABEL[s].split(' — ')[0]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Choice values — inline editor, auto-commits like the rest of
          this page (each change writes through to the owned enum). */}
      {ownedEnum && (
        <div>
          <div className={styles.label}>Values</div>
          <ChoiceValuesInput
            values={choiceValuesOf(ownedEnum)}
            onChange={commitChoiceValues}
          />
          <div className={styles.hint}>
            In prompts: <code>{`{{enum:${ownedEnum.name}}}`}</code>
          </div>
        </div>
      )}

      {!ownedEnum && initial.type === 'enum' && initial.enumType && agent && (() => {
        const en = (agent.enums ?? []).find(e => e.id === initial.enumType);
        if (!en) {
          return (
            <div className={styles.hint} style={{ color: '#b91c1c' }}>
              Bound KB "{initial.enumType}" no longer exists — pick a current one above.
            </div>
          );
        }
        const valueNames = (en.values ?? [])
          .map(v => v?.value)
          .filter((v): v is string => typeof v === 'string' && v.length > 0);
        return (
          <div className={styles.enumPreview}>
            <span className={styles.enumPreviewLabel}>{en.name}</span>
            {valueNames.length > 0 ? (
              <span className={styles.enumPreviewValues}>
                {valueNames.join(' · ')}
              </span>
            ) : (
              <span className={styles.enumPreviewEmpty}>
                No values declared on the KB yet
              </span>
            )}
            <Link
              to={`/${agent.slug}/builder/enums/${encodeURIComponent(en.name)}`}
              className={styles.enumPreviewLink}
            >
              Edit KB ↗
            </Link>
          </div>
        );
      })()}

      {/* Pinned default value picker. Visible only when the field is
          a pinned enum — pinned non-enum fields have nowhere to point
          the default at (and the runtime treats them as no-ops). The
          runtime seeds memory[domain][name] with this value at every
          turn if the slot is empty, so per-conversation overrides win. */}
      {initial.source === 'pinned' && initial.type === 'enum' && agent && (() => {
        const en = (agent.enums ?? []).find(e => e.id === initial.enumType);
        const valueNames = (en?.values ?? [])
          .map(v => v?.value)
          .filter((v): v is string => typeof v === 'string' && v.length > 0);
        return (
          <div>
            <div className={styles.label}>
              🎯 Default value <span style={{
                textTransform: 'none',
                letterSpacing: 0,
                fontWeight: 500,
                fontStyle: 'italic',
                opacity: 0.75,
              }}>· seeded at conversation start when memory slot is empty</span>
            </div>
            {!en ? (
              <div className={styles.hint} style={{ color: '#b91c1c' }}>
                Bound KB missing — pick a KB above before setting a default.
              </div>
            ) : valueNames.length === 0 ? (
              <div className={styles.hint}>
                No values declared on this KB yet — declare one in the KB editor
                to pin a default.
              </div>
            ) : (
              <select
                className={styles.input}
                value={initial.defaultValue ?? ''}
                onChange={e => commitDefaultValue(e.target.value)}
              >
                {!initial.defaultValue && (
                  <option value="">— pick a value —</option>
                )}
                {valueNames.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
                {/* Show a stale value too so a renamed KB value doesn't
                    silently disappear — author can spot + pick again. */}
                {initial.defaultValue && !valueNames.includes(initial.defaultValue) && (
                  <option value={initial.defaultValue}>
                    {initial.defaultValue} (no longer on KB)
                  </option>
                )}
              </select>
            )}
          </div>
        );
      })()}

      {/* Hint: non-enum pinned fields don't make sense. The runtime
          skips them; surface it to the author so they realise the
          field will be inert. */}
      {initial.source === 'pinned' && initial.type !== 'enum' && (
        <div className={styles.hint} style={{ color: '#b45309' }}>
          Pinned source only seeds enum-typed fields today. Pick a Targeted KB
          on the Type dropdown above, or change the source.
        </div>
      )}

      <div>
        <div className={styles.label}>Domain</div>
        {/* DomainInput's onChange fires per keystroke; we wrap it in a
            blur-commit so we only write the doc on a stable value. */}
        <div onBlur={() => commitDomain(domain)}>
          <DomainInput
            value={domain}
            onChange={setDomain}
            options={domainNames}
          />
        </div>
      </div>

      <div>
        <div className={styles.label}>
          Tags <span style={{
            textTransform: 'none',
            letterSpacing: 0,
            fontWeight: 500,
            fontStyle: 'italic',
            opacity: 0.75,
          }}>· cross-domain grouping for {`{{tag:NAME}}`}</span>
        </div>
        {/* TagsInput's onChange fires per discrete add/remove — no
            need for a blur-deferred commit. Each change is already a
            stable value. */}
        <TagsInput
          value={initial.tags ?? []}
          onChange={commitTags}
          options={tagNames}
        />
      </div>

      <div>
        <div className={styles.label}>
          Definition <span style={{
            textTransform: 'none',
            letterSpacing: 0,
            fontWeight: 500,
            fontStyle: 'italic',
            opacity: 0.75,
          }}>· for you, never sent to the LLM</span>
        </div>
        <textarea
          className={styles.textarea}
          value={definition}
          onChange={e => setDefinition(e.target.value)}
          onBlur={commitDefinition}
          placeholder="Your own note about what this field means. Builder-only — the runtime never reads it."
          spellCheck={false}
          dir={autoDir(definition)}
          rows={2}
        />
      </div>

      <div>
        <div className={styles.label}>How to extract</div>
        <textarea
          className={styles.textarea}
          value={howToExtract}
          onChange={e => setHowToExtract(e.target.value)}
          onBlur={commitHowToExtract}
          placeholder="What this field means. Used by extractors that collect it."
          spellCheck={false}
          dir={autoDir(howToExtract)}
        />
      </div>
      {initial.type === 'enum' && !initial.enumType && (agent?.enums ?? []).length === 0 && (
        <div className={styles.hint}>
          No enums declared yet. Open the Enums bible to author one.
        </div>
      )}

      <div className={styles.usageHint}>
        Declared fields are inert until a crew's extractor references them.
        Open the field in a crew view to wire it (the "Extracted by" multi-select).
      </div>

      {/* Delete sits alone — there's no Save / Cancel because every
          input auto-commits on blur. Matches the enum + persona page
          patterns. */}
      <div className={styles.actions} style={{ marginTop: 12 }}>
        <button type="button" className={styles.btnDanger} onClick={handleDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}
