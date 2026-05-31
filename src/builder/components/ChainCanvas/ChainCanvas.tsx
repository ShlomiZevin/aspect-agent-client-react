/**
 * Cortex — the crew's reasoning surface. Cards (addons) arranged in
 * lanes. Each card is one neuron of the cortex; the chain across the
 * Blocking lane is what fires synchronously on every message.
 *
 * Lanes:
 *   - main / blocking  → active. Cards link with arrows.
 *   - background       → reserved. + disabled until we wire it up.
 *   - offline          → reserved. + disabled until we wire it up.
 *
 * Cards open a config modal for their plugin. + opens the Add Step
 * picker.
 */

import { useMemo, useState } from 'react';
import { useBuilder, newAddonInstanceId } from '../../state/BuilderContext';
import { getPlugin, defaultContextFor, defaultOutputTypeFor } from '../../registry/plugins';
import { formatModelRef } from '../../registry/providerModels';
import { useModels } from '../../registry/useModels';
import { getLibraryEntry } from '../../state/addonLibrary';
import { AddonModal } from '../AddonModal/AddonModal';
import { AddStepModal, type AddStepChoice } from '../AddStepModal/AddStepModal';
import type { AddonInstance, AddonLane, AgentDoc, CrewDoc, ID, ModelRef } from '../../types';
import styles from './ChainCanvas.module.css';

interface Props {
  agent: AgentDoc;
  crew: CrewDoc;
}

type LaneSpec = {
  id: AddonLane;
  title: string;
  hint?: string;
  enabled: boolean;
};

const LANES: LaneSpec[] = [
  { id: 'main', title: 'Blocking', hint: 'Runs on every message, response waits for it', enabled: true },
  { id: 'background', title: 'Background', hint: "Runs per message, doesn't block the response", enabled: false },
  { id: 'offline', title: 'Offline', hint: 'Runs periodically, not per message', enabled: false },
];

/**
 * Best-effort pull of a `ModelRef` out of a plugin's opaque config blob
 * so the card can show the model name. Returns null if the plugin's
 * config doesn't expose `.model`.
 */
function configModel(config: unknown): ModelRef | null {
  if (
    config &&
    typeof config === 'object' &&
    'model' in (config as Record<string, unknown>) &&
    typeof (config as { model: unknown }).model === 'object' &&
    (config as { model: ModelRef }).model !== null
  ) {
    return (config as { model: ModelRef }).model;
  }
  return null;
}

