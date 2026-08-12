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

/** Partition a lane's addons into STEPS (arrays of global indices).
 *  Mirrors the server's `deriveSteps` (BuilderRunner.js) exactly so
 *  the canvas shows precisely what will run: a run of adjacent cards
 *  where each after the first has `joinsPreviousStep === true`
 *  collapses into one step; the first card and any Talker always start
 *  a new step. Grouping applies to the Blocking (`main`) lane only —
 *  every other lane renders one card per step. */
function groupIntoSteps(items: AddonInstance[], isMainLane: boolean): number[][] {
  const steps: number[][] = [];
  items.forEach((inst, i) => {
    const isTalker = getPlugin(inst.pluginId)?.speaks === true;
    const joins =
      isMainLane
      && inst.joinsPreviousStep === true
      && !isTalker
      && steps.length > 0;
    if (joins) steps[steps.length - 1].push(i);
    else steps.push([i]);
  });
  return steps;
}

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
          const isMainLane = lane.id === 'main';
          // Partition into steps so a parallel step (2+ cards) can be
          // wrapped in a visible panel. Solo steps render as a plain
          // sequential node (as before).
          const steps = groupIntoSteps(items, isMainLane);
          // Indices that count as "inside a group" for drop targeting:
          // the non-leader members of a 2+ step. Dropping a card ONTO
          // one of these makes the dragged card JOIN that group (run in
          // parallel); dropping anywhere else isolates it (solo). The
          // leader is excluded — dropping onto it lands the card BEFORE
          // the group, i.e. outside it.
          const joinTargetIdx = new Set<number>();
          for (const g of steps) {
            if (g.length >= 2) {
              for (let k = 1; k < g.length; k++) joinTargetIdx.add(g[k]);
            }
          }
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
                {(() => {
                // Render ONE card chip (the big button) for global index `i`.
                // Pulled into a helper so the step loop below can place
                // cards either standalone (solo step) or inside a
                // parallel panel (multi-card step) without duplicating
                // the chip markup.
                const renderCard = (i: number) => {
                  const instance = items[i];
                  const desc = getPlugin(instance.pluginId);
                  if (!desc) return null;
                  const model = configModel(instance.config);
                  // Subtitle line under the name. Model-bearing addons show
                  // the model; KB Retriever (no single model) shows its KB
                  // count so the card keeps the same height as its neighbours.
                  const cardSubtitle = model
                    ? formatModelRef(model)
                    : instance.pluginId === 'kb-retriever'
                      ? (() => {
                          const ns = (instance.config as { kbNamespaces?: unknown[] })?.kbNamespaces;
                          const c = Array.isArray(ns) ? ns.length : 0;
                          return `${c} KB${c === 1 ? '' : 's'}`;
                        })()
                      : instance.pluginId === 'rules'
                        ? (() => {
                            const rs = (instance.config as { rules?: unknown[] })?.rules;
                            const c = Array.isArray(rs) ? rs.length : 0;
                            return `${c} rule${c === 1 ? '' : 's'}`;
                          })()
                        : '';
                  const instanceName =
                    (instance.config && typeof (instance.config as { name?: unknown }).name === 'string'
                      ? ((instance.config as { name?: string }).name || '').trim()
                      : '') || desc.name;
                  const draggable = interactiveLane && isMainLane;
                  const isDragging = draggable && draggingIdx === i;
                  const isDropTarget = draggable && overIdx === i && draggingIdx !== null && draggingIdx !== i;
                  // A drop here will JOIN the dragged card into this
                  // card's parallel group (vs isolate it). Used to tint
                  // the drop indicator so the outcome is visible before
                  // release.
                  const dropWillJoin = isDropTarget && joinTargetIdx.has(i);
                  // First real addon needs an arrow when the agent
                  // combo chip sits before it (crew scope). Otherwise
                  // arrow logic stays as today (between addon[i-1]
                  // and addon[i]).
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
                      <button
                        type="button"
                        className={`${styles.card} ${compact ? styles.cardCompact : ''} ${isDragging ? styles.cardDragging : ''} ${isDropTarget ? styles.cardDropTarget : ''} ${dropWillJoin ? styles.cardDropJoin : ''} ${isPostTalker ? styles.cardOrphan : ''} ${instance.enabled === false ? styles.cardDisabled : ''}`}
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
                            // Group-aware drop. The dragged card JOINS a
                            // parallel group iff it lands ON a non-leader
                            // member of one (joinTargetIdx); otherwise it
                            // is isolated (solo). Set the join bit first —
                            // by instanceId, so it's order-stable — then
                            // reorder by index. Both are functional setDoc
                            // updates, so they compose into one render.
                            const joins = joinTargetIdx.has(i);
                            muts.setJoinsPreviousStep(items[draggingIdx].instanceId, joins);
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
                            style={cardSubtitle ? undefined : { visibility: 'hidden' }}
                            aria-hidden={!cardSubtitle || undefined}
                          >
                            {cardSubtitle || ' '}
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
                  );
                };

                // Leading connector for global index `i`: a sequence
                // barrier (→) or a parallel join (‖). Clicking it flips
                // the stored `joinsPreviousStep` bit. Offered as a
                // toggle only on a real boundary between two Blocking-
                // lane cards whose right card isn't a Talker.
                const renderConnector = (i: number, joinsPrev: boolean) => {
                  const instance = items[i];
                  const drawLeadingArrow = isMainLane && (i > 0 || (!isAgentScope && i === 0));
                  if (!drawLeadingArrow) return null;
                  const canToggleJoin = interactiveLane
                    && i > 0
                    && getPlugin(instance.pluginId)?.speaks !== true;
                  // Barrier → drawn as the sequence arrow glyph; join
                  // drawn as two vertical bars (CSS) so "parallel" is
                  // unmistakable and doesn't depend on a fussy unicode
                  // glyph rendering.
                  const inner = joinsPrev
                    ? <span className={styles.joinBars} aria-hidden="true" />
                    : <span aria-hidden="true">→</span>;
                  if (!canToggleJoin) {
                    return <span className={styles.arrow}>{inner}</span>;
                  }
                  return (
                    <button
                      type="button"
                      className={`${styles.arrow} ${styles.arrowToggle}`}
                      title={joinsPrev
                        ? 'Parallel — runs at the same time as the previous step. Click to make it sequential.'
                        : 'Sequential — runs after the previous step finishes. Click to run it in parallel with the previous step.'}
                      aria-label={joinsPrev ? 'Make sequential' : 'Run in parallel with previous'}
                      onClick={(e) => {
                        e.stopPropagation();
                        muts.setJoinsPreviousStep(
                          instance.instanceId,
                          !(instance.joinsPreviousStep === true),
                        );
                      }}
                    >
                      {inner}
                    </button>
                  );
                };

                // Walk the steps. A solo step renders as a plain node
                // (connector + card). A parallel step (2+ cards) wraps
                // its members in a labeled panel: the barrier arrow sits
                // OUTSIDE the panel (the boundary into the group); the
                // ‖ joins sit INSIDE, between members.
                return steps.map(group => {
                  if (group.length === 1) {
                    const i = group[0];
                    return (
                      <div key={items[i].instanceId} className={styles.nodeWrap}>
                        {renderConnector(i, false)}
                        {renderCard(i)}
                      </div>
                    );
                  }
                  const firstIdx = group[0];
                  return (
                    <div key={items[firstIdx].instanceId} className={styles.nodeWrap}>
                      {renderConnector(firstIdx, false)}
                      {/* Overlay group: the tinted box (::before) and the
                          floating label are BOTH out of flow, so wrapping
                          cards in a group doesn't change the track height
                          — the box just appears around them. */}
                      <div className={styles.parallelGroup}>
                        <span className={styles.parallelGroupLabel}>
                          Parallel
                          <span className={styles.parallelGroupCount}>{group.length}</span>
                        </span>
                        {group.map((i, k) => (
                          <div key={items[i].instanceId} className={styles.nodeWrap}>
                            {k > 0 && renderConnector(i, true)}
                            {renderCard(i)}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
                })()}

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
