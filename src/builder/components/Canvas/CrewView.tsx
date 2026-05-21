/**
 * CrewView — day-to-day editor for one crew.
 *
 *   ┌───────────────────────────────────┐
 *   │  Crew name              [📖 Spec] │
 *   ├─────────────────────────┬─────────┤
 *   │  🧠 Cortex              │  📝     │
 *   │    Blocking             │  Fields │
 *   │      [Field Extractor]  │         │
 *   │      [Talker]           │         │
 *   │    Background           │         │
 *   │    Offline              │         │
 *   └─────────────────────────┴─────────┘
 *
 * The crew has no prompt of its own — the Talker addon owns the
 * response prompt. The Cortex is the entire crew behaviour.
 */

import { useBuilder } from '../../state/BuilderContext';
import { useCrewVersion } from '../../state/useEntityVersion';
import { TitleBar } from '../TitleBar/TitleBar';
import { ChainCanvas } from '../ChainCanvas/ChainCanvas';
import { FieldsPanel } from '../FieldsPanel/FieldsPanel';
import { VersionMenu } from '../VersionMenu/VersionMenu';
import { VersionPill } from '../VersionMenu/VersionPill';
import type { AgentDoc, CrewDoc } from '../../types';
import styles from './Canvas.module.css';

interface Props {
  agent: AgentDoc;
  crew: CrewDoc;
}

export function CrewView({ agent, crew }: Props) {
  const { updateCrew } = useBuilder();
  const versionState = useCrewVersion(agent.id, crew.id);

  return (
    <>
      <TitleBar
        crumbs={`${agent.name} · Crew`}
        level="crew"
        name={crew.name}
        onNameChange={name => updateCrew(agent.id, crew.id, { name })}
        spec={crew.spec}
        onSpecChange={spec => updateCrew(agent.id, crew.id, { spec })}
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
          <ChainCanvas agent={agent} crew={crew} />
        </div>

        <aside className={styles.crewSide}>
          <FieldsPanel agentId={agent.id} crewId={crew.id} />
        </aside>
      </div>
    </>
  );
}
