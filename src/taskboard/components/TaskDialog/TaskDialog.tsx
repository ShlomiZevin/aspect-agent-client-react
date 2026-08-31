import { useCallback, useEffect, useState } from 'react';
import { CommentThread } from '../CommentThread';
import { RichTextEditor } from '../RichTextEditor';
import { LABELS, PRIORITIES, STATUSES, TYPES } from '../../types';
import type { Person, Task, TaskDraft } from '../../types';
import styles from './TaskDialog.module.css';

/**
 * One task: its fields, and its conversation.
 *
 * Edits save on blur rather than behind a Save button. The old form held a full
 * copy of the task in local state and re-initialised it from props in an effect,
 * which is what made it wipe itself mid-edit whenever an unrelated array prop
 * changed identity on an SSE refresh — the `allTasks`-in-the-deps bug. Saving
 * per field means there is no draft copy to lose.
 */
interface Props {
  task: Task;
  me: string | null;
  people: Person[];
  /** Every other task, for the depends-on picker. */
  allTasks: Task[];
  onClose: () => void;
  onSave: (id: number, patch: TaskDraft) => Promise<unknown>;
  onDelete: (id: number) => Promise<unknown>;
  onDeploy: (id: number) => Promise<unknown>;
}

export function TaskDialog({ task, me, people, allTasks, onClose, onSave, onDelete, onDeploy }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const save = useCallback(async (patch: TaskDraft) => {
    setError(null);
    try {
      await onSave(task.id, patch);
      setSaved(true);
      // The "Saved" flag is a receipt, not a state — it should fade rather than
      // sit there implying the last edit is somehow still pending.
      window.setTimeout(() => setSaved(false), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [onSave, task.id]);

  /** Saves only if the value actually changed, so a blur is not a write. */
  const saveIfChanged = (key: keyof TaskDraft, value: unknown) => {
    if ((task[key as keyof Task] ?? '') === (value ?? '')) return;
    void save({ [key]: value } as TaskDraft);
  };

  const dependencyOptions = allTasks.filter(t => t.id !== task.id);

  return (
    <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={task.title}>
        <header className={styles.head}>
          <span className={styles.id}>#{task.id}</span>
          <textarea
            className={styles.titleInput}
            defaultValue={task.title}
            rows={1}
            onBlur={e => saveIfChanged('title', e.target.value.trim())}
          />
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className={styles.body}>
          <div className={styles.fields}>
            <Select label="Status"   value={task.status}   options={STATUSES}   onChange={v => save({ status: v })} />
            <Select label="Priority" value={task.priority} options={PRIORITIES} onChange={v => save({ priority: v })} />
            <Select label="Type"     value={task.type}     options={TYPES}      onChange={v => save({ type: v })} />

            <label className={styles.field}>
              <span className={styles.label}>Assignee</span>
              <select
                className={styles.control}
                value={task.assignee ?? ''}
                onChange={e => save({ assignee: e.target.value || undefined })}
              >
                <option value="">Unassigned</option>
                {people.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Due</span>
              <input
                type="date"
                className={styles.control}
                defaultValue={task.dueDate?.slice(0, 10) ?? ''}
                onBlur={e => saveIfChanged('dueDate', e.target.value || undefined)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Depends On</span>
              <select
                className={styles.control}
                value={task.dependsOn ?? ''}
                onChange={e => save({ dependsOn: e.target.value ? Number(e.target.value) : undefined })}
              >
                <option value="">Nothing</option>
                {dependencyOptions.map(t => (
                  <option key={t.id} value={t.id}>#{t.id} {t.title.slice(0, 40)}</option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.flags}>
            <Toggle
              on={task.atRisk}
              onChange={v => save({ atRisk: v })}
              label="At risk"
              hint="Someone judged this is slipping"
            />
            {task.type === 'read' && (
              <Toggle
                on={task.acknowledged}
                onChange={v => save({ acknowledged: v })}
                label="Read"
                hint="The assignee has actually read it"
              />
            )}
            <Toggle
              on={task.isDraft}
              onChange={v => save({ isDraft: v })}
              label="Draft"
              hint="Hidden from the main board"
            />
          </div>

          <label className={styles.field}>
            <span className={styles.label}>Tags</span>
            <input
              className={styles.control}
              defaultValue={task.tags.join(', ')}
              placeholder="comma separated"
              onBlur={e => {
                const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                if (tags.join(' ') !== task.tags.join(' ')) void save({ tags });
              }}
            />
          </label>

          <div className={styles.field}>
            <span className={styles.label}>Description</span>
            <RichTextEditor
              value={task.description ?? ''}
              placeholder="Optional description..."
              // The editor emits on blur as well as on input; the equality check
              // in saveIfChanged is what stops a blur with no edit becoming a
              // write, and with it an SSE event to everyone.
              onChange={html => saveIfChanged('description', html)}
            />
          </div>

          <CommentThread taskId={task.id} me={me} />
        </div>

        <footer className={styles.footer}>
          {confirmDelete ? (
            <>
              <span className={styles.error}>Delete #{task.id} and its comments?</span>
              <button type="button" className={styles.danger} onClick={async () => { await onDelete(task.id); onClose(); }}>
                Yes, delete
              </button>
              <button type="button" className={styles.linkBtn} onClick={() => setConfirmDelete(false)}>Cancel</button>
            </>
          ) : (
            <>
              <button type="button" className={styles.danger} onClick={() => setConfirmDelete(true)}>Delete</button>
              <button type="button" className={styles.ghost} onClick={() => onDeploy(task.id)}>
                {task.deployedAt ? 'Mark deployed again' : 'Mark deployed'}
              </button>
              {task.deployedAt && (
                <span className={styles.when}>
                  Deployed {new Date(task.deployedAt).toLocaleDateString()}
                </span>
              )}
            </>
          )}
          {error && <span className={styles.error}>{error}</span>}
          {!error && saved && <span className={styles.saved}>Saved</span>}
        </footer>
      </div>
    </div>
  );
}

/** A labelled select over a readonly tuple of allowed values. */
function Select<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <select className={styles.control} value={value} onChange={e => onChange(e.target.value as T)}>
        {options.map(o => <option key={o} value={o}>{LABELS[o] ?? o}</option>)}
      </select>
    </label>
  );
}

function Toggle({ on, onChange, label, hint }: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className={styles.flag} title={hint}>
      <input type="checkbox" checked={on} onChange={e => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
