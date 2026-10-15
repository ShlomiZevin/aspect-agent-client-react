/**
 * A financial statement, drawn the way a company report is read: the totals
 * are the statement, and each one opens to show the lines behind it.
 *
 * One component for both surfaces — the chat's answer card and the Apps
 * screens — so a fix to how a statement reads lands in both (task #116). The
 * server sends the same `blocks` shape to each.
 */

import { useState } from 'react';
import styles from './StatementTable.module.css';
import { useLanguage } from '../../context/LanguageContext';

export type StatementCells = string[];

export interface StatementBlock {
  type: 'group' | 'row' | 'rows';
  label?: string;
  /** A section's own total — the line shown while the section is closed. */
  total?: StatementCells | null;
  /** A standalone strong line (gross profit, total assets…). */
  cells?: StatementCells;
  /** The detail lines inside a section, or a plain run of rows. */
  lines?: StatementCells[];
}

const WORDS = {
  he: { expandAll: 'הרחבת הכול', collapseAll: 'כיווץ הכול', details: 'פירוט' },
  en: { expandAll: 'Expand all', collapseAll: 'Collapse all', details: 'Details' },
};

/**
 * Columns that carry a CHANGE rather than a level (the gap and the % move).
 * In those, up is good news and down is bad, so they are the only ones where a
 * positive number earns a color; everywhere else a figure is just a figure and
 * only negatives are marked.
 */
const DELTA_HEADER = /הפרש|שינוי|change|diff|gap/i;

/** Accounting style: a negative is (1,234), not -1,234. */
function accounting(value: string) {
  const v = value.trim();
  if (!v.startsWith('-')) return { text: v, negative: false };
  return { text: `(${v.slice(1)})`, negative: true };
}

export function StatementTable({ columns, blocks, variant = 'report' }: {
  columns: string[];
  blocks: StatementBlock[];
  /** `compact` is the chat bubble; `report` is a full screen. */
  variant?: 'compact' | 'report';
}) {
  const { language } = useLanguage();
  const w = WORDS[language === 'he' ? 'he' : 'en'];
  const [open, setOpen] = useState<Record<number, boolean>>({});

  const openable = blocks
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b.type === 'group' && b.total && (b.lines?.length ?? 0) > 0);
  const allOpen = openable.length > 0 && openable.every(({ i }) => open[i]);
  const toggleAll = () => {
    if (allOpen) { setOpen({}); return; }
    const next: Record<number, boolean> = {};
    openable.forEach(({ i }) => { next[i] = true; });
    setOpen(next);
  };

  // Worked out once from the headers, not per cell.
  const deltaCols = columns.map(c => DELTA_HEADER.test(c));

  return (
    <div className={`${styles.wrap} ${variant === 'compact' ? styles.compact : ''}`} dir="rtl">
      {openable.length > 0 && (
        <div className={styles.toolbar}>
          <button type="button" className={styles.toggleAll} onClick={toggleAll}>
            {allOpen ? w.collapseAll : w.expandAll}
          </button>
        </div>
      )}
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={i} className={i === 0 ? styles.labelCol : styles.numCol}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {blocks.map((b, i) => {
              if (b.type === 'row' && b.cells) return <Line key={i} cells={b.cells} kind="strong" deltaCols={deltaCols} />;
              if (b.type === 'rows') {
                return (b.lines ?? []).map((cells, j) => <Line key={`${i}-${j}`} cells={cells} kind="plain" deltaCols={deltaCols} />);
              }
              const lines = b.lines ?? [];
              // A one-line section (revenue usually is one) has no total of its
              // own — nothing to open, so it reads as a line.
              if (!b.total) return lines.map((cells, j) => <Line key={`${i}-${j}`} cells={cells} kind="plain" deltaCols={deltaCols} />);
              const isOpen = Boolean(open[i]) && lines.length > 0;
              return (
                <Section
                  key={i}
                  total={b.total}
                  lines={lines}
                  isOpen={isOpen}
                  detailsLabel={w.details}
                  deltaCols={deltaCols}
                  onToggle={() => setOpen(o => ({ ...o, [i]: !o[i] }))}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Section({ total, lines, isOpen, detailsLabel, deltaCols, onToggle }: {
  total: StatementCells;
  lines: StatementCells[];
  isOpen: boolean;
  detailsLabel: string;
  deltaCols: boolean[];
  onToggle: () => void;
}) {
  const canOpen = lines.length > 0;
  return (
    <>
      <tr className={styles.totalRow}>
        {total.map((cell, i) => (
          <td key={i} className={i === 0 ? styles.labelCol : styles.numCol}>
            {i === 0
              ? (canOpen
                ? (
                  <button type="button" className={styles.sectionBtn} onClick={onToggle} aria-expanded={isOpen} title={detailsLabel}>
                    <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} aria-hidden="true">▾</span>
                    <span>{cell}</span>
                  </button>
                )
                : <span>{cell}</span>)
              : <Num value={cell} delta={Boolean(deltaCols[i])} />}
          </td>
        ))}
      </tr>
      {isOpen && lines.map((cells, j) => <Line key={j} cells={cells} kind="detail" deltaCols={deltaCols} />)}
    </>
  );
}

function Line({ cells, kind, deltaCols }: { cells: StatementCells; kind: 'strong' | 'plain' | 'detail'; deltaCols: boolean[] }) {
  const cls = kind === 'strong' ? styles.strongRow : kind === 'detail' ? styles.detailRow : styles.plainRow;
  return (
    <tr className={cls}>
      {cells.map((cell, i) => (
        <td key={i} className={i === 0 ? styles.labelCol : styles.numCol}>
          {i === 0 ? cell : <Num value={cell} delta={Boolean(deltaCols[i])} />}
        </td>
      ))}
    </tr>
  );
}

/**
 * Amounts stay left-to-right inside the right-to-left statement: in RTL a bare
 * "-1,234" renders with the minus on the wrong end. Negatives print in
 * parentheses the way a statement prints them, and are marked red; in a change
 * column a rise is marked green, because there "up" actually means something.
 */
function Num({ value, delta }: { value: string; delta: boolean }) {
  const { text, negative } = accounting(value);
  const positive = delta && !negative && /[1-9]/.test(text);
  const cls = negative ? styles.neg : positive ? styles.pos : undefined;
  return <bdi dir="ltr" className={cls}>{text}</bdi>;
}
