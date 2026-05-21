import { useBuilder } from '../../state/BuilderContext';
import { useAgentVersion } from '../../state/useEntityVersion';
import { TitleBar } from '../TitleBar/TitleBar';
import { VersionPill } from '../VersionMenu/VersionPill';
import { VersionMenu } from '../VersionMenu/VersionMenu';
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
    </>
  );
}
