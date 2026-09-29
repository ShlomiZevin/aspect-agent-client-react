/**
 * One Targeted KB text (a value's umbrella or one section) — read and
 * edited in the same card (task #830).
 *
 * One save concept: while editing, every keystroke goes straight into the
 * working copy, like every other field in the builder; the top bar's
 * "Save all" is the only save. "Done" returns to reading, Esc undoes this
 * edit (back to the text as it was when editing started). The old screen
 * had a second Save/Cancel per text box that saved nothing — gone.
 *
 * The header's right-hand slot always holds exactly one control ("Edit",
 * or "Editing" + "Done"), so switching modes never shifts the card.
 *
 * Two looks, same behaviour:
 *   card — a bordered card with a header row (the "By value" view)
 *   doc  — a passage of a document: a heading and running text, no box;
 *          Edit / ⋯ only appear while you hover the passage (Whole KB).
 */

import { useEffect, useRef, useState } from 'react';
import { MentionTextarea } from '../MentionTextarea/MentionTextarea';
import type { useMentionOptions } from '../MentionTextarea/useMentionOptions';
import { TableEditorModalV1 } from '../TableEditor/TableEditorModalV1';
import { RichText } from './RichText';
import styles from './TargetedKbPage.module.css';

interface Props {
  /** The value's main text, or one of its named sections — drawn differently. */
  kind: 'umbrella' | 'section';
  /** "Umbrella" or the section's name. */
  label: string;
  /** Tooltip on the label: what this kind of text is. */
  hint?: string;
  text: string;
  onChange: (next: string) => void;
  mentionOptions: ReturnType<typeof useMentionOptions>;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  /** Remembers the box's size / direction pin per text. */
  storageKey: string;
  /** A ⋯ menu beside Edit (section rename/delete). */
  menu?: React.ReactNode;
  id?: string;
  variant?: 'card' | 'doc';
}

export function TextCard({
  kind, label, hint, text, onChange, mentionOptions, editing, onEditingChange, storageKey, menu, id, variant = 'card',
}: Props) {
  const snapshot = useRef(text);
  const editRef = useRef<HTMLDivElement>(null);
  // Start editing where you'd continue writing: caret at the end.
  useEffect(() => {
    if (!editing) return;
    const ta = editRef.current?.querySelector('textarea');
    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  }, [editing]);
  const [table, setTable] = useState<{ md: string; range: { start: number; end: number } | null } | null>(null);

  const startEdit = () => {
    snapshot.current = text;
    onEditingChange(true);
  };
  const undoEdit = () => {
    onChange(snapshot.current);
    onEditingChange(false);
  };

  const controls = (
    <>
      {editing ? (
        <>
          <span className={styles.editingDot}>● Editing</span>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => onEditingChange(false)}>Done</button>
        </>
      ) : (
        <button type="button" className={styles.btn} onClick={startEdit}>✎ Edit</button>
      )}
      {menu}
    </>
  );
  const doc = variant === 'doc';

  return (
    <section id={id} className={doc
      ? `${styles.passage} ${kind === 'umbrella' ? styles.passageUmbrella : ''} ${editing ? styles.passageEditing : ''}`
      : `${styles.card} ${kind === 'umbrella' ? styles.cardUmbrella : ''} ${editing ? styles.cardEditing : ''}`}>
      {doc ? (
        <header className={styles.passageHead}>
          {kind === 'umbrella'
            ? <span className={styles.passageUmbrellaMark} title={hint}>☂ Umbrella</span>
            : <h3 className={styles.passageTitle} title={hint}><span aria-hidden>📄</span>{label}</h3>}
          <span className={styles.flex} />
          <span className={styles.passageTools}>{controls}</span>
        </header>
      ) : (
        <header className={styles.cardHead}>
          <span className={styles.cardLabel} title={hint}>
            {kind === 'umbrella'
              ? <><span className={styles.cardIcon} aria-hidden>☂</span>Umbrella</>
              : <><span className={styles.cardIcon} aria-hidden>📄</span><span className={styles.cardKind}>Section</span>{label}</>}
          </span>
          <span className={styles.flex} />
          {controls}
        </header>
      )}

      {editing ? (
        <div className={styles.editBody} ref={editRef}>
          <MentionTextarea
            value={text}
            onChange={onChange}
            options={mentionOptions}
            storageKey={storageKey}
            autoGrow
            autoFocus
            rows={6}
            onKeyDown={e => {
              if (e.key === 'Escape') { e.preventDefault(); undoEdit(); }
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); onEditingChange(false); }
            }}
          />
          <div className={styles.editFoot}>
            <button type="button" className={styles.btnGhost} onClick={() => setTable({ md: '', range: null })}>+ Table</button>
            <span className={styles.editHint}>
              Type <code>{'{{'}</code> to insert a token · Esc undoes this edit · Changes are included in <b>Save all</b>
            </span>
          </div>
        </div>
      ) : (
        <div className={doc ? styles.passageBody : styles.readBody} onDoubleClick={startEdit} title="Double-click to edit">
          <RichText text={text} onEditTable={(md, range) => setTable({ md, range })} empty="Nothing written yet — Edit to write it." />
        </div>
      )}

      <TableEditorModalV1
        open={!!table}
        initialMarkdown={table?.md ?? ''}
        onCancel={() => setTable(null)}
        onSave={nextMd => {
          if (!table) return;
          if (table.range) {
            onChange(text.slice(0, table.range.start) + nextMd + text.slice(table.range.end));
          } else {
            onChange(`${text.replace(/\s+$/, '')}${text.trim() ? '\n\n' : ''}${nextMd}\n`);
          }
          setTable(null);
        }}
      />
    </section>
  );
}
