/**
 * SpecEditor — the free-text spec block attached to every level
 * (project / agent / crew). Single textarea by design; structure will
 * emerge later as the AI Builder Chat starts shaping it.
 *
 * The point of the spec: the AI helper reads it to understand the
 * user's intent at a higher level than the JSON config. When the
 * helper edits implementation, it can also revise the spec so the
 * two stay in sync — instead of the usual drift where specs go
 * stale the moment work starts.
 */

import styles from './SpecEditor.module.css';

interface Props {
  level: 'project' | 'agent' | 'crew';
  value: string;
  onChange: (next: string) => void;
}

const LEVEL_LABEL: Record<Props['level'], string> = {
  project: 'Project spec',
  agent: 'Agent spec',
  crew: 'Crew spec',
};

const LEVEL_HINT: Record<Props['level'], string> = {
  project: 'Top-level goals, scope, who this is for, success criteria.',
  agent: 'What this agent does, persona at a high level, what makes it succeed.',
  crew: 'What this phase is responsible for and what "done" looks like.',
};

export function SpecEditor({ level, value, onChange }: Props) {
  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.title}>📖 {LEVEL_LABEL[level]}</span>
        <span className={styles.charCount}>{value.length} chars</span>
      </div>
      <p className={styles.hint}>{LEVEL_HINT[level]}</p>
      <textarea
        className={styles.textarea}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={`Write the ${level} spec in plain language…`}
      />
    </div>
  );
}
