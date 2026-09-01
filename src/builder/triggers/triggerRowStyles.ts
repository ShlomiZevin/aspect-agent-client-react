/**
 * The shared control classes for trigger configuration.
 *
 * Split out from `TriggerRow.tsx` only because React Fast Refresh
 * requires a .tsx to export components and nothing else. Import this
 * wherever you render a control inside a trigger group — the editor and
 * every trigger type's config both do, which is what stops their widths
 * and focus states drifting apart.
 */

import styles from './TriggerRow.module.css';

export const rowStyles = styles;
