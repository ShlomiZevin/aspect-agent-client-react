/**
 * AgentView — agent-level editor.
 *
 * Uses the same two-column layout as CrewView so switching between
 * "Agent" and a crew doesn't visually reshuffle the page:
 *
 *   ┌───────────────────────────────────┐
 *   │  Agent name             [📖 Spec] │
 *   ├─────────────────────────┬─────────┤
 *   │  🎭 Persona             │ 💾      │
 *   │    [textarea]           │ Memory  │
 *   │                         │ (agent  │
 *   │                         │  fields)│
 *   └─────────────────────────┴─────────┘
 *
 * Same `crewGrid` / `crewMain` / `crewSide` CSS classes — they were
 * always layout-shaped, not crew-specific (rename pending if we
 * want to keep things tidy).
 */

import { useState } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import { MentionTextarea } from '../MentionTextarea/MentionTextarea';
import { useMentionOptions } from '../MentionTextarea/useMentionOptions';
import { useAgentVersion } from '../../state/useEntityVersion';
import { TitleBar } from '../TitleBar/TitleBar';
import { VersionPill } from '../VersionMenu/VersionPill';
import { SchemaPanel } from '../SchemaPanel/SchemaPanel';
import { BodyJsonModal } from '../BodyJsonModal/BodyJsonModal';
import { ValidateAndLogModal } from '../ValidateAndLogModal/ValidateAndLogModal';
import { HistoryModal } from '../HistoryModal/HistoryModal';
import { PendingApplyDetailsModal } from '../PendingApplyDetailsModal/PendingApplyDetailsModal';
import type { AgentDoc } from '../../types';
import styles from './Canvas.module.css';

interface Props {
  agent: AgentDoc;
}

function findOwnerUserId(): string {
  try { return localStorage.getItem('builder:ownerUserId') || 'anon'; } catch { return 'anon'; }
}

export function AgentView({ agent }: Props) {
  const { updateAgent, pendingAlfredApply } = useBuilder();
  const versionState = useAgentVersion(agent.id);
  const [jsonOpen,    setJsonOpen]    = useState(false);
  const [logOpen,     setLogOpen]     = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingDetailsOpen, setPendingDetailsOpen] = useState(false);
  const ownerUserId = findOwnerUserId();
  // Persona supports the same mention vocabulary as crew prompts so
  // static config (`#param:bankName`) and memory references can be
  // baked into the agent's voice. {{persona}} resolves once at runtime
  // — nested {{persona}} won't recurse; the assembler short-circuits.
  const mentionOptions = useMentionOptions(agent.id);

  // True when this agent has an un-saved Alfred apply target. The
  // banner below cues the user that Save will commit Alfred's draft.
  const hasPendingApplyForAgent = !!pendingAlfredApply?.targets.some(
    t => !t.applied && t.entity === 'agent' && t.entityId === agent.id,
  );

  // Debug viewer — show the working-copy AgentDoc as-is, minus the
  // two heavy nested collections (crews each have their own viewer;
  // versions are history, not current state). Anything else added to
  // AgentDoc later shows up automatically.
  const agentBody = { ...agent, versions: undefined, crews: undefined };

  return (
    <>
      <TitleBar
        crumbs="Agent"
        level="agent"
        name={agent.name}
        onNameChange={name => updateAgent(agent.id, { name })}
        spec={agent.spec}
        onSpecChange={spec => updateAgent(agent.id, { spec })}
        metaActions={
          <>
            <button
              type="button"
              className={styles.logBtn}
              onClick={() => setHistoryOpen(true)}
              title="View the agent's change history"
            >
              📜 History
            </button>
            <button
              type="button"
              className={styles.logBtn}
              onClick={() => setLogOpen(true)}
              title="Validate a manual change and add it to the agent log"
            >
              ✓ Log
            </button>
            <button
              type="button"
              className={styles.jsonBtn}
              onClick={() => setJsonOpen(true)}
              title="View this agent's JSON"
            >
              {'{ }'}
            </button>
          </>
        }
      >
        {versionState && (
          /* Save / Save as / Discard / ⭐ Set as active live in the
             TopBar globally. Keep the pill here for at-a-glance
             "what version am I editing" without bouncing your eye to
             the top of the page. */
          <VersionPill state={versionState} />
        )}
      </TitleBar>

      {hasPendingApplyForAgent && pendingAlfredApply && (
        <div className={styles.alfredBanner}>
          <span className={styles.alfredBannerIcon}>✨</span>
          <span className={styles.alfredBannerText}>
            <strong>Alfred draft</strong>
            <span className={styles.alfredBannerDot}>·</span>
            {pendingAlfredApply.summary || 'Pending changes from Alfred'}
            <span className={styles.alfredBannerDot}>·</span>
            Save to commit, or Discard to revert.
          </span>
          <button
            type="button"
            className={styles.alfredBannerBtn}
            onClick={() => setPendingDetailsOpen(true)}
            title="See the full plan and per-target changes"
          >
            Details
          </button>
        </div>
      )}

      {pendingAlfredApply && (
        <PendingApplyDetailsModal
          open={pendingDetailsOpen}
          onClose={() => setPendingDetailsOpen(false)}
          pending={pendingAlfredApply}
        />
      )}

      <BodyJsonModal
        open={jsonOpen}
        onClose={() => setJsonOpen(false)}
        level="agent"
        ownerName={agent.name}
        body={agentBody}
      />

      <ValidateAndLogModal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        agentId={agent.id}
        agentSlug={agent.slug}
        ownerUserId={ownerUserId}
        entity="agent"
        entityId={agent.id}
        entityName={agent.name}
      />

      <HistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        agentId={agent.id}
        agentName={agent.name}
        currentOwnerUserId={ownerUserId}
      />

      <div className={styles.crewGrid}>
        <div className={styles.crewMain}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>🎭 Persona</span>
            </div>
            <p className={styles.cardHint}>
              Shared character / voice across every crew of this agent.
              Type <kbd>#</kbd> to drop in agent parameters (e.g. <code>{`{{param:bankName}}`}</code>),
              {' '}<kbd>@</kbd> for memory references,
              {' '}<kbd>/</kbd> for the full picker.
            </p>
            <MentionTextarea
              value={agent.persona}
              onChange={persona => updateAgent(agent.id, { persona })}
              options={mentionOptions}
              placeholder="Describe how the agent sounds, the tone, and what it never does…"
              rows={8}
            />
          </div>
        </div>

        <aside className={styles.crewSide}>
          <SchemaPanel agentId={agent.id} />
        </aside>
      </div>
    </>
  );
}
