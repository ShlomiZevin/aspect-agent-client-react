/**
 * WireToCrewModal — wire one or more declared agent fields to THIS crew.
 *
 * Mirror image of the Schema panel's WireFieldModal: that one was
 * "one field → many crews", this one is "one crew → many fields".
 * Surfaced from the FieldsPanel header in CrewView so the user can
 * collect existing schema declarations without leaving the crew they're
 * editing.
 *
 * Behaviour:
 *  - Lists every agent field NOT currently wired to this crew (i.e.
 *    no Field Extractor here has its id in `extractsFields`). Already-
 *    wired fields are filtered out — there's nothing for the modal to
 *    do with them.
 *  - On Save:
 *    - If the crew already has a Field Extractor, append the picked
 *      field ids to its `extractsFields` list.
 *    - If not, mint a fresh Field Extractor in this crew (matches the
 *      auto-create path AddFieldModal uses) pre-populated with the
 *      picked field ids.
 *
 * No new declarations happen here — that's AddFieldModal's job.
 */

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../Modal/Modal';
import { useBuilder, newAddonInstanceId } from '../../state/BuilderContext';
import {
  FIELD_EXTRACTOR_PLUGIN_ID,
  fieldExtractorPlugin,
} from '../../plugins/fieldExtractor/addon.fieldExtractor';
import { defaultContextFor, defaultOutputTypeFor, getPlugin } from '../../registry/plugins';
import type {
  AddonInstance,
  FieldDef,
  FieldExtractorConfig,
  ID,
} from '../../types';
import styles from './WireToCrewModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  agentId: ID;
  crewId: ID;
  /** Optional: a field to start with pre-selected. Used by the
   *  AddFieldModal's "Wire it here" path so the user lands in the
   *  modal with the colliding field already ticked. */
  initiallySelectedFieldId?: ID | null;
}

