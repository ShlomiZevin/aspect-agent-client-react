/**
 * AddFieldModal — define a new field.
 *
 * Field definitions live on `agent.fields` (scope='agent') or
 * `crew.fields` (scope='crew'). At creation time the user picks
 * one or more Field Extractors anywhere in the agent that should
 * extract this field — each extractor's `extractsFields[]` gets
 * the new id appended.
 *
 * The "extracted by" multi-select lists every Field Extractor
 * across the agent (Crew → Extractor format). At least one must
 * be ticked; we default the current crew's first extractor when
 * opened from a CrewView. If there are no extractors at all, the
 * "auto-create one in this crew" option ticks itself and we mint
 * a Field Extractor on submit.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../Modal/Modal';
import { useBuilder } from '../../state/BuilderContext';
import { useCrewFields } from '../../state/useCrewFields';
import { DomainInput } from './DomainInput';
import { TagsInput } from './TagsInput';
import {
  validateFieldName,
  stripInvalid,
  hadInvalidStripped,
  SPACE_BLOCKED_MESSAGE,
} from './fieldNameValidation';
import type { FieldDef, FieldSource, FieldType, ID } from '../../types';
import { autoDir } from '../../../utils/textDirection';
import styles from './AddFieldModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  agentId: ID;
  crewId: ID;
  /**
   * When the modal is opened from a specific extractor's config
   * (the "+ Add field" inside an extractor card), the caller passes
   * this so the new field starts wired to THAT extractor and inherits
   * its plugin's preferred default source. Without it, the modal
   * falls back to the first extractor in the crew + 'explicit'.
   */
  fromExtractor?: {
    instanceId: ID;
    defaultSource: FieldSource;
  };
  /**
   * Optional callback for the "Wire it here" affordance shown when
   * the typed name collides with an existing agent field. The parent
   * (FieldsPanel) opens its WireToCrewModal with the colliding field
   * pre-selected so the user lands in the right next step.
   */
  onWireExisting?: (fieldId: ID) => void;
  /**
   * Fired with the newly-created FieldDef right before the modal
   * closes. Used by callers that need to react to the new id — e.g.
   * Field Reasoner's WireOrCreate flow patches its own
   * `extractsFields = [field.id]` to replace any previous link.
   */
  onCreated?: (field: FieldDef) => void;
  /**
   * When set, the field type picker is hidden and the draft starts
   * with this type. Used by the DC page to open "+ New enum field"
   * without making the user re-pick the type. The form behaves
   * exactly like the regular flow for everything else.
   */
  lockedType?: FieldType;
}

/** Primitive types that appear at the top of the unified Type select.
 *  `enum` is intentionally NOT here — picking an enum means picking a
 *  SPECIFIC enum from the bible, surfaced as its own optgroup below. */
const PRIMITIVE_TYPES: { value: FieldType; label: string }[] = [
  { value: 'string',  label: 'String' },
  { value: 'int',     label: 'Integer' },
  { value: 'boolean', label: 'Boolean' },
];

const SOURCE_LABEL: Record<FieldSource, { label: string; hint: string }> = {
  explicit: { label: 'Explicit', hint: 'Only when the user literally says it' },
  inferred: { label: 'Inferred', hint: 'Can be concluded from conversation' },
};

interface Draft {
  name: string;
  type: FieldType;
  source: FieldSource;
  domain: string;
  howToExtract: string;
  definition: string;
  enumType: ID | '';
  tags: string[];
}

// New fields are always agent-scoped now — the "schema declares,
// crews collect" model makes crew-private fields equivalent to
// "declared at agent level, wired only to that crew." Legacy crew-
// scoped fields (CrewBody.fields) keep working; users can migrate
// one via FieldEditorModal's Scope picker. No new ones from here.
const emptyDraft = (source: FieldSource = 'explicit', type: FieldType = 'string'): Draft => ({
  name: '',
  type,
  source,
  domain: '',
  howToExtract: '',
  definition: '',
  enumType: '',
  tags: [],
});

