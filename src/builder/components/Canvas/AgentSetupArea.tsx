/**
 * AgentSetupArea — non-runtime "setup" surface above the agent's
 * cortex on the agent page.
 *
 * The chain is for *things that run* — extractors, reasoners, thinker,
 * talker. The agent persona doesn't run; it's static text injected
 * via the {{persona}} token. So it doesn't belong on the chain, but
 * it does still need a home that makes it discoverable at agent scope.
 *
 * For now this area hosts only the Persona chip. Future setup-only
 * things (maybe a top-level fields snapshot, parameters chip, etc.)
 * can live here too; we'll see as we use it.
 *
 * Clicking the Persona chip opens the same PersonaModal used elsewhere
 * (and on the crew page from the agent combo popup). Source of truth
 * is still `agent.persona` — this is just the entry point.
 */

import { useState } from 'react';
import { PersonaModal } from '../ChainCanvas/PersonaModal';
import type { AgentDoc } from '../../types';
import styles from './AgentSetupArea.module.css';

interface Props {
  agent: AgentDoc;
}

export function AgentSetupArea({ agent }: Props) {
  const [personaOpen, setPersonaOpen] = useState(false);

  return (
    <div className={styles.area}>
      <div className={styles.header}>
        <span className={styles.title}>⚙ Setup</span>
      </div>
      <div className={styles.chips}>
        <button
          type="button"
          className={styles.chip}
          onClick={() => setPersonaOpen(true)}
          title="Open persona settings"
        >
          <span className={styles.chipIcon}>🎭</span>
          <span className={styles.chipName}>Persona</span>
        </button>
      </div>

      <PersonaModal
        open={personaOpen}
        onClose={() => setPersonaOpen(false)}
        agentId={agent.id}
        agentSlug={agent.slug}
        persona={agent.persona}
      />
    </div>
  );
}
