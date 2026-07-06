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

/** Sentinel `crewId` value used for agent-level (Cortex) extractors.
 *  Agent addons don't belong to any crew, but the row shape wants a
 *  string key so downstream grouping / save code branches by
 *  `crewId === AGENT_SCOPE`. */
const AGENT_SCOPE = '__agent__';

interface ExtractorRow {
  /** Owning crew id, or `AGENT_SCOPE` for agent-level (Cortex) rows. */
  crewId: ID;
  crewName: string;
  instanceId: ID;
  pluginId: string;
  /** Plugin display name (e.g. "Field Extractor" / "Vibe Extractor")
   *  shown as a tiny subtitle so the user can tell the flavour apart
   *  when a crew has more than one kind. */
  pluginLabel: string;
  /** The instance's user-set name or auto-numbered fallback. */
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
  const {
    doc,
    updateAddonConfig,
    addAddon,
    updateAgentAddonConfig,
    addAgentAddon,
  } = useBuilder();
  const agent = doc.agents.find(a => a.id === agentId);

  // Snapshot the current wiring across the whole agent. `selected`
  // mirrors which instance ids should have this field in their
  // extractsFields after Save. Init from the current state so the
  // modal is a faithful "edit current wiring" surface.
  //
  // Two owner scopes surface here:
  //   1. Agent-level extractors on `agent.cortex[]` — run before any
  //      crew each turn.
  //   2. Crew-level extractors on each `crew.addons[]`.
  // Both flavours use the same `FieldExtractorConfig.extractsFields`
  // wiring, so the row shape is identical modulo `crewId` (which is
  // the sentinel `AGENT_SCOPE` for cortex rows).
  const allExtractorRows = useMemo<ExtractorRow[]>(() => {
    if (!agent || !field) return [];
    const out: ExtractorRow[] = [];

    // 1) Agent-level (Cortex) extractors.
    {
      const byPluginCount = new Map<string, number>();
      for (const a of (agent.cortex ?? [])) {
        const plugin = getPlugin(a.pluginId);
        if (!plugin || plugin.fieldMode !== 'extractor') continue;
        const idx = (byPluginCount.get(a.pluginId) || 0) + 1;
        byPluginCount.set(a.pluginId, idx);
        const cfg = (a.config as FieldExtractorConfig | undefined) || ({} as FieldExtractorConfig);
        const list = Array.isArray(cfg.extractsFields) ? cfg.extractsFields : [];
        out.push({
          crewId:      AGENT_SCOPE,
          crewName:    'Agent (Cortex)',
          instanceId:  a.instanceId,
          pluginId:    a.pluginId,
          pluginLabel: plugin.name || a.pluginId,
          label:       defaultLabelFor(a, idx),
          icon:        plugin.icon || '🛠',
          currentlyExtracts: list.includes(field.id),
        });
      }
    }

    // 2) Crew-level extractors.
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
          pluginLabel: plugin.name || a.pluginId,
          label:      defaultLabelFor(a, idx),
          icon:       plugin.icon || '🛠',
          currentlyExtracts: list.includes(field.id),
        });
      }
    }
    return out;
  }, [agent, field]);

  // Groups shown in the modal — Cortex FIRST (agent-level runs first
  // in the turn), then every crew. Every group offers a "+ Create"
  // affordance so the user can mint a fresh extractor pre-wired to
  // this field, in that scope, from here.
  const allGroups = useMemo(() => {
    const groups: Array<{ id: ID; name: string }> = [];
    if (agent) groups.push({ id: AGENT_SCOPE, name: 'Agent (Cortex)' });
    for (const c of agent?.crews ?? []) groups.push({ id: c.id, name: c.name });
    return groups;
  }, [agent]);

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
    //    and patch its config when the state changed. Agent-scope
    //    rows route to `updateAgentAddonConfig` (walks agent.cortex),
    //    crew-scope rows to `updateAddonConfig` (walks crew.addons).
    for (const r of allExtractorRows) {
      const should = selected.has(r.instanceId);
      if (should === r.currentlyExtracts) continue;

      if (r.crewId === AGENT_SCOPE) {
        const addon = (agent.cortex ?? []).find(x => x.instanceId === r.instanceId);
        if (!addon) continue;
        const cfg = (addon.config as FieldExtractorConfig) || ({} as FieldExtractorConfig);
        const list = Array.isArray(cfg.extractsFields) ? cfg.extractsFields : [];
        const nextList = should
          ? [...list, field.id]
          : list.filter(id => id !== field.id);
        const nextConfig: FieldExtractorConfig = { ...cfg, extractsFields: nextList };
        updateAgentAddonConfig(agentId, r.instanceId, nextConfig);
        continue;
      }

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

    // 2) Mint a new Field Extractor in each group the user opted
    //    into, pre-wired to this field. Agent-scope creates land on
    //    `agent.cortex` via `addAgentAddon`; crew-scope creates land
    //    on `crew.addons` via `addAddon`. Same instance shape both ways.
    for (const groupId of createIn) {
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
      if (groupId === AGENT_SCOPE) {
        addAgentAddon(agentId, instance as AddonInstance);
      } else {
        addAddon(agentId, groupId, instance as AddonInstance);
      }
    }

    onClose();
  };

  // Group rows by owner (agent-scope or crew id) for display.
  const rowsByGroup = useMemo(() => {
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

        {allGroups.length === 0 && (
          <div className={styles.empty}>No crews yet — add a crew first.</div>
        )}

        {allGroups.map(group => {
          const rows = rowsByGroup.get(group.id) ?? [];
          const willCreate = createIn.has(group.id);
          return (
            <div key={group.id}>
              <div className={styles.label} style={{ marginBottom: 6 }}>
                {group.name}
              </div>
              <div className={styles.chipGrid}>
                {rows.map(r => {
                  const active = selected.has(r.instanceId);
                  return (
                    <button
                      key={r.instanceId}
                      type="button"
                      className={`${styles.extractorCard} ${active ? styles.extractorCardActive : styles.extractorCardInactive}`}
                      onClick={() => toggleExtractor(r.instanceId)}
                      title={active ? 'Will extract this field' : 'Not extracting this field'}
                    >
                      <span className={styles.extractorIcon} aria-hidden>{r.icon}</span>
                      <span className={styles.extractorText}>
                        <span className={styles.extractorLabel}>{r.label}</span>
                        <span className={styles.extractorPluginLabel}>{r.pluginLabel}</span>
                      </span>
                      <span className={styles.extractorState}>
                        {active ? '✓' : '○'}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() => toggleCreate(group.id)}
                  style={willCreate ? { background: 'rgba(34, 197, 94, 0.12)', borderColor: 'rgba(34, 197, 94, 0.4)', color: '#15803d' } : undefined}
                  title={group.id === AGENT_SCOPE
                    ? 'Mint a new Field Extractor in the Cortex, pre-wired to this field'
                    : 'Mint a new Field Extractor in this crew, pre-wired to this field'}
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
