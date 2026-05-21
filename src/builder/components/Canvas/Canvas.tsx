/**
 * Canvas — center column. Switches what it shows based on selection
 * level (project / agent / crew). Each view is a focused editor for
 * that slice of the JSON document.
 */

import { useBuilder, useCurrentAgent, useCurrentCrew } from '../../state/BuilderContext';
import { ProjectView } from './ProjectView';
import { AgentView } from './AgentView';
import { CrewView } from './CrewView';
import styles from './Canvas.module.css';

export function Canvas() {
  const { selection } = useBuilder();
  const agent = useCurrentAgent();
  const crew = useCurrentCrew();

  return (
    <div className={styles.wrap}>
      <div className={styles.scroll}>
        {selection.level === 'project' && <ProjectView />}
        {selection.level === 'agent' && agent && <AgentView agent={agent} />}
        {selection.level === 'crew' && agent && crew && (
          <CrewView agent={agent} crew={crew} />
        )}
        {selection.level === 'crew' && !crew && (
          <div className={styles.empty}>Select a crew on the left to edit.</div>
        )}
      </div>
    </div>
  );
}
