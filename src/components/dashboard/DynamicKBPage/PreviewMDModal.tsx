import { useState } from 'react';
import type { TableData } from '../../../types';
import styles from './DynamicKBPage.module.css';

function tableToMarkdown(name: string, headers: string[], rows: string[][]): string {
  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [
    `# ${name}`,
    `> Last updated: ${date}`,
    `> ${rows.length} items`,
    '',
  ];
  for (const row of rows) {
    lines.push('---');
    const heading = row[0] || '(empty)';
    lines.push(`## ${heading}`);
    for (let i = 0; i < headers.length; i++) {
      lines.push(`- ${headers[i]}: ${row[i] ?? ''}`);
    }
    lines.push('');
  }
  lines.push('---');
  return lines.join('\n');
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  fileType: 'text' | 'table';
  content: string | TableData;
}

export function PreviewMDModal({ isOpen, onClose, fileName, fileType, content }: Props) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const markdown = fileType === 'table'
    ? tableToMarkdown(fileName, (content as TableData).headers, (content as TableData).rows)
    : (content as string);

  const handleCopy = () => {
    navigator.clipboard.writeText(markdown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.previewModal} onClick={e => e.stopPropagation()}>
        <div className={styles.previewModalHeader}>
          <div>
            <h3 className={styles.previewModalTitle}>Markdown Preview</h3>
            <p className={styles.previewModalSubtitle}>This is what the AI will see</p>
          </div>
          <div className={styles.previewModalActions}>
            <button className={styles.copyBtn} onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button className={styles.closeBtn} onClick={onClose}>X</button>
          </div>
        </div>
        <pre className={styles.previewCode}>{markdown}</pre>
      </div>
    </div>
  );
}