export function WireToCrewModal({
  open, onClose, agentId, crewId, initiallySelectedFieldId,
}: Props) {
  const { doc, updateAddonConfig, addAddon } = useBuilder();
  const agent = doc.agents.find(a => a.id === agentId);
  const crew = agent?.crews.find(c => c.id === crewId);

  // Build the pool: every agent field NOT already wired to a Field
  // Extractor in this crew. Crew-scoped fields (legacy) are excluded
  // — they live on the crew and aren't "declarations" in the schema
  // sense, so the wire flow doesn't apply.
  const candidates = useMemo<FieldDef[]>(() => {
    if (!agent || !crew) return [];
    const wiredHere = new Set<string>();
    for (const a of crew.addons) {
      const plugin = getPlugin(a.pluginId);
      if (!plugin || plugin.fieldMode !== 'extractor') continue;
      const cfg = (a.config as FieldExtractorConfig | undefined);
      const list = Array.isArray(cfg?.extractsFields) ? cfg!.extractsFields : [];
      for (const id of list) wiredHere.add(id);
    }
    return (agent.fields ?? []).filter(f => !wiredHere.has(f.id));
  }, [agent, crew]);

  const [picked, setPicked] = useState<Set<ID>>(new Set());

  useEffect(() => {
    if (!open) return;
    const init = new Set<ID>();
    if (initiallySelectedFieldId && candidates.some(f => f.id === initiallySelectedFieldId)) {
      init.add(initiallySelectedFieldId);
    }
    setPicked(init);
  }, [open, initiallySelectedFieldId, candidates]);

  const toggle = (id: ID) => {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    if (!agent || !crew || picked.size === 0) {
      onClose();
      return;
    }
    const fieldIds = Array.from(picked);

    // Find an existing Field Extractor in this crew. We append to the
    // first one if present — matches the "single source of truth" pattern
    // and avoids cluttering the chain with parallel extractors for the
    // same purpose.
    const existing = crew.addons.find(a => {
      const plugin = getPlugin(a.pluginId);
      return plugin?.fieldMode === 'extractor' && a.pluginId === FIELD_EXTRACTOR_PLUGIN_ID;
    }) as AddonInstance<FieldExtractorConfig> | undefined;

    if (existing) {
      const list = Array.isArray(existing.config.extractsFields) ? existing.config.extractsFields : [];
      const merged = Array.from(new Set([...list, ...fieldIds]));
      const nextConfig: FieldExtractorConfig = { ...existing.config, extractsFields: merged };
      updateAddonConfig(agentId, crewId, existing.instanceId, nextConfig);
    } else {
      const instance: AddonInstance<FieldExtractorConfig> = {
        instanceId:     newAddonInstanceId(),
        pluginId:       FIELD_EXTRACTOR_PLUGIN_ID,
        lane:           fieldExtractorPlugin.defaultLane,
        enabled:        true,
        config:         { ...fieldExtractorPlugin.defaultConfig(), extractsFields: fieldIds },
        context:        defaultContextFor(fieldExtractorPlugin),
        outputType:     defaultOutputTypeFor(fieldExtractorPlugin),
        promptTemplate: fieldExtractorPlugin.defaultPromptTemplate,
      };
      addAddon(agentId, crewId, instance as AddonInstance);
    }

    onClose();
  };

  // Group candidates by domain for scannability.
  const grouped = useMemo(() => {
    const byDomain = new Map<string, FieldDef[]>();
    const orphan: FieldDef[] = [];
    for (const f of candidates) {
      const d = f.domain?.trim();
      if (d) {
        if (!byDomain.has(d)) byDomain.set(d, []);
        byDomain.get(d)!.push(f);
      } else {
        orphan.push(f);
      }
    }
    return {
      groups: Array.from(byDomain.entries()).sort(([a], [b]) => a.localeCompare(b)),
      orphan,
    };
  }, [candidates]);

  const crewName = crew?.name ?? 'this crew';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Wire fields to "${crewName}"`}
      width={520}
      footer={
        <div className={styles.actions}>
          <span className={styles.spacer} />
          <button type="button" className={styles.cancel} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.save}
            disabled={picked.size === 0}
            onClick={handleSave}
          >
            Wire {picked.size > 0 ? `(${picked.size})` : ''}
          </button>
        </div>
      }
    >
      {candidates.length === 0 ? (
        <div className={styles.empty}>
          Every declared field is already wired to this crew. To declare a
          new one, use <strong>+ Add field</strong>.
        </div>
      ) : (
        <div className={styles.list}>
          <div className={styles.hint}>
            Pick declared agent fields to collect in {crewName}.
            They'll be added to the crew's Field Extractor
            (one will be created if none exists yet).
          </div>
          {grouped.groups.map(([domainName, list]) => (
            <CandidateGroup
              key={domainName}
              label={domainName}
              fields={list}
              picked={picked}
              onToggle={toggle}
            />
          ))}
          {grouped.orphan.length > 0 && (
            <CandidateGroup
              label="(no domain)"
              fields={grouped.orphan}
              picked={picked}
              onToggle={toggle}
            />
          )}
        </div>
      )}
    </Modal>
  );
}

function CandidateGroup({
  label, fields, picked, onToggle,
}: {
  label: string;
  fields: FieldDef[];
  picked: Set<ID>;
  onToggle: (id: ID) => void;
}) {
  return (
    <div className={styles.group}>
      <div className={styles.groupLabel}>{label}</div>
      <div className={styles.rows}>
        {fields.map(f => {
          const active = picked.has(f.id);
          return (
            <button
              key={f.id}
              type="button"
              className={`${styles.row} ${active ? styles.rowActive : ''}`}
              onClick={() => onToggle(f.id)}
            >
              <span className={styles.check} aria-hidden>
                {active ? '✓' : '○'}
              </span>
              <span className={styles.name}>{f.name}</span>
              <span className={styles.type}>· {f.type}</span>
              {f.howToExtract && (
                <span className={styles.desc}>{f.howToExtract}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
