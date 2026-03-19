import { useState } from 'react';
import type { TableData } from '../../../types/dynamicKB';
import styles from './PreviewMDModal.module.css';

interface PreviewMDModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileType: 'text' | 'table';
  fileName: string;
  content: string | TableData;
}

/** Client-side table → markdown conversion (mirrors server logic) */
function tableToMarkdown(name: string, headers: string[], rows: string[][]): string {
  const now = new Date().toISOString().split('T')[0];

  // Filter out junk rows (>50% empty cells)
  const dataRows = rows.filter(row => {
    const filled = row.filter(c => c && c.trim()).length;
    return filled > row.length * 0.5;
  });

  const h1 = headers[0] || 'Column 1';
  const h2 = headers[1] || 'Column 2';

  const lines = [
    `# ${name}`,
    `> Last updated: ${now}`,
    `> ${dataRows.length} items`,
    `> Columns: ${h1} | ${h2}`,
    '',
  ];

  for (const row of dataRows) {
    lines.push('---');
    const col1 = (row[0] || '').trim();
    const col2 = (row[1] || '').trim();
    const heading = col2 ? `${col1} — ${col2}` : col1 || 'Item';
    lines.push(`## ${heading}`);
    for (let i = 2; i < headers.length; i++) {
      const val = (row[i] || '').trim();
      if (val) {
        lines.push(`- ${headers[i]}: ${val}`);
      }
    }
  }

  if (dataRows.length > 0) lines.push('---');
  return lines.join('\n') + '\n';
}

export function PreviewMDModal({ isOpen, onClose, fileType, fileName, content }: PreviewMDModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  let markdown: string;
  if (fileType === 'table') {
    const data = content as TableData;
    markdown = tableToMarkdown(fileName, data.headers || [], data.rows || []);
  } else {
    markdown = content as string;
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Markdown Preview — This is what the AI will see</h3>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <pre className={styles.content}>{markdown}</pre>
        <div className={styles.footer}>
          <button className={styles.copyBtn} onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
