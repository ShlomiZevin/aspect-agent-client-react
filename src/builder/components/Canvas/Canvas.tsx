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
  const { selection, previewVersion } = useBuilder();
  const agent = useCurrentAgent();
  const crew = useCurrentCrew();

  // When the currently-displayed entity is being previewed read-only,
  // block edits on the canvas (children get pointer-events:none) and
  // show a ribbon. The actions (Back to active / Edit this version)
  // live in the version bar above.
  const isPreviewing = !!previewVersion && (
    (selection.level === 'agent' && previewVersion.crewId === null && previewVersion.agentId === selection.agentId) ||
    (selection.level === 'crew' && previewVersion.crewId === selection.crewId)
  );

  return (
    <div className={styles.wrap}>
      {isPreviewing && (
        <div className={styles.previewRibbon}>
          👁 Read-only preview — use “↩ Back to active” or “✎ Edit this version” above to make changes.
        </div>
      )}
      <div className={`${styles.scroll} ${isPreviewing ? styles.scrollReadonly : ''}`}>
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
