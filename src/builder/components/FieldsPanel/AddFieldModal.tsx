/**
 * AddFieldModal — quick add for a new field.
 *
 * Always shows the "Extracted by" picker (so the relationship is
 * explicit even with one option). When no extractor exists, the
 * picker offers "Create new Field Extractor" as its single option.
 *
 * `lockedExtractorId` hides the picker and forces the target. Used
 * when invoking from inside a specific extractor's config.
 *
 * Source dropdown is filtered by the target extractor's
 * `allowedFieldSources`. Domain input is autocomplete + create-new
 * via the shared DomainInput.
 */

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../Modal/Modal';
import { useCrewFields } from '../../state/useCrewFields';
import { getPlugin } from '../../registry/plugins';
import { DomainInput } from './DomainInput';
import type { FieldDef, FieldSource, FieldType, ID } from '../../types';
import styles from './AddFieldModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  agentId: ID;
  crewId: ID;
  /** If set, the extractor picker is hidden and this id is the target. */
  lockedExtractorId?: ID;
}

const CREATE_NEW = '__create_new__';

const TYPES: { value: FieldType; label: string }[] = [
  { value: 'string',  label: 'String' },
  { value: 'int',     label: 'Integer' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'enum',    label: 'Enum' },
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
  enumValues: string;
}

const emptyDraft = (defaultSource: FieldSource): Draft => ({
  name: '',
  type: 'string',
  source: defaultSource,
  domain: '',
  howToExtract: '',
  enumValues: '',
});

export function AddFieldModal({ open, onClose, agentId, crewId, lockedExtractorId }: Props) {
  const { extractors, extractorOptions, domainNames, addFieldToCrew } =
    useCrewFields(agentId, crewId);
  const [targetId, setTargetId] = useState<string>('');

  // Sources allowed by the currently-targeted extractor (or, if creating
  // a fresh extractor, by the Field Extractor plugin).
  const allowedSources: FieldSource[] = useMemo(() => {
    if (!targetId || targetId === CREATE_NEW) {
      const fe = getPlugin('field-extractor');
      return fe?.allowedFieldSources ?? ['explicit', 'inferred'];
    }
    const inst = extractors.find(e => e.instanceId === targetId);
    if (!inst) return ['explicit', 'inferred'];
    const desc = getPlugin(inst.pluginId);
    return desc?.allowedFieldSources ?? ['explicit', 'inferred'];
  }, [targetId, extractors]);

  const [draft, setDraft] = useState<Draft>(() => emptyDraft(allowedSources[0]));

  useEffect(() => {
    if (!open) return;
    if (lockedExtractorId) {
      setTargetId(lockedExtractorId);
    } else if (extractorOptions.length > 0) {
      setTargetId(extractorOptions[0].instanceId);
    } else {
      setTargetId(CREATE_NEW);
    }
  }, [open, extractorOptions, lockedExtractorId]);

  // Reset draft when the modal opens, picking the first allowed source.
  useEffect(() => {
    if (!open) return;
    setDraft(emptyDraft(allowedSources[0]));
    // We intentionally don't depend on allowedSources here so the user's
    // selection isn't clobbered every time they tweak the target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // If the user switches target to one with stricter sources, coerce.
  useEffect(() => {
    if (!allowedSources.includes(draft.source)) {
      setDraft(d => ({ ...d, source: allowedSources[0] }));
    }
  }, [allowedSources, draft.source]);

  const submit = () => {
    if (!draft.name.trim()) return;
    const draftField: Omit<FieldDef, 'id'> = {
      name: draft.name.trim(),
      type: draft.type,
      source: draft.source,
      howToExtract: draft.howToExtract.trim(),
      domain: draft.domain.trim() || undefined,
      ...(draft.type === 'enum' && {
        enumValues: draft.enumValues
          .split(',')
          .map(v => v.trim())
          .filter(Boolean),
      }),
    };
    const extractorTarget = targetId === CREATE_NEW ? undefined : targetId;
    addFieldToCrew(draftField, extractorTarget);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={520}
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
            disabled={!draft.name.trim()}
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
            className={styles.input}
            autoFocus
            value={draft.name}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            placeholder="e.g. employment_status"
            onKeyDown={e => {
              if (e.key === 'Enter' && draft.name.trim()) submit();
            }}
          />
        </label>

        <div className={styles.row3}>
          <label className={styles.field}>
            <span className={styles.label}>Type</span>
            <select
              className={styles.input}
              value={draft.type}
              onChange={e => setDraft(d => ({ ...d, type: e.target.value as FieldType }))}
            >
              {TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Source</span>
            <select
              className={styles.input}
              value={draft.source}
              onChange={e => setDraft(d => ({ ...d, source: e.target.value as FieldSource }))}
            >
              {allowedSources.map(s => (
                <option key={s} value={s} title={SOURCE_LABEL[s].hint}>
                  {SOURCE_LABEL[s].label}
                </option>
              ))}
            </select>
          </label>

          {!lockedExtractorId && (
            <label className={styles.field}>
              <span className={styles.label}>Extracted by</span>
              <select
                className={styles.input}
                value={targetId}
                onChange={e => setTargetId(e.target.value)}
              >
                {extractorOptions.map(o => (
                  <option key={o.instanceId} value={o.instanceId}>{o.label}</option>
                ))}
                <option value={CREATE_NEW}>+ Create new Field Extractor</option>
              </select>
            </label>
          )}
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Domain</span>
          <DomainInput
            value={draft.domain}
            onChange={domain => setDraft(d => ({ ...d, domain }))}
            options={domainNames}
            onSubmit={() => {
              if (draft.name.trim()) submit();
            }}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>How to extract</span>
          <textarea
            className={styles.textarea}
            value={draft.howToExtract}
            onChange={e => setDraft(d => ({ ...d, howToExtract: e.target.value }))}
            placeholder="What this field means. Don't list allowed enum values here — they're injected automatically."
          />
        </label>

        {draft.type === 'enum' && (
          <label className={styles.field}>
            <span className={styles.label}>Allowed values (comma-separated)</span>
            <input
              className={styles.input}
              value={draft.enumValues}
              onChange={e => setDraft(d => ({ ...d, enumValues: e.target.value }))}
              placeholder="e.g. salaried, self_employed, unemployed, retired"
            />
          </label>
        )}
      </div>
    </Modal>
  );
}
