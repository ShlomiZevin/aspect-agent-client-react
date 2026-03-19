import { useRef } from 'react';
import styles from './DynamicKBPage.module.css';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onImport: (file: File) => void;
  isImporting?: boolean;
}

export function TextEditor({ value, onChange, onImport, isImporting }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
      e.target.value = '';
    }
  };

  return (
    <div className={styles.textEditorContainer}>
      <div className={styles.editorToolbar}>
        <button
          className={styles.importBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          title="Import from .doc or .docx file"
        >
          {isImporting ? 'Importing...' : 'Import .doc/.docx'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".doc,.docx"
          className={styles.hiddenInput}
          onChange={handleFileChange}
        />
      </div>
      <div className={styles.mdTip}>
        <strong>Tip — Markdown best practices for KB files:</strong>
        <ul>
          <li>Use <code>## Headers</code> to separate topics — helps the AI find information faster</li>
          <li>Keep each section focused on one topic</li>
          <li>Use bullet lists (<code>-</code>) for related items</li>
          <li>Use <code>**bold**</code> for key terms the AI should anchor on</li>
          <li>Avoid walls of unstructured text — break content into short, titled sections</li>
        </ul>
      </div>
      <textarea
        className={styles.textArea}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Write markdown content here..."
        spellCheck={false}
      />
    </div>
  );
}