export function AddFieldModal({
  open, onClose, agentId, crewId, fromExtractor, onWireExisting, onCreated, lockedType,
}: Props) {
  const { agentExtractors, extractorOptions, domainNames, tagNames, addFieldToScope } =
    useCrewFields(agentId, crewId);
  const { doc, updateAgent } = useBuilder();
  const agent = doc.agents.find(a => a.id === agentId);

  // Existing agent-field-name lookup for collision detection. Memory
  // writes are keyed by NAME (not id), so a second declaration with the
  // same name would silently overwrite the first at runtime — a real
  // footgun. We block submit and offer to wire the existing one instead.
  const agentFieldByName = useMemo(() => {
    const map = new Map<string, FieldDef>();
    for (const f of agent?.fields ?? []) map.set(f.name, f);
    return map;
  }, [agent?.fields]);

  const [draft, setDraft] = useState<Draft>(() => emptyDraft(fromExtractor?.defaultSource, lockedType));
  // True when the user's last keystroke on the Name input contained
  // whitespace that we silently stripped. Drives the inline
  // SPACE_BLOCKED_MESSAGE so the user sees why their space "did
  // nothing". Cleared on the next no-whitespace edit.
  const [nameSpaceBlocked, setNameSpaceBlocked] = useState(false);
  // Which extractor instances should extract this field. At least one
  // required to submit. When opened from a specific extractor's "+ Add
  // field", that one is pre-ticked. Otherwise we fall back to the
  // first extractor in the current crew (or empty → auto-create).
  const [selectedExtractors, setSelectedExtractors] = useState<Set<ID>>(new Set());

  // Reset on open. Pick a sensible default extractor for the crew
  // (or the calling extractor when opened from an extractor's config).
  useEffect(() => {
    if (!open) return;
    setDraft(emptyDraft(fromExtractor?.defaultSource, lockedType));
    if (fromExtractor) {
      setSelectedExtractors(new Set([fromExtractor.instanceId]));
    } else if (lockedType) {
      // Caller-locked flow (DC page): don't pre-pick an arbitrary
      // extractor — the author can wire the field later (e.g. from
      // the Field Reasoner / Interviewer side, or by editing the
      // declared field). Forcing a default here would silently
      // attach the field to the first extractor in this crew, which
      // is rarely what the DC author wants.
      setSelectedExtractors(new Set());
    } else {
      const firstInThisCrew = extractorOptions[0]?.instanceId;
      setSelectedExtractors(firstInThisCrew ? new Set([firstInThisCrew]) : new Set());
    }
  }, [open, extractorOptions, fromExtractor, lockedType]);

  const noExtractorsAnywhere = agentExtractors.length === 0;

  // Collision check — does the typed name match an already-declared
  // agent field? If so, surface the wire-instead path and block submit
  // so the user can't accidentally create a duplicate.
  const trimmedName = draft.name.trim();
  const collidesWith = trimmedName ? agentFieldByName.get(trimmedName) ?? null : null;
  // Shape check — block names the 4o-class extractors will silently
  // rewrite (capitals, spaces, non-Latin, etc.). Only surface the
  // reason once the user has typed something; an empty box reads as
  // "still drafting", not "invalid".
  const nameValidation = trimmedName.length > 0
    ? validateFieldName(trimmedName)
    : { ok: true, reason: '' };

  // For the caller-locked flow (DC page), allow declaring the field
  // without picking any extractor at all — the author can wire it
  // later. For every other entry point, keep the existing rule
  // (must have at least one extractor or the engine auto-creates one
  // because the agent has none yet).
  //
  // `nameValidation.ok` is NOT in this guard on purpose — name shape
  // is surfaced as a non-blocking warning (red border + concise
  // hint). Collisions DO still block; those silently overwrite an
  // existing field at runtime, which is unrecoverable. Shape issues
  // only break extraction for THIS field; user can decide.
  const canSubmit = trimmedName.length > 0
    && !collidesWith
    && (lockedType !== undefined || noExtractorsAnywhere || selectedExtractors.size > 0);

  const toggleExtractor = (id: ID) => {
    setSelectedExtractors(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Group extractors by crew for clearer multi-select display.
  const byCrew = useMemo(() => {
    const groups = new Map<string, { crewName: string; items: typeof agentExtractors }>();
    for (const e of agentExtractors) {
      if (!groups.has(e.crewId)) groups.set(e.crewId, { crewName: e.crewName, items: [] });
      groups.get(e.crewId)!.items.push(e);
    }
    return Array.from(groups.values());
  }, [agentExtractors]);

  const submit = () => {
    if (!canSubmit) return;
    // Promote any fresh tag names into `agent.tags` so the Tags page
    // and autocomplete registry stay in sync — same side-effect the
    // SchemaFieldEditor's commitTags applies on the Fields page.
    if (agent && draft.tags.length > 0) {
      const declared = new Set(agent.tags ?? []);
      const fresh = draft.tags.filter(t => !declared.has(t));
      if (fresh.length > 0) {
        updateAgent(agentId, { tags: [...(agent.tags ?? []), ...fresh] });
      }
    }
    const draftField: Omit<FieldDef, 'id'> = {
      name: draft.name.trim(),
      type: draft.type,
      source: draft.source,
      howToExtract: draft.howToExtract.trim(),
      definition:   draft.definition.trim() || undefined,
      domain: draft.domain.trim() || undefined,
      ...(draft.type === 'enum' && draft.enumType ? { enumType: draft.enumType } : {}),
      ...(draft.tags.length > 0 ? { tags: draft.tags } : {}),
    };
    const created = addFieldToScope(
      'agent',
      draftField,
      Array.from(selectedExtractors),
      // If the agent has zero extractors anywhere, bootstrap one in
      // this crew automatically so the field has something to do —
      // EXCEPT in the caller-locked flow (DC page), where the author
      // explicitly wants a naked declaration and will wire it later.
      { createDefaultExtractor: noExtractorsAnywhere && lockedType === undefined },
    );
    onCreated?.(created);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={560}
      title="Add field"
      footer={
        <>
          <button type="button" className={styles.cancel} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.save}
            onClick={submit}
            disabled={!canSubmit}
          >
            Add field
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <label className={styles.field}>
          <span className={styles.label}>Name</span>
          <input
            className={`${styles.input} ${(!nameValidation.ok || nameSpaceBlocked) ? styles.inputInvalid : ''}`}
            autoFocus
            value={draft.name}
            onChange={e => {
              const raw = e.target.value;
              setNameSpaceBlocked(hadInvalidStripped(raw));
              setDraft(d => ({ ...d, name: stripInvalid(raw) }));
            }}
            placeholder="e.g. employment_status"
            onKeyDown={e => {
              if (e.key === 'Enter' && canSubmit) submit();
            }}
          />
          {/* Always rendered — the .nameWarning row has min-height so
              showing/hiding the text doesn't reflow the form below.
              Collision note has its own slab; space-block message
              takes priority over the shape warning since it's the
              more immediate keystroke feedback. */}
          <div className={styles.nameWarning}>
            {collidesWith
              ? ''
              : nameSpaceBlocked
                ? SPACE_BLOCKED_MESSAGE
                : !nameValidation.ok
                  ? nameValidation.reason
                  : ''}
          </div>
          {collidesWith && (
            <div className={styles.collisionNote}>
              A field <strong>"{collidesWith.name}"</strong> is already declared at the agent level.
              <div className={styles.collisionActions}>
                <button
                  type="button"
                  className={styles.collisionPrimary}
                  onClick={() => {
                    onWireExisting?.(collidesWith.id);
                    onClose();
                  }}
                  disabled={!onWireExisting}
                  title={onWireExisting
                    ? 'Wire this declared field to this crew'
                    : 'Wiring from this context is not available — close and use + Wire field'}
                >
                  Wire it here
                </button>
                <button
                  type="button"
                  className={styles.collisionGhost}
                  onClick={() => setDraft(d => ({ ...d, name: '' }))}
                >
                  Use a different name
                </button>
              </div>
            </div>
          )}
        </label>

        <div className={styles.row3}>
          {/* Type picker — hidden when the caller locks the type (e.g.
              the DC page opens this modal pre-locked to enum, so the
              user doesn't have to re-pick). */}
          {!lockedType && (
            <label className={styles.field}>
              <span className={styles.label}>Type</span>
              <select
                className={styles.input}
                // Encoded value: primitives use their plain name; enums
                // are "enum:<id>" so one change sets both type and
                // enumType — no separate dropdown below.
                value={draft.type === 'enum' && draft.enumType ? `enum:${draft.enumType}` : draft.type}
                onChange={e => {
                  const v = e.target.value;
                  if (v.startsWith('enum:')) {
                    setDraft(d => ({ ...d, type: 'enum', enumType: v.slice('enum:'.length) as ID }));
                  } else {
                    setDraft(d => ({ ...d, type: v as FieldType, enumType: '' }));
                  }
                }}
              >
                {PRIMITIVE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
                {(agent?.enums?.length ?? 0) > 0 && (
                  <optgroup label="Enums">
                    {(agent?.enums ?? []).map(en => (
                      <option key={en.id} value={`enum:${en.id}`}>{en.name}</option>
                    ))}
                  </optgroup>
                )}
                {draft.type === 'enum'
                  && draft.enumType
                  && !(agent?.enums ?? []).some(en => en.id === draft.enumType)
                  && (
                    <option value={`enum:${draft.enumType}`}>(missing enum)</option>
                  )}
              </select>
            </label>
          )}

          <label className={styles.field}>
            <span className={styles.label}>Source</span>
            <select
              className={styles.input}
              value={draft.source}
              onChange={e => setDraft(d => ({ ...d, source: e.target.value as FieldSource }))}
            >
              {(['explicit', 'inferred'] as FieldSource[]).map(s => (
                <option key={s} value={s} title={SOURCE_LABEL[s].hint}>
                  {SOURCE_LABEL[s].label}
                </option>
              ))}
            </select>
          </label>

        </div>

        {/* Enum preview strip — confirms what value vocabulary the
            user just bound, with a shortcut to edit the bible. */}
        {draft.type === 'enum' && draft.enumType && agent && (() => {
          const en = (agent.enums ?? []).find(e => e.id === draft.enumType);
          if (!en) {
            return (
              <div className={styles.enumPreviewError}>
                Bound enum "{draft.enumType}" no longer exists on the bible — pick a current one above.
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
                  No values declared on the bible yet
                </span>
              )}
              <Link
                to={`/${agent.slug}/builder/enums/${encodeURIComponent(en.name)}`}
                onClick={onClose}
                className={styles.enumPreviewLink}
              >
                Edit enum ↗
              </Link>
            </div>
          );
        })()}

        <label className={styles.field}>
          <span className={styles.label}>Domain</span>
          <DomainInput
            value={draft.domain}
            onChange={domain => setDraft(d => ({ ...d, domain }))}
            options={domainNames}
            onSubmit={() => {
              if (canSubmit) submit();
            }}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Tags</span>
          <TagsInput
            value={draft.tags}
            onChange={tags => setDraft(d => ({ ...d, tags }))}
            options={tagNames}
            placeholder="e.g. emotional_signals"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>
            Definition
            <span className={styles.labelSub}> · for you, never sent to the LLM</span>
          </span>
          <textarea
            className={styles.textarea}
            value={draft.definition}
            onChange={e => setDraft(d => ({ ...d, definition: e.target.value }))}
            placeholder="Your own note about what this field means. Builder-only — the runtime never reads it."
            dir={autoDir(draft.definition)}
            rows={2}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>How to extract</span>
          <textarea
            className={styles.textarea}
            value={draft.howToExtract}
            onChange={e => setDraft(d => ({ ...d, howToExtract: e.target.value }))}
            placeholder="What this field means. Don't list allowed enum values here — they're injected automatically."
            dir={autoDir(draft.howToExtract)}
          />
        </label>

        {/* ── Extracted-by multi-select ─────────────────────────── */}
        <div className={styles.field}>
          <span className={styles.label}>Extracted by</span>
          {noExtractorsAnywhere ? (
            <div className={styles.hintBlock}>
              No Field Extractors anywhere yet. A new one will be created
              in this crew when you add the field.
            </div>
          ) : (
            <div className={styles.extractorPickGroups}>
              {byCrew.map(group => (
                <div key={group.crewName} className={styles.extractorPickGroup}>
                  <div className={styles.extractorPickCrew}>{group.crewName}</div>
                  <div className={styles.extractorPickChips}>
                    {group.items.map(e => {
                      const active = selectedExtractors.has(e.instanceId);
                      return (
                        <button
                          key={e.instanceId}
                          type="button"
                          className={`${styles.extractorPickChip} ${active ? styles.extractorPickChipActive : ''}`}
                          onClick={() => toggleExtractor(e.instanceId)}
                        >
                          {e.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
