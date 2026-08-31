import { useMemo, useRef, useState } from 'react';
import { Modal } from '../Modal';
import { CommentThread } from '../CommentThread';
import { RichTextEditor } from '../RichTextEditor';
import { LABELS, PRIORITIES, STATUSES, TYPES } from '../../types';
import type { Person, Task, TaskDraft, TaskPriority, TaskStatus, TaskType } from '../../types';
import styles from './TaskFormModal.module.css';

/**
 * Create a task. Same fields, same order and same labels as the original
 * board's form, so filing a task here is not a different job.
 *
 * The refactor is underneath: the original holds twenty-odd useState calls and
 * re-initialises them from props in an effect, which is what made it wipe itself
 * mid-edit. This one is a single draft object, created once and never
 * re-initialised, so there is nothing to lose.
 */
interface Props {
  me: string | null;
  people: Person[];
  /** For the Depends On search. */
  allTasks: Task[];
  /** Present = edit an existing task; absent = create a new one. */
  task?: Task;
  onCancel: () => void;
  onSubmit: (draft: TaskDraft) => Promise<unknown>;
  onDelete?: (id: number) => Promise<unknown>;
  onDeploy?: (id: number) => Promise<unknown>;
}

interface FormState {
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  assignee: string;
  dueDate: string;
  tags: string;
  dependsOn: number | null;
  isDraft: boolean;
  atRisk: boolean;
}

const EMPTY: FormState = {
  title: '', description: '', type: 'feature', priority: 'medium', status: 'todo',
  assignee: '', dueDate: '', tags: '',
  dependsOn: null, isDraft: false, atRisk: false,
};

function seed(task?: Task): FormState {
  if (!task) return EMPTY;
  return {
    title: task.title,
    description: task.description ?? '',
    type: task.type,
    priority: task.priority,
    status: task.status,
    assignee: task.assignee ?? '',
    dueDate: task.dueDate?.slice(0, 10) ?? '',
    tags: task.tags.join(', '),
    dependsOn: task.dependsOn ?? null,
    isDraft: task.isDraft,
    atRisk: task.atRisk,
  };
}

// The original searches only from three characters, so a single letter does not
// render the whole board into a dropdown.
const MIN_SEARCH = 3;

