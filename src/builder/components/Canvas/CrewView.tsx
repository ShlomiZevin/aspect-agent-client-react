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

import { useState } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import { useCrewVersion } from '../../state/useEntityVersion';
import { TitleBar } from '../TitleBar/TitleBar';
import { ChainCanvas } from '../ChainCanvas/ChainCanvas';
import { FieldsPanel } from '../FieldsPanel/FieldsPanel';
import { VersionMenu } from '../VersionMenu/VersionMenu';
import { VersionPill } from '../VersionMenu/VersionPill';
import { BodyJsonModal } from '../BodyJsonModal/BodyJsonModal';
import type { AgentDoc, CrewDoc } from '../../types';
import styles from './Canvas.module.css';

interface Props {
  agent: AgentDoc;
  crew: CrewDoc;
}

export function CrewView({ agent, crew }: Props) {
  const { updateCrew } = useBuilder();
  const versionState = useCrewVersion(agent.id, crew.id);
  const [jsonOpen, setJsonOpen] = useState(false);

  // Working-copy CrewBody view — same shape the patch generator will
  // consume in P5.2.
  const crewBody = {
    name:        crew.name,
    description: crew.description,
    spec:        crew.spec,
    persona:     crew.persona,
    addons:      crew.addons,
    fields:      crew.fields,
  };

  return (
    <>
      <TitleBar
        crumbs={`${agent.name} · Crew`}
        level="crew"
        name={crew.name}
        onNameChange={name => updateCrew(agent.id, crew.id, { name })}
        spec={crew.spec}
        onSpecChange={spec => updateCrew(agent.id, crew.id, { spec })}
        metaActions={
          <button
            type="button"
            className={styles.jsonBtn}
            onClick={() => setJsonOpen(true)}
            title="View this crew's JSON"
          >
            {'{ }'}
          </button>
        }
      >
        {versionState && (
          <>
            <VersionPill state={versionState} />
            <VersionMenu state={versionState} />
          </>
        )}
      </TitleBar>

      <BodyJsonModal
        open={jsonOpen}
        onClose={() => setJsonOpen(false)}
        level="crew"
        ownerName={crew.name}
        body={crewBody}
      />

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
