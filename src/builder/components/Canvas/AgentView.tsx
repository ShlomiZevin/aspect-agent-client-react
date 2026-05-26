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
import { useAgentVersion } from '../../state/useEntityVersion';
import { TitleBar } from '../TitleBar/TitleBar';
import { VersionPill } from '../VersionMenu/VersionPill';
import { VersionMenu } from '../VersionMenu/VersionMenu';
import { FieldsPanel } from '../FieldsPanel/FieldsPanel';
import { BodyJsonModal } from '../BodyJsonModal/BodyJsonModal';
import { ValidateAndLogModal } from '../ValidateAndLogModal/ValidateAndLogModal';
import { HistoryModal } from '../HistoryModal/HistoryModal';
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
  const ownerUserId = findOwnerUserId();

  // True when this agent has an un-saved Alfred apply target. The
  // banner below cues the user that Save will commit Alfred's draft.
  const hasPendingApplyForAgent = !!pendingAlfredApply?.targets.some(
    t => !t.applied && t.entity === 'agent' && t.entityId === agent.id,
  );

  // Working-copy AgentBody view. Crews live outside the agent body
  // (each has its own version history) so we don't include them here —
  // matches what the patch generator will see in P5.2.
  const agentBody = {
    name:          agent.name,
    slug:          agent.slug,
    spec:          agent.spec,
    persona:       agent.persona,
    defaultCrewId: agent.defaultCrewId,
    fields:        agent.fields,
  };

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
          <>
            <VersionPill state={versionState} />
            <VersionMenu state={versionState} />
          </>
        )}
      </TitleBar>

      {hasPendingApplyForAgent && pendingAlfredApply && (
        <div className={styles.alfredBanner}>
          <span className={styles.alfredBannerIcon}>✨</span>
          <span className={styles.alfredBannerText}>
            <strong>Alfred draft</strong>
            <span className={styles.alfredBannerDot}>·</span>
            {pendingAlfredApply.description || 'Pending changes from Alfred'}
            <span className={styles.alfredBannerDot}>·</span>
            Save to commit (you'll pick how to log it), or Discard to revert.
          </span>
        </div>
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
            </p>
            <textarea
              className={styles.textarea}
              value={agent.persona}
              onChange={e => updateAgent(agent.id, { persona: e.target.value })}
              placeholder="Describe how the agent sounds, the tone, and what it never does…"
            />
          </div>
        </div>

        <aside className={styles.crewSide}>
          <FieldsPanel agentId={agent.id} />
        </aside>
      </div>
    </>
  );
}
