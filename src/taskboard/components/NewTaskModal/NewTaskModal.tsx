import { useState } from 'react';
import { Modal } from '../Modal';
import { PRIORITIES, TYPES } from '../../types';
import type { Person, TaskDraft, TaskPriority, TaskType } from '../../types';
import styles from './NewTaskModal.module.css';

/**
 * Create a task properly: title, description, type, priority, assignee and a
 * due date, in one dialog.
 *
 * Replaces a `window.prompt` that could only take a title — which meant every
 * new task had to be opened and edited immediately afterwards to be useful.
 */
interface Props {
  me: string | null;
  people: Person[];
  onCancel: () => void;
  onCreate: (draft: TaskDraft) => Promise<unknown>;
}

export function NewTaskModal({ me, people, onCancel, onCreate }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TaskType>('task');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        priority,
        assignee: assignee || undefined,
        dueDate: dueDate || undefined,
        opener: me ?? undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="New task"
      onClose={onCancel}
      footer={
        <>
          {error && <span className={styles.error}>{error}</span>}
          <span className={styles.spacer} />
          <button type="button" className={styles.ghost} onClick={onCancel}>Cancel</button>
          <button type="button" className={styles.primary} disabled={!title.trim() || busy} onClick={submit}>
            {busy ? 'Creating…' : 'Create task'}
          </button>
        </>
      }
    >
      <form
        className={styles.form}
        onSubmit={e => { e.preventDefault(); void submit(); }}
      >
        <label className={styles.field}>
          <span className={styles.label}>Title</span>
          <input
            className={`${styles.input} ${styles.title}`}
            value={title}
            placeholder="What needs doing?"
            onChange={e => setTitle(e.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Description</span>
          <textarea
            className={styles.textarea}
            value={description}
            placeholder="Context, links, what done looks like…"
            onChange={e => setDescription(e.target.value)}
          />
        </label>

        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>Type</span>
            <select className={styles.select} value={type} onChange={e => setType(e.target.value as TaskType)}>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Priority</span>
            <select className={styles.select} value={priority} onChange={e => setPriority(e.target.value as TaskPriority)}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Assignee</span>
            <select className={styles.select} value={assignee} onChange={e => setAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {people.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Due</span>
            <input
              type="date"
              className={styles.input}
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </label>
        </div>

        <span className={styles.hint}>
          {me ? `Opened by ${me}.` : 'Tell the board your name so this is opened by someone.'}
        </span>

        {/* Lets Enter submit from any field without a visible second button. */}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
