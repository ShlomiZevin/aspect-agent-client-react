/**
 * Cortex — chain of addons arranged in lanes. Card per addon; arrow
 * between cards in the active (Blocking) lane; click opens the addon
 * modal; drag-and-drop reorders within a lane.
 *
 * Lanes:
 *   - main / blocking  → active. Cards link with arrows.
 *   - background       → reserved. + disabled until we wire it up.
 *   - offline          → reserved. + disabled until we wire it up.
 *
 * Scope:
 *   - Pass `crew` → renders the crew's cortex (`crew.addons[]`).
 *   - Pass `crew={null}` → renders the agent-level cortex
 *     (`agent.cortex[]`), filtering out plugins that don't belong
 *     there (Talker, Transition Router).
 *
 * Variant flags:
 *   - `readOnly` — disables drag, hides the Add button, opens addon
 *      modal in view-only mode. Used by the crew view's "agent
 *      cortex runs here first" strip.
 *   - `compact`  — smaller chip layout. Strip uses this.
 */

import { useMemo, useState } from 'react';
import { newAddonInstanceId } from '../../state/BuilderContext';
import { useAddonMutations } from '../../state/useAddonMutations';
import { getPlugin, defaultContextFor, defaultOutputTypeFor } from '../../registry/plugins';
import { formatModelRef } from '../../registry/providerModels';
import { useModels } from '../../registry/useModels';
import { getLibraryEntry } from '../../state/addonLibrary';
import { AddonModal } from '../AddonModal/AddonModal';
import { AddStepModal, type AddStepChoice } from '../AddStepModal/AddStepModal';
import { AgentComboChip } from './AgentComboChip';
import { formatTrigger } from '../Trigger/triggerFormat';
import { FilterModal } from '../Filter/FilterModal';
import { FilterChipBadge } from '../Filter/FilterChipBadge';
import type { AddonContext, AddonInstance, AddonLane, AgentDoc, CrewDoc, ID, ModelRef } from '../../types';
import styles from './ChainCanvas.module.css';

interface Props {
  agent: AgentDoc;
  /** null → agent.cortex scope; otherwise → this crew's addons. */
  crew: CrewDoc | null;
  /** Disables editing actions (drag, add, modal Done/Remove). */
  readOnly?: boolean;
  /** Smaller chips + simpler header. Used by the strip in CrewView. */
  compact?: boolean;
  /** Optional extra header content rendered after the title — e.g. a
   *  link to the agent-level cortex page. The strip uses this. */
  headerSlot?: React.ReactNode;
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
  // Offline lane is enabled today for event-driven addons (Summarizer
  // and friends). For now, all triggers fire only as a reaction to a
  // user message (after the blocking chain) — no background scheduler.
  // Time-based / cron triggers are a future addition.
  { id: 'offline', title: 'Offline', hint: "Fires per trigger (every N msgs, on transition) after the reply", enabled: true },
];

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

