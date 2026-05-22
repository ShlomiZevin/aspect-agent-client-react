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

import { useBuilder } from '../../state/BuilderContext';
import { useAgentVersion } from '../../state/useEntityVersion';
import { TitleBar } from '../TitleBar/TitleBar';
import { VersionPill } from '../VersionMenu/VersionPill';
import { VersionMenu } from '../VersionMenu/VersionMenu';
import { FieldsPanel } from '../FieldsPanel/FieldsPanel';
import type { AgentDoc } from '../../types';
import styles from './Canvas.module.css';

interface Props {
  agent: AgentDoc;
}

export function AgentView({ agent }: Props) {
  const { updateAgent } = useBuilder();
  const versionState = useAgentVersion(agent.id);

  return (
    <>
      <TitleBar
        crumbs="Agent"
        level="agent"
        name={agent.name}
        onNameChange={name => updateAgent(agent.id, { name })}
        spec={agent.spec}
        onSpecChange={spec => updateAgent(agent.id, { spec })}
      >
        {versionState && (
          <>
            <VersionPill state={versionState} />
            <VersionMenu state={versionState} />
          </>
        )}
      </TitleBar>

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
