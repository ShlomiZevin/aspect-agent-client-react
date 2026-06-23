/**
 * AgentSetupArea — non-runtime "setup" surface above the agent's
 * cortex on the agent page.
 *
 * The chain is for *things that run* — extractors, reasoners, thinker,
 * talker. Schema-shape concepts (parameters, dynamic context, domains,
 * fields) and the persona text are *setup* — they're consumed by what
 * runs, but they don't run themselves. They live here.
 *
 * Each chip opens a focused view of its concept. Persona opens its
 * own modal because it's just one big textarea; the rest open the
 * shared `SchemaSectionModal` which hosts the same `SchemaPanel`
 * section the side rail already renders (just wider). Authoring flows
 * (add / edit) reuse the existing sub-modals — this area never
 * implements its own authoring UI.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SchemaSectionModal } from './SchemaSectionModal';
import type { SchemaSectionKind } from '../SchemaPanel/SchemaPanel';
import type { AgentDoc } from '../../types';
import styles from './AgentSetupArea.module.css';

interface Props {
  agent: AgentDoc;
}

/** Schema chips that open the SchemaSectionModal. Fields, Dynamic
 *  Context, Personas, and Enums are intentionally NOT here — they have
 *  their own dedicated pages; their chips navigate there instead of
 *  cramming the editor into a modal. */
interface ChipSpec {
  kind: SchemaSectionKind;
  icon: string;
  label: string;
  /** Pulled from the live agent so the counter stays in sync without
   *  the chip needing its own subscription. */
  count: (agent: AgentDoc) => number;
}

const SCHEMA_CHIPS: ChipSpec[] = [
  { kind: 'parameters', icon: '#', label: 'Parameters', count: a => (a.parameters ?? []).length },
  { kind: 'snippets',   icon: '+', label: 'Snippets',   count: a => (a.snippets   ?? []).length },
  { kind: 'domains',    icon: '🧩', label: 'Domains',   count: a => (a.domains    ?? []).length },
];

export function AgentSetupArea({ agent }: Props) {
  const navigate = useNavigate();
  const [sectionOpen, setSectionOpen] = useState<SchemaSectionKind | null>(null);

  const enumsCount    = (agent.enums ?? []).length;
  const personasCount = (agent.personas ?? []).length;

  return (
    <div className={styles.area}>
      <div className={styles.header}>
        <span className={styles.title}>⚙ Setup</span>
      </div>
      <div className={styles.chips}>
        <button
          type="button"
          className={`${styles.chip} ${styles.chipPersona}`}
          onClick={() => navigate(`/${agent.slug}/builder/personas`)}
          title="Open the personas page"
        >
          <span className={styles.chipIcon}>🎭</span>
          <span className={styles.chipName}>Personas</span>
          <span className={styles.chipCount}>{personasCount}</span>
        </button>

        {SCHEMA_CHIPS.map(spec => {
          const n = spec.count(agent);
          return (
            <button
              key={spec.kind}
              type="button"
              className={styles.chip}
              onClick={() => setSectionOpen(spec.kind)}
              title={`Open ${spec.label.toLowerCase()}`}
            >
              <span className={styles.chipIcon}>{spec.icon}</span>
              <span className={styles.chipName}>{spec.label}</span>
              <span className={styles.chipCount}>{n}</span>
            </button>
          );
        })}

        {/* Fields — own page; chip navigates instead of opening the
            section modal. The page lists agent fields grouped by domain
            + lets the author declare new ones or edit existing fields
            inline in a split editor. */}
        <button
          type="button"
          className={styles.chip}
          onClick={() => navigate(`/${agent.slug}/builder/fields`)}
          title="Open the fields page"
        >
          <span className={styles.chipIcon}>🏷</span>
          <span className={styles.chipName}>Fields</span>
          <span className={styles.chipCount}>{(agent.fields ?? []).length}</span>
        </button>

        {/* Tags — cross-domain grouping registry. Same chip family as
            Fields / Personas / Enums; its page lists declared tags +
            every field carrying each one. */}
        <button
          type="button"
          className={styles.chip}
          onClick={() => navigate(`/${agent.slug}/builder/tags`)}
          title="Open the tags page"
        >
          <span className={styles.chipIcon}>🏷️</span>
          <span className={styles.chipName}>Tags</span>
          <span className={styles.chipCount}>{(agent.tags ?? []).length}</span>
        </button>

        {/* Enum bible — own page; chip navigates instead of opening
            the section modal. The page lists agent enums + lets the
            author edit each value's umbrella + sections. */}
        <button
          type="button"
          className={styles.chip}
          onClick={() => navigate(`/${agent.slug}/builder/enums`)}
          title="Open the enum bible"
        >
          <span className={styles.chipIcon}>🎯</span>
          <span className={styles.chipName}>Enums</span>
          <span className={styles.chipCount}>{enumsCount}</span>
        </button>
      </div>

      {sectionOpen && (
        <SchemaSectionModal
          open
          onClose={() => setSectionOpen(null)}
          agentId={agent.id}
          kind={sectionOpen}
        />
      )}
    </div>
  );
}
