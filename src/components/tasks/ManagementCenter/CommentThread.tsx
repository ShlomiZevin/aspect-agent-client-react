import { fullWhen, formatWhen, lineRefOf, personName, personTone } from './commentModel';
import type { ThreadEntry, TopicThreads } from './commentModel';
import { PencilIcon, PlusIcon, TrashIcon } from './icons';
import { Linkify, RichText } from './Linkify';
import { textDir } from './textDir';
import type { LineBlock, Topic } from './topics';
import type { ActionComments } from './useActionComments';
import styles from './ManagementCenter.module.css';

/** A person's round initial, in their own tone. */
export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const shown = personName(name);
  return (
    <span className={`${styles.avatar} ${personTone(name)}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.48) }} aria-hidden="true">
      {shown.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * One line's thread: who · when · the remark, oldest first, and (when `line`
 * is given) the button that opens the composer. The rows keep the page's
 * right-to-left layout; only each remark's own text picks its direction.
 */
export function CommentThread({ flow, entries, lineText, line, topic, addable = true }: {
  flow: ActionComments;
  entries: ThreadEntry[];
  lineText: string;
  line: LineBlock | null;
  topic: Topic;
  addable?: boolean;
}) {
  const ref = line ? lineRefOf(topic, line) : null;
  return (
    <ul className={styles.thread} dir="rtl">
      {entries.map(e => (
        <li key={e.key} className={`${styles.comment} ${e.kind === 'note' ? styles.commentNote : ''}`}>
          <Avatar name={e.author} />
          <div className={styles.commentHead}>
            <span className={styles.commentAuthor}>{personName(e.author)}</span>
            {e.kind === 'comment'
              ? (
                <span className={styles.commentWhen} title={fullWhen(e.when)}>
                  {formatWhen(e.when)}{e.edited ? ' · נערך' : ''}
                </span>
              )
              : <span className={styles.commentTag}>הערה</span>}
          </div>
          <div className={styles.commentActions}>
            {flow.mayEdit(e) && (
              <button type="button" className={styles.commentAct} aria-label="עריכה" title="עריכה" onClick={() => flow.startEdit(e, lineText, ref)}>
                <PencilIcon size={15} />
              </button>
            )}
            {flow.mayDelete(e) && (
              <button type="button" className={`${styles.commentAct} ${styles.commentActDanger}`} aria-label="מחיקה" title="מחיקה" onClick={() => flow.startDelete(e, lineText, ref)}>
                <TrashIcon size={15} />
              </button>
            )}
          </div>
          <p className={styles.commentBody} dir="auto"><Linkify text={e.body} /></p>
        </li>
      ))}
      {addable && line && (
        <li className={styles.threadAddRow}>
          <button type="button" className={styles.threadAdd} onClick={() => flow.startAdd(topic, line)}>
            <PlusIcon /> <span>הוספת תגובה</span>
          </button>
        </li>
      )}
    </ul>
  );
}

/** Comments whose line is gone: under the topic, with the line as it was. */
export function OrphanThreads({ flow, topic, orphans }: { flow: ActionComments; topic: Topic; orphans: TopicThreads['orphans'] }) {
  if (orphans.length === 0) return null;
  return (
    <div className={styles.orphans} dir="rtl">
      {orphans.map(o => (
        <div key={o.lineText} className={styles.orphan}>
          <div className={styles.orphanHead}>
            <span className={styles.orphanLabel}>על שורה שהשתנתה:</span>{' '}
            <span className={styles.orphanText} dir={textDir(o.lineText)}><RichText text={o.lineText} /></span>
          </div>
          <CommentThread flow={flow} entries={o.entries} lineText={o.lineText} line={null} topic={topic} addable={false} />
        </div>
      ))}
    </div>
  );
}
