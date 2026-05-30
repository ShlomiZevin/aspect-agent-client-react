/**
 * WireFieldModal — collect a declared agent field into one or more crews.
 *
 * The Schema panel decouples "declare a field" from "have a crew
 * collect it". This modal is the second step: given an existing
 * `FieldDef`, the user picks which crew(s) should extract it and which
 * extractor instance(s) inside those crews own the wiring. If a crew
 * has no Field Extractor yet, a "+ Create extractor here" affordance
 * mints one and ticks the field on it in the same save.
 *
 * The mental model the user already knows from CrewView is: a field
 * is wired iff at least one extractor has its id in `extractsFields`.
 * This modal lets them flip that wiring across crews from a single
 * place — the Schema view — without having to navigate crew-by-crew.
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
import styles from './SchemaPanel.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  agentId: ID;
  field: FieldDef | null;
}

interface ExtractorRow {
  crewId: ID;
  crewName: string;
  instanceId: ID;
  pluginId: string;
  label: string;
  icon: string;
  currentlyExtracts: boolean;
}

function defaultLabelFor(a: AddonInstance, suffixIdx?: number): string {
  const plugin = getPlugin(a.pluginId);
  const userName = ((a.config as { name?: string })?.name || '').trim();
  if (userName) return userName;
  const base = plugin?.name || 'Extractor';
  return suffixIdx && suffixIdx > 1 ? `${base} #${suffixIdx}` : base;
}

export function WireFieldModal({ open, onClose, agentId, field }: Props) {
  const { doc, updateAddonConfig, addAddon } = useBuilder();
  const agent = doc.agents.find(a => a.id === agentId);

  // Snapshot the current wiring across the whole agent. `selected`
  // mirrors which instance ids should have this field in their
  // extractsFields after Save. Init from the current state so the
  // modal is a faithful "edit current wiring" surface.
  const allExtractorRows = useMemo<ExtractorRow[]>(() => {
    if (!agent || !field) return [];
    const out: ExtractorRow[] = [];
    for (const crew of agent.crews) {
      const byPluginCount = new Map<string, number>();
      for (const a of crew.addons) {
        const plugin = getPlugin(a.pluginId);
        if (!plugin || plugin.fieldMode !== 'extractor') continue;
        const idx = (byPluginCount.get(a.pluginId) || 0) + 1;
        byPluginCount.set(a.pluginId, idx);
        const cfg = (a.config as FieldExtractorConfig | undefined) || ({} as FieldExtractorConfig);
        const list = Array.isArray(cfg.extractsFields) ? cfg.extractsFields : [];
        out.push({
          crewId:   crew.id,
          crewName: crew.name,
          instanceId: a.instanceId,
          pluginId:   a.pluginId,
          label:      defaultLabelFor(a, idx),
          icon:       plugin.icon || '🛠',
          currentlyExtracts: list.includes(field.id),
        });
      }
    }
    return out;
  }, [agent, field]);

  // Map<crewId, crewName>. Every crew is offered even if it has no
  // extractor — those get a "+ Create" affordance.
  const allCrews = useMemo(() => agent?.crews ?? [], [agent]);

  const [selected, setSelected] = useState<Set<ID>>(new Set());
  const [createIn, setCreateIn] = useState<Set<ID>>(new Set());

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(allExtractorRows.filter(r => r.currentlyExtracts).map(r => r.instanceId)));
    setCreateIn(new Set());
  }, [open, allExtractorRows]);

  const toggleExtractor = (id: ID) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleCreate = (crewId: ID) => {
    setCreateIn(prev => {
      const next = new Set(prev);
      if (next.has(crewId)) next.delete(crewId); else next.add(crewId);
      return next;
    });
  };

  const handleSave = () => {
    if (!field || !agent) return;

    // 1) Diff each existing extractor against the target selection
    //    and patch its config when the state changed.
    for (const r of allExtractorRows) {
      const should = selected.has(r.instanceId);
      if (should === r.currentlyExtracts) continue;
      const crew = agent.crews.find(c => c.id === r.crewId);
      const addon = crew?.addons.find(x => x.instanceId === r.instanceId);
      if (!crew || !addon) continue;
      const cfg = (addon.config as FieldExtractorConfig) || ({} as FieldExtractorConfig);
      const list = Array.isArray(cfg.extractsFields) ? cfg.extractsFields : [];
      const nextList = should
        ? [...list, field.id]
        : list.filter(id => id !== field.id);
      const nextConfig: FieldExtractorConfig = { ...cfg, extractsFields: nextList };
      updateAddonConfig(agentId, r.crewId, r.instanceId, nextConfig);
    }

    // 2) Mint a new Field Extractor in each crew the user opted into,
    //    pre-wired to this field. Same shape as the existing
    //    auto-create path inside addFieldToScope so they're indistinguishable.
    for (const crewId of createIn) {
      const instance: AddonInstance<FieldExtractorConfig> = {
        instanceId: newAddonInstanceId(),
        pluginId:   FIELD_EXTRACTOR_PLUGIN_ID,
        lane:       fieldExtractorPlugin.defaultLane,
        enabled:    true,
        config:     { ...fieldExtractorPlugin.defaultConfig(), extractsFields: [field.id] },
        context:    defaultContextFor(fieldExtractorPlugin),
        outputType: defaultOutputTypeFor(fieldExtractorPlugin),
        promptTemplate: fieldExtractorPlugin.defaultPromptTemplate,
      };
      addAddon(agentId, crewId, instance as AddonInstance);
    }

    onClose();
  };

  // Group rows by crew for display.
  const rowsByCrew = useMemo(() => {
    const map = new Map<ID, ExtractorRow[]>();
    for (const r of allExtractorRows) {
      if (!map.has(r.crewId)) map.set(r.crewId, []);
      map.get(r.crewId)!.push(r);
    }
    return map;
  }, [allExtractorRows]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={field ? `Collect "${field.name}" in…` : 'Collect field'}
      width={560}
      footer={
        <div className={styles.actions}>
          <span className={styles.spacerInline} />
          <button type="button" className={styles.btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleSave}
          >
            Save wiring
          </button>
        </div>
      }
    >
      <div className={styles.form}>
        <div className={styles.usageHint}>
          Tick existing extractors to include this field. Use "+ Create
          extractor" to mint a fresh Field Extractor inside a crew with
          this field pre-wired.
        </div>

        {allCrews.length === 0 && (
          <div className={styles.empty}>No crews yet — add a crew first.</div>
        )}

        {allCrews.map(crew => {
          const rows = rowsByCrew.get(crew.id) ?? [];
          const willCreate = createIn.has(crew.id);
          return (
            <div key={crew.id}>
              <div className={styles.label} style={{ marginBottom: 6 }}>
                {crew.name}
              </div>
              <div className={styles.chipGrid}>
                {rows.map(r => {
                  const active = selected.has(r.instanceId);
                  return (
                    <button
                      key={r.instanceId}
                      type="button"
                      className={styles.chip}
                      onClick={() => toggleExtractor(r.instanceId)}
                      style={active ? undefined : { opacity: 0.5 }}
                      title={active ? 'Will extract this field' : 'Not extracting this field'}
                    >
                      <span aria-hidden>{r.icon}</span>
                      {r.label}
                      <span className={styles.chipCount}>
                        {active ? '✓' : '○'}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() => toggleCreate(crew.id)}
                  style={willCreate ? { background: 'rgba(34, 197, 94, 0.12)', borderColor: 'rgba(34, 197, 94, 0.4)', color: '#15803d' } : undefined}
                  title="Mint a new Field Extractor in this crew, pre-wired to this field"
                >
                  {willCreate ? '✓ new extractor here' : '+ Create extractor'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
