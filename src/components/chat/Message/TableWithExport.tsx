import type { ReactNode } from 'react';
import styles from './Message.module.css';

/**
 * Renders a markdown table (from react-markdown) and adds a one-click
 * "Export to Excel" button that downloads the table as a UTF-8 CSV.
 *
 * The data is reconstructed from the hast `node` react-markdown passes to
 * custom components, so the export matches exactly what the user sees — no
 * server round-trip. A UTF-8 BOM is prepended so Excel renders Hebrew (and
 * other non-ASCII) correctly. If `node` is unavailable for any reason the
 * table still renders; only the export button is hidden.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function nodeText(node: any): string {
  if (!node) return '';
  if (node.type === 'text') return node.value || '';
  if (Array.isArray(node.children)) return node.children.map(nodeText).join('');
  return '';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTable(node: any): string[][] {
  const rows: string[][] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walk = (n: any) => {
    if (!n || !Array.isArray(n.children)) return;
    for (const child of n.children) {
      if (child.tagName === 'tr') {
        const cells = (child.children || [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((c: any) => c.tagName === 'th' || c.tagName === 'td')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((c: any) => nodeText(c).trim());
        if (cells.length > 0) rows.push(cells);
      } else {
        walk(child); // descend through thead / tbody
      }
    }
  };
  walk(node);
  return rows;
}

function toCSV(rows: string[][]): string {
  const esc = (v: string) => {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map(r => r.map(esc).join(',')).join('\r\n');
}

function downloadCSV(rows: string[][]) {
  const csv = '﻿' + toCSV(rows); // BOM → Excel reads UTF-8 (Hebrew) correctly
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `table-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node?: any;
  children?: ReactNode;
  label?: string;
}

export function TableWithExport({ node, children, label = 'Export to Excel' }: Props) {
  const rows = node ? extractTable(node) : [];
  const canExport = rows.length > 1; // header + at least one data row

  return (
    <div className={styles.tableWrap}>
      {canExport && (
        <button
          type="button"
          className={styles.tableExportBtn}
          onClick={() => downloadCSV(rows)}
          title={label}
        >
          ⬇ {label}
        </button>
      )}
      <table>{children}</table>
    </div>
  );
}