export function ChainCanvas({ agent, crew }: Props) {
  const { addAddon, reorderAddonInLane } = useBuilder();
  // Subscribe to the model registry so formatModelRef calls below
  // re-render with proper labels (instead of `provider/id` fallback)
  // once the server registry has loaded.
  useModels();
  const [editingInstanceId, setEditingInstanceId] = useState<ID | null>(null);
  const [addingForLane, setAddingForLane] = useState<AddonLane | null>(null);
  // Drag-and-drop state for main-lane addon reordering. `draggingIdx`
  // is the lane-local index of the card being dragged; `overIdx` is
  // the card currently hovered (drop target). Both reset on dragend.
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const editingInstance = useMemo(
    () => crew.addons.find(a => a.instanceId === editingInstanceId) ?? null,
    [crew.addons, editingInstanceId],
  );

  const handlePick = (choice: AddStepChoice) => {
    const lane: AddonLane = addingForLane ?? 'main';

    if (choice.kind === 'fresh') {
      const desc = getPlugin(choice.pluginId);
      if (!desc) return;
      const instance: AddonInstance = {
        instanceId: newAddonInstanceId(),
        pluginId: choice.pluginId,
        lane,
        enabled: true,
        config: desc.defaultConfig(),
        context: defaultContextFor(desc),
        outputType: defaultOutputTypeFor(desc),
        promptTemplate: desc.defaultPromptTemplate,
      };
      addAddon(agent.id, crew.id, instance);
      setEditingInstanceId(instance.instanceId);
      return;
    }

    // Library import — copy the entry's config into a fresh instance.
    const entry = getLibraryEntry(choice.entryId);
    if (!entry) return;
    const entryPlugin = getPlugin(entry.pluginId);
    const instance: AddonInstance = {
      instanceId: newAddonInstanceId(),
      pluginId: entry.pluginId,
      lane,
      enabled: true,
      // Deep clone so later edits don't mutate the library entry.
      config: JSON.parse(JSON.stringify(entry.config)),
      context: entryPlugin ? defaultContextFor(entryPlugin) : { history: { mode: 'last_n', n: 5 } },
      outputType: entryPlugin ? defaultOutputTypeFor(entryPlugin) : 'json-to-memory',
      promptTemplate: entryPlugin?.defaultPromptTemplate ?? '',
    };
    addAddon(agent.id, crew.id, instance);
    setEditingInstanceId(instance.instanceId);
  };

  return (
    <>
      <div className={styles.canvas}>
        <div className={styles.canvasHeader}>
          <span className={styles.canvasTitle}>🧠 Cortex</span>
          <span className={styles.canvasSub}>How this crew reacts on every turn</span>
        </div>

        {LANES.map(lane => {
          const items = crew.addons.filter(a => a.lane === lane.id);
          return (
            <div
              key={lane.id}
              className={`${styles.lane} ${lane.enabled ? '' : styles.laneDisabled}`}
            >
              <div className={styles.laneHeader}>
                <span className={styles.laneTitle}>{lane.title}</span>
                {lane.hint && <span className={styles.laneHint}>{lane.hint}</span>}
                {!lane.enabled && <span className={styles.laneBadge}>reserved</span>}
              </div>

              <div className={styles.track}>
                {items.map((instance, i) => {
                  const desc = getPlugin(instance.pluginId);
                  if (!desc) return null;
                  const model = configModel(instance.config);
                  const isMainLane = lane.id === 'main';
                  // Prefer the user-set instance name (e.g. "Date Extractor")
                  // over the plugin's generic display name (e.g. "Field Extractor").
                  const instanceName =
                    (instance.config && typeof (instance.config as { name?: unknown }).name === 'string'
                      ? ((instance.config as { name?: string }).name || '').trim()
                      : '') || desc.name;
                  const isDragging = isMainLane && draggingIdx === i;
                  const isDropTarget = isMainLane && overIdx === i && draggingIdx !== null && draggingIdx !== i;
                  return (
                    <div key={instance.instanceId} className={styles.nodeWrap}>
                      {i > 0 && isMainLane && (
                        <span className={styles.arrow}>→</span>
                      )}
                      <button
                        type="button"
                        className={`${styles.card} ${isDragging ? styles.cardDragging : ''} ${isDropTarget ? styles.cardDropTarget : ''}`}
                        style={{ ['--card-color' as string]: desc.color }}
                        onClick={() => setEditingInstanceId(instance.instanceId)}
                        // Drag-and-drop is main-lane only. Background +
                        // offline lanes are reserved; once they ship
                        // we can decide whether to allow cross-lane drag.
                        draggable={isMainLane}
                        onDragStart={(e) => {
                          if (!isMainLane) return;
                          setDraggingIdx(i);
                          e.dataTransfer.effectAllowed = 'move';
                          // Required for Firefox to start a drag.
                          e.dataTransfer.setData('text/plain', String(i));
                        }}
                        onDragOver={(e) => {
                          if (!isMainLane || draggingIdx === null) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (overIdx !== i) setOverIdx(i);
                        }}
                        onDragLeave={() => {
                          if (overIdx === i) setOverIdx(null);
                        }}
                        onDrop={(e) => {
                          if (!isMainLane || draggingIdx === null) return;
                          e.preventDefault();
                          if (draggingIdx !== i) {
                            reorderAddonInLane(agent.id, crew.id, 'main', draggingIdx, i);
                          }
                          setDraggingIdx(null);
                          setOverIdx(null);
                        }}
                        onDragEnd={() => {
                          setDraggingIdx(null);
                          setOverIdx(null);
                        }}
                      >
                        {isMainLane && <span className={styles.dragHandle} aria-hidden="true">⋮⋮</span>}
                        <span className={styles.cardIcon}>{desc.icon}</span>
                        <span className={styles.cardName}>{instanceName}</span>
                        {/* Always render the model line so cards stay
                          * the same height across the row. Hidden via
                          * visibility (not display) when there's no
                          * model so layout space is preserved. */}
                        <span
                          className={styles.cardModel}
                          style={model ? undefined : { visibility: 'hidden' }}
                          aria-hidden={!model || undefined}
                        >
                          {model ? formatModelRef(model) : ' '}
                        </span>
                      </button>
                    </div>
                  );
                })}

                {lane.enabled ? (
                  <button
                    type="button"
                    className={styles.addCard}
                    onClick={() => setAddingForLane(lane.id)}
                    title={`Add step to ${lane.title}`}
                  >
                    +
                  </button>
                ) : (
                  <div
                    className={`${styles.addCard} ${styles.addCardDisabled}`}
                    title="This lane isn't active yet"
                    aria-disabled="true"
                  >
                    +
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <AddonModal
        open={editingInstance !== null}
        onClose={() => setEditingInstanceId(null)}
        agentId={agent.id}
        crewId={crew.id}
        instance={editingInstance}
      />

      <AddStepModal
        open={addingForLane !== null}
        onClose={() => setAddingForLane(null)}
        lane={addingForLane ?? 'main'}
        onPick={handlePick}
      />
    </>
  );
}