export function ChainCanvas({ agent, crew, readOnly = false, compact = false, headerSlot }: Props) {
  const isAgentScope = crew === null;
  const crewId: ID | null = crew ? crew.id : null;
  const muts = useAddonMutations(agent.id, crewId);

  useModels();

  // Source of truth for the addon list — agent.cortex or crew.addons.
  const addons: AddonInstance[] = useMemo(
    () => (isAgentScope ? (agent.cortex ?? []) : (crew?.addons ?? [])),
    [isAgentScope, agent.cortex, crew?.addons],
  );

  const [editingInstanceId, setEditingInstanceId] = useState<ID | null>(null);
  const [addingForLane, setAddingForLane] = useState<AddonLane | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  // The chip's filter badge opens the focused FilterModal directly,
  // bypassing the regular addon settings modal — same affordance as
  // the "Filter" launcher inside AddonModal, so the author can reach
  // it from wherever they're looking.
  const [filterInstanceId, setFilterInstanceId] = useState<ID | null>(null);
  // Which chip the cursor is currently hovering. Drives the
  // "muted" filter badge's visibility — un-filtered chips show the
  // funnel affordance only when the author looks at THAT specific
  // chip, not on every card in the chain at once. Single number is
  // enough because the cursor can only be over one chip at a time.
  const [hoveredCardIdx, setHoveredCardIdx] = useState<number | null>(null);

  const editingInstance = useMemo(
    () => addons.find(a => a.instanceId === editingInstanceId) ?? null,
    [addons, editingInstanceId],
  );
  const filterInstance = useMemo(
    () => addons.find(a => a.instanceId === filterInstanceId) ?? null,
    [addons, filterInstanceId],
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
      muts.add(instance);
      setEditingInstanceId(instance.instanceId);
      return;
    }

    const entry = getLibraryEntry(choice.entryId);
    if (!entry) return;
    const entryPlugin = getPlugin(entry.pluginId);
    const instance: AddonInstance = {
      instanceId: newAddonInstanceId(),
      pluginId: entry.pluginId,
      lane,
      enabled: true,
      config: JSON.parse(JSON.stringify(entry.config)),
      context: entryPlugin ? defaultContextFor(entryPlugin) : { history: { mode: 'last_n', n: 5 } },
      outputType: entryPlugin ? defaultOutputTypeFor(entryPlugin) : 'json-to-memory',
      promptTemplate: entryPlugin?.defaultPromptTemplate ?? '',
    };
    muts.add(instance);
    setEditingInstanceId(instance.instanceId);
  };

  const wrapClassName = `${styles.canvas} ${compact ? styles.canvasCompact : ''} ${readOnly ? styles.canvasReadOnly : ''}`;

  return (
    <>
      <div className={wrapClassName}>
        <div className={styles.canvasHeader}>
          <span className={styles.canvasTitle}>🧠 {compact ? 'Agent cortex' : 'Cortex'}</span>
          {!compact && (
            <span className={styles.canvasSub}>
              {isAgentScope
                ? 'Runs before every crew on every turn'
                : 'How this crew reacts on every turn'}
            </span>
          )}
          {headerSlot}
        </div>

        {LANES.map(lane => {
          // Strip variant only ever shows the active lane — background /
          // offline are still placeholders.
          if (compact && lane.id !== 'main') return null;
          const items = addons.filter(a => a.lane === lane.id);
          const interactiveLane = lane.enabled && !readOnly;
          // Addons placed AFTER the Talker can't shape this turn's
          // reply (the Talker already streamed it). They may still
          // affect future turns by writing memory, but a Background
          // lane is the better home — surface a warning so the user
          // makes the call deliberately. `speaks === true` is the
          // canonical "this addon emits the user-facing response"
          // flag (set on Talker's descriptor), so this also covers
          // any future speaker plugin.
          const talkerIdx = lane.id === 'main'
            ? items.findIndex(a => getPlugin(a.pluginId)?.speaks === true)
            : -1;
          return (
            <div
              key={lane.id}
              className={`${styles.lane} ${lane.enabled ? '' : styles.laneDisabled}`}
            >
              {!compact && (
                <div className={styles.laneHeader}>
                  <span className={styles.laneTitle}>{lane.title}</span>
                  {lane.hint && <span className={styles.laneHint}>{lane.hint}</span>}
                  {!lane.enabled && <span className={styles.laneBadge}>reserved</span>}
                </div>
              )}

              <div className={styles.track}>
                {/* Agent combo chip — fixed first card in the crew
                    chain. Compact "this is what the agent runs before
                    me" anchor that opens a hover popup with the agent
                    chain (each entry click → read-only modal) and an
                    "Open agent" link. Not present at agent scope
                    (you're already editing it there). */}
                {!isAgentScope && lane.id === 'main' && (
                  <AgentComboChip agent={agent} compact={compact} />
                )}
                {items.length === 0 && compact && (
                  <span className={styles.compactEmpty}>
                    {isAgentScope ? 'No agent-level steps yet.' : 'No steps yet.'}
                  </span>
                )}
                {items.map((instance, i) => {
                  const desc = getPlugin(instance.pluginId);
                  if (!desc) return null;
                  const model = configModel(instance.config);
                  const isMainLane = lane.id === 'main';
                  const instanceName =
                    (instance.config && typeof (instance.config as { name?: unknown }).name === 'string'
                      ? ((instance.config as { name?: string }).name || '').trim()
                      : '') || desc.name;
                  const draggable = interactiveLane && isMainLane;
                  const isDragging = draggable && draggingIdx === i;
                  const isDropTarget = draggable && overIdx === i && draggingIdx !== null && draggingIdx !== i;
                  // First real addon needs an arrow when the agent
                  // combo chip sits before it (crew scope). Otherwise
                  // arrow logic stays as today (between addon[i-1]
                  // and addon[i]).
                  const drawLeadingArrow = isMainLane && (i > 0 || (!isAgentScope && i === 0));
                  // Addon sitting after the Talker — flag it so the
                  // user knows it can't shape this turn's reply. It
                  // can still write memory that affects future turns,
                  // but the Background tier (not yet enabled) is the
                  // intended home for that pattern.
                  //
                  // Transition Router is the canonical exception: its
                  // job is to decide the NEXT turn's crew based on what
                  // just happened, so its natural home is right after
                  // the Talker (read the answer, route from there).
                  // Don't flag it.
                  const isPostTalker = talkerIdx >= 0
                    && i > talkerIdx
                    && instance.pluginId !== 'transition-router';
                  const postTalkerTitle = isPostTalker
                    ? "Runs after the Talker has spoken — won't affect this turn's reply. May influence future turns by writing memory. Consider moving to the Background tier (not yet available)."
                    : undefined;
                  return (
                    <div key={instance.instanceId} className={styles.nodeWrap}>
                      {drawLeadingArrow && (
                        <span className={styles.arrow}>→</span>
                      )}
                      <button
                        type="button"
                        className={`${styles.card} ${compact ? styles.cardCompact : ''} ${isDragging ? styles.cardDragging : ''} ${isDropTarget ? styles.cardDropTarget : ''} ${isPostTalker ? styles.cardOrphan : ''} ${instance.enabled === false ? styles.cardDisabled : ''}`}
                        style={{ ['--card-color' as string]: desc.color }}
                        onClick={() => setEditingInstanceId(instance.instanceId)}
                        title={postTalkerTitle}
                        onMouseEnter={() => setHoveredCardIdx(i)}
                        onMouseLeave={() => setHoveredCardIdx(prev => (prev === i ? null : prev))}
                        draggable={draggable}
                        onDragStart={(e) => {
                          if (!draggable) return;
                          setDraggingIdx(i);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', String(i));
                        }}
                        onDragOver={(e) => {
                          if (!draggable || draggingIdx === null) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (overIdx !== i) setOverIdx(i);
                        }}
                        onDragLeave={() => {
                          if (overIdx === i) setOverIdx(null);
                        }}
                        onDrop={(e) => {
                          if (!draggable || draggingIdx === null) return;
                          e.preventDefault();
                          if (draggingIdx !== i) {
                            muts.reorderInLane('main', draggingIdx, i);
                          }
                          setDraggingIdx(null);
                          setOverIdx(null);
                        }}
                        onDragEnd={() => {
                          setDraggingIdx(null);
                          setOverIdx(null);
                        }}
                      >
                        {draggable && <span className={styles.dragHandle} aria-hidden="true">⋮⋮</span>}
                        {/* Enable/disable toggle — bottom-left of the
                            chip, kept far from the drag handle (top-
                            left) and the filter badge (top-right) so
                            the three affordances don't pile up. Track-
                            style switch with sliding thumb so the on
                            / off state is obvious at a glance. Click
                            flips `enabled`; the engine skips disabled
                            instances in `runOnce`. Mainly used for
                            testing — flip off, re-run, isolate
                            chain behaviour. Hidden in readOnly / compact. */}
                        {!compact && !readOnly && (
                          <span
                            role="button"
                            tabIndex={0}
                            aria-pressed={instance.enabled !== false}
                            aria-label={instance.enabled === false ? 'Enable addon' : 'Disable addon'}
                            title={instance.enabled === false
                              ? 'Disabled — click to enable'
                              : 'Enabled — click to disable (useful for testing)'}
                            className={`${styles.enableSwitch} ${instance.enabled === false ? styles.enableSwitchOff : styles.enableSwitchOn}`}
                            onClick={e => {
                              e.stopPropagation();
                              muts.setEnabled(instance.instanceId, instance.enabled === false);
                              // Drop focus so the ON state can hide
                              // again once the pointer leaves — without
                              // this, the click leaves the switch
                              // focused and a stale `:focus-visible`
                              // (on browsers that latch it on mouse
                              // click of role="button" spans) keeps
                              // the ON pill stuck visible.
                              (e.currentTarget as HTMLElement).blur();
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                muts.setEnabled(instance.instanceId, instance.enabled === false);
                              }
                            }}
                          >
                            <span className={styles.enableSwitchThumb} />
                            <span className={styles.enableSwitchLabel}>
                              {instance.enabled === false ? 'OFF' : 'ON'}
                            </span>
                          </span>
                        )}
                        <span className={styles.cardIcon}>{desc.icon}</span>
                        <span className={styles.cardName}>{instanceName}</span>
                        {isPostTalker && (
                          <span
                            className={styles.orphanBadge}
                            aria-hidden="true"
                            title="Won't affect this turn's reply"
                          >
                            after talker
                          </span>
                        )}
                        {!compact && (
                          <span
                            className={styles.cardModel}
                            style={model ? undefined : { visibility: 'hidden' }}
                            aria-hidden={!model || undefined}
                          >
                            {model ? formatModelRef(model) : ' '}
                          </span>
                        )}
                        {/* Offline-lane addons show their trigger
                            summary under the model line so the
                            author can see "when does this fire?" at
                            a glance, like the blocking-lane cards
                            show the model. Other lanes have no
                            trigger concept (background runs every
                            turn; main is the blocking chain). */}
                        {!compact && instance.lane === 'offline' && (
                          <span className={styles.cardTrigger}>
                            {formatTrigger((instance.context as AddonContext | undefined)?.trigger)}
                          </span>
                        )}
                        {/* Filter indicator + launcher — absolute
                            positioned in the card's top-right corner
                            so chip height stays uniform across the
                            row regardless of whether a filter is set.
                            Always rendered (even when no filter) in
                            a muted state so the "add a filter"
                            affordance is discoverable from every
                            chip; FilterChipBadge handles the state
                            styling and the instant-show hover popup.
                            Compact / readOnly modes suppress the
                            badge (no editing path makes sense). */}
                        {!compact && !readOnly && (
                          <FilterChipBadge
                            filter={(instance.context as AddonContext | undefined)?.filter}
                            chipHovered={hoveredCardIdx === i}
                            onOpen={() => setFilterInstanceId(instance.instanceId)}
                          />
                        )}
                      </button>
                    </div>
                  );
                })}

                {/* Add button — at the end of the lane, regardless of
                    Talker position. New addons that land after the
                    Talker get flagged as "after talker" so the user
                    notices and can drag them back if it wasn't
                    intentional. */}
                {!readOnly && (
                  lane.enabled ? (
                    <button
                      type="button"
                      className={`${styles.addCard} ${compact ? styles.addCardCompact : ''}`}
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
                  )
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
        crewId={crewId}
        instance={editingInstance}
        readOnly={readOnly}
      />

      <AddStepModal
        open={addingForLane !== null}
        onClose={() => setAddingForLane(null)}
        lane={addingForLane ?? 'main'}
        onPick={handlePick}
        scope={isAgentScope ? 'agent' : 'crew'}
      />

      <FilterModal
        open={filterInstance !== null}
        onClose={() => setFilterInstanceId(null)}
        agentId={agent.id}
        crewId={crewId}
        instance={filterInstance}
      />

    </>
  );
}
