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
function tableToMarkdown(name: string, headers: string[], rows: string[][], indexColumns: number[] = []): string {
  const now = new Date().toISOString().split('T')[0];

  const dataRows = rows.filter(row => row.some(c => c && c.trim()));

  const lines = [
    `# ${name}`,
    `> Last updated: ${now}`,
    `> ${dataRows.length} items`,
    `> Columns: ${headers.join(' | ')}`,
  ];
  if (indexColumns.length > 0) {
    lines.push(`> Index: ${indexColumns.join(',')}`);
  }
  lines.push('');

  for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
    const row = dataRows[rowIdx];
    lines.push('---');

    let heading: string;
    if (indexColumns.length > 0) {
      const parts = indexColumns.map(i => (row[i] || '').trim()).filter(Boolean);
      heading = parts.length > 0 ? parts.join(' — ') : `Row ${rowIdx + 1}`;
    } else {
      heading = `Row ${rowIdx + 1}`;
    }
    lines.push(`## ${heading}`);

    for (let i = 0; i < headers.length; i++) {
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
    markdown = tableToMarkdown(fileName, data.headers || [], data.rows || [], data.indexColumns || []);
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
