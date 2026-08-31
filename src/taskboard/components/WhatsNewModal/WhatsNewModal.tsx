import { Modal } from '../Modal';
import type { Task } from '../../types';
import styles from '../shared/form.module.css';
import own from './WhatsNewModal.module.css';

/**
 * What shipped since you last looked.
 *
 * Dismissal is per person, so clearing your list does not clear anyone else's —
 * the point of the table behind it. Each row opens its task, because "what
 * changed" is usually followed by "what exactly".
 */
interface Props {
  tasks: Task[];
  loading: boolean;
  onClose: () => void;
  onOpenTask: (id: number) => void;
  onDismiss: (id: number) => void;
  onDismissAll: () => void;
}

export function WhatsNewModal({ tasks, loading, onClose, onOpenTask, onDismiss, onDismissAll }: Props) {
  return (
    <Modal
      title="What's new"
      width={640}
      onClose={onClose}
      footer={
        <>
          <span className={own.count}>
            {tasks.length === 0 ? 'All caught up' : `${tasks.length} deployed since you last cleared this`}
          </span>
          <span className={styles.spacer} />
          {tasks.length > 0 && (
            <button type="button" className={styles.ghost} onClick={onDismissAll}>Clear all</button>
          )}
          <button type="button" className={styles.primary} onClick={onClose}>Done</button>
        </>
      }
    >
      {loading && <p className={own.empty}>Loading…</p>}

      {!loading && tasks.length === 0 && (
        <p className={own.empty}>Nothing new. Everything deployed has been cleared.</p>
      )}

      {tasks.map(t => (
        <article key={t.id} className={own.item}>
          <button type="button" className={own.itemMain} onClick={() => { onOpenTask(t.id); onClose(); }}>
            <span className={own.itemTitle}>#{t.id} {t.title}</span>
            <span className={own.itemMeta}>
              {t.deployedAt ? `Deployed ${new Date(t.deployedAt).toLocaleString()}` : 'Deployed'}
              {t.assignee ? ` · ${t.assignee}` : ''}
            </span>
          </button>
          <button
            type="button"
            className={own.dismiss}
            onClick={() => onDismiss(t.id)}
            aria-label={`Dismiss task ${t.id}`}
            title="Clear this one"
          >
            ×
          </button>
        </article>
      ))}
    </Modal>
  );
}