export function TaskFormModal({ me, people, allTasks, task, onCancel, onSubmit, onDelete, onDeploy }: Props) {
  // Seeded once, by the initialiser. Never re-seeded from props: that effect is
  // what made the original wipe itself when an unrelated prop changed identity
  // on a refresh.
  const [form, setForm] = useState<FormState>(() => seed(task));
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < MIN_SEARCH) return [];
    return allTasks
      .filter(t => t.id !== task?.id)  // a task cannot depend on itself
      .filter(t => t.title.toLowerCase().includes(q) || String(t.id) === q)
      .slice(0, 8);
  }, [search, allTasks, task]);

  const dependency = form.dependsOn === null
    ? null
    : allTasks.find(t => t.id === form.dependsOn) ?? null;

  const submit = async () => {
    if (!form.title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        title: form.title.trim(),
        description: form.description || undefined,
        type: form.type,
        priority: form.priority,
        status: form.status,
        assignee: form.assignee || undefined,
        dueDate: form.dueDate || undefined,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        dependsOn: form.dependsOn ?? undefined,
        isDraft: form.isDraft,
        atRisk: form.atRisk,
        // Only on create: editing must not reassign who opened it.
        ...(task ? {} : { opener: me ?? undefined }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={task ? `#${task.id}  ${task.title}` : 'New Task'}
      width={expanded ? 900 : 600}
      onClose={onCancel}
      footer={
        <>
          <div className={styles.toggles}>
            <Chip on={form.isDraft} onChange={v => set('isDraft', v)} className={styles.draftOn}>Draft</Chip>
            <Chip on={form.atRisk} onChange={v => set('atRisk', v)} className={styles.riskOn}>⚠ Risk</Chip>
            <Chip
              on={form.assignee === 'Limbo'}
              onChange={v => set('assignee', v ? 'Limbo' : '')}
              className={styles.limboOn}
            >
              💀 Limbo
            </Chip>
          </div>

          {task && onDelete && (
            confirmDelete ? (
              <>
                <span className={styles.error}>Delete #{task.id}?</span>
                <button type="button" className={styles.deleteBtn} onClick={() => onDelete(task.id)}>Yes, delete</button>
                <button type="button" className={styles.cancelBtn} onClick={() => setConfirmDelete(false)}>No</button>
              </>
            ) : (
              <button type="button" className={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>Delete</button>
            )
          )}

          {task && onDeploy && !confirmDelete && (
            <button type="button" className={styles.cancelBtn} onClick={() => onDeploy(task.id)}>
              {task.deployedAt ? 'Deployed ×' : 'Mark deployed'}
            </button>
          )}

          {error && !confirmDelete && <span className={styles.error}>{error}</span>}
          <span className={styles.spacer} />
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
          <button type="button" className={styles.submitBtn} disabled={!form.title.trim() || busy} onClick={submit}>
            {busy ? (task ? 'Saving…' : 'Creating…') : (task ? 'Save' : 'Create')}
          </button>
        </>
      }
    >
      <form className={styles.form} onSubmit={e => { e.preventDefault(); void submit(); }}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="tb-title">Title *</label>
          <input
            id="tb-title"
            className={styles.input}
            value={form.title}
            placeholder="Task title..."
            onChange={e => set('title', e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <div className={styles.descriptionHeader}>
            <label className={styles.label}>Description</label>
            <button type="button" className={styles.expandBtn} onClick={() => setExpanded(x => !x)}>
              {expanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
          <RichTextEditor
            value={form.description}
            onChange={html => set('description', html)}
            placeholder="Optional description..."
            minHeight={expanded ? 320 : undefined}
          />
        </div>

        <div className={styles.row}>
          <Field label="Type" htmlFor="tb-type">
            <select id="tb-type" className={styles.select} value={form.type} onChange={e => set('type', e.target.value as TaskType)}>
              {TYPES.map(t => <option key={t} value={t}>{LABELS[t] ?? t}</option>)}
            </select>
          </Field>

          <Field label="Priority" htmlFor="tb-priority">
            <select id="tb-priority" className={styles.select} value={form.priority} onChange={e => set('priority', e.target.value as TaskPriority)}>
              {PRIORITIES.map(p => <option key={p} value={p}>{LABELS[p] ?? p}</option>)}
            </select>
          </Field>

          <Field label="Status" htmlFor="tb-status">
            <select id="tb-status" className={styles.select} value={form.status} onChange={e => set('status', e.target.value as TaskStatus)}>
              {STATUSES.map(s => <option key={s} value={s}>{LABELS[s] ?? s}</option>)}
            </select>
          </Field>
        </div>

        <div className={styles.row}>
          <Field label="Assignee" htmlFor="tb-assignee">
            <select id="tb-assignee" className={styles.select} value={form.assignee} onChange={e => set('assignee', e.target.value)}>
              <option value="">Unassigned</option>
              {people.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </Field>

          <Field label="Due Date" htmlFor="tb-due">
            <input id="tb-due" type="date" className={styles.input} value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
          </Field>
        </div>

        <div className={styles.inlineRow}>
          <label className={styles.inlineLabel} htmlFor="tb-tags">Tags</label>
          <input
            id="tb-tags"
            className={styles.input}
            value={form.tags}
            placeholder="e.g., urgent, backend, ui"
            onChange={e => set('tags', e.target.value)}
          />
        </div>

        <div className={styles.inlineRow} ref={searchRef}>
          <label className={styles.inlineLabel} htmlFor="tb-depends">Depends On</label>
          {dependency ? (
            <div className={styles.selectedDependency}>
              <span className={styles.dependencyChip}>#{dependency.id} {dependency.title}</span>
              <button
                type="button"
                className={styles.removeDepBtn}
                title="Remove dependency"
                onClick={() => { set('dependsOn', null); setSearch(''); }}
              >
                ×
              </button>
            </div>
          ) : (
            <div className={styles.autocomplete}>
              <input
                id="tb-depends"
                className={styles.input}
                value={search}
                autoComplete="off"
                placeholder={`Type ${MIN_SEARCH}+ letters to search...`}
                onChange={e => { setSearch(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                // Delayed so a click on a suggestion lands before the list is
                // torn down by the blur.
                onBlur={() => window.setTimeout(() => setShowSuggestions(false), 120)}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className={styles.suggestions}>
                  {suggestions.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      className={styles.suggestion}
                      onClick={() => { set('dependsOn', t.id); setSearch(''); setShowSuggestions(false); }}
                    >
                      <span className={styles.suggestionTitle}>#{t.id} {t.title}</span>
                      <span className={styles.suggestionStatus}>
                        {t.status === 'done' ? '✓' : t.status === 'in_progress' ? '⏳' : '○'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <button type="submit" hidden />
      </form>

      {task && <CommentThread taskId={task.id} me={me} />}
    </Modal>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

function Chip({ on, onChange, className, children }: {
  on: boolean;
  onChange: (v: boolean) => void;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`${styles.toggleChip} ${on ? className : ''}`}>
      <input type="checkbox" checked={on} onChange={e => onChange(e.target.checked)} />
      {children}
    </label>
  );
}
