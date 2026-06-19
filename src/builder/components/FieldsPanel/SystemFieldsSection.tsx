/**
 * SystemFieldsSection — sticky top section of the FieldsPanel.
 *
 * Renders every entry from the system-fields registry. Read-only:
 * users can't edit or delete these; the platform owns the schema.
 *
 * What's distinct from user fields:
 *   - Always visible (even when the user has no fields of their own)
 *   - Different visual treatment (badge + lighter card)
 *   - Lifetime chip ("resets on transition") makes the runtime
 *     behaviour visible at a glance
 *   - Tooltip with the registry's `description`
 *
 * Live values come from the same conversation memory the regular
 * FieldRow reads — system fields live under the `_system` domain.
 */

import { SYSTEM_FIELDS } from '../../registry/systemFields';
import type { SystemFieldDef } from '../../registry/systemFields';
import styles from './SystemFieldsSection.module.css';

interface Props {
  /** Brain blob read off the previewed conversation. We dig into
   *  `memory._system` to surface live values when present. */
  conversationMemory: {
    memory: Record<string, Record<string, unknown>>;
  };
}

const LIFETIME_LABEL: Record<SystemFieldDef['lifetime'], string> = {
  'crew-transition': '↻ on transition',
  'per-turn':        '↻ each turn',
  'never':           'persistent',
};

function lookupLiveValue(
  memory: Record<string, Record<string, unknown>>,
  def: SystemFieldDef,
): unknown {
  const domain = def.domain ?? '_system';
  const bucket = memory?.[domain];
  if (!bucket || !Object.prototype.hasOwnProperty.call(bucket, def.name)) return undefined;
  return bucket[def.name];
}

function formatLiveValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

export function SystemFieldsSection({ conversationMemory }: Props) {
  if (SYSTEM_FIELDS.length === 0) return null;

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <span className={styles.title}>System fields</span>
        <span
          className={styles.titleSub}
          title="Platform-defined fields. Auto-extracted from any addon's output; lifetime is managed by the runtime."
        >
          built-in
        </span>
      </div>
      <ul className={styles.list}>
        {SYSTEM_FIELDS.map(def => {
          const live = lookupLiveValue(conversationMemory.memory, def);
          const hasLive = live !== undefined;
          return (
            <li
              key={def.name}
              className={styles.row}
              title={def.description}
            >
              {/* Row 1: name + live value chip (when set). */}
              <div className={styles.rowMain}>
                <span className={styles.name}>{def.name}</span>
                {hasLive && (
                  <span className={styles.liveValue} title="Current value in this conversation">
                    = {formatLiveValue(live)}
                  </span>
                )}
              </div>
              {/* Row 2: meta pills. Wraps on narrow widths. */}
              <div className={styles.rowPills}>
                <span className={styles.typePill}>{def.type}</span>
                <span className={styles.lifetimePill} title={`Reset trigger: ${def.lifetime}`}>
                  {LIFETIME_LABEL[def.lifetime]}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
