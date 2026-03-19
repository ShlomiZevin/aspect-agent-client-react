import { useRef } from 'react';
import styles from './TextEditor.module.css';

interface TextEditorProps {
  value: string;
  onChange: (value: string) => void;
  onImport: (file: File) => void;
}

export function TextEditor({ value, onChange, onImport }: TextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={styles.container}>
      <div className={styles.guidanceNote}>
        <strong>Tip — Markdown best practices for KB files:</strong>
        <ul>
          <li>Use <code>## Headers</code> to separate topics — helps the AI find information faster</li>
          <li>Keep each section focused on one topic</li>
          <li>Use bullet lists (<code>-</code>) for related items</li>
          <li>Use <code>**bold**</code> for key terms the AI should anchor on</li>
          <li>Avoid walls of unstructured text — break into short, titled sections</li>
        </ul>
      </div>
      <textarea
        className={styles.textarea}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Start typing your content here..."
        spellCheck={false}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".doc,.docx"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) onImport(file);
          e.target.value = '';
        }}
      />
      <button
        className={styles.importBtn}
        onClick={() => fileInputRef.current?.click()}
      >
        Import from .doc / .docx
      </button>
    </div>
  );
}
