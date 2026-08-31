import { useEffect, useMemo, useRef, useState } from 'react';
import { CommentThread } from '../CommentThread';
import { RichTextEditor, sanitize } from '../RichTextEditor';
import { useTranslation } from '../../state/useTranslation';
import { LABELS, PRIORITIES, STATUSES, TYPES } from '../../types';
import type { Person, Task, TaskDraft, TaskPriority, TaskStatus, TaskType } from '../../types';
import styles from './TaskFormModal.module.css';

/**
 * Create OR edit a task — one form for both, as the original has, with its
 * markup and stylesheet. Passing a `task` opens the two-column layout: the form
 * on the left, the comment thread down the right.
 *
 * Building a separate component to edit with was a mistake: two forms over the
 * same fields drift, and within a day the edit one had a different layout, a
 * different set of fields and different labels.
 *
 * The refactor is underneath. The original holds twenty-odd useState calls and
 * re-seeds them from props in an effect, which is what made it wipe itself
 * mid-edit. Here the draft is one object, seeded once by useState's initialiser
 * and never re-seeded, so there is nothing to lose.
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
  onChangeIdentity: () => void;
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
  assignee: '', dueDate: '', tags: '', dependsOn: null, isDraft: false, atRisk: false,
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

function containsHebrew(text: string): boolean {
  return /[֐-׿]/.test(text);
}

function formatCreatedAt(date: string): string {
  const d = new Date(date);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function TaskFormModal({
  me, people, allTasks, task, onCancel, onSubmit, onDelete, onDeploy, onChangeIdentity,
}: Props) {
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
  const [linkCopied, setLinkCopied] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const translation = useTranslation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

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

  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?task=${task?.id}`;
    void navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  return (
    <div className={styles.formOverlay} onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div
        className={`${styles.formContainer} ${task ? styles.formContainerEdit : ''}`}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className={task ? styles.twoColumn : undefined}>
          <form className={styles.form} onSubmit={e => { e.preventDefault(); void submit(); }}>
            <div className={styles.header}>
              <h3>
                {task ? 'Edit Task' : 'New Task'}
                {task && <span className={styles.taskId}>#{task.id}</span>}
                {task?.createdAt && (
                  <span className={styles.createdDate} title={new Date(task.createdAt).toLocaleString()}>
                    Created {formatCreatedAt(task.createdAt)}
                  </span>
                )}
              </h3>
              <div className={styles.headerActions}>
                {task && (
                  <button type="button" className={styles.copyLinkBtn} title="Copy link to task" onClick={copyLink}>
                    {linkCopied ? 'Copied!' : 'Copy link'}
                  </button>
                )}
                <button type="button" className={styles.closeBtn} onClick={onCancel}>×</button>
              </div>
            </div>

            <div className={styles.formBody}>
              <div className={styles.titleField}>
                <label htmlFor="tb-title">Title *</label>
                {/* A textarea carrying the original class, not a bare input:
                    that class is what makes it span the field, and a long title
                    wraps here rather than scrolling sideways. */}
                {(!task || editingTitle) ? (
                  <textarea
                    ref={titleRef}
                    id="tb-title"
                    className={styles.titleTextarea}
                    rows={1}
                    value={form.title}
                    placeholder="Task title..."
                    autoFocus
                    style={containsHebrew(form.title) ? { direction: 'rtl', textAlign: 'right' } : undefined}
                    onChange={e => set('title', e.target.value)}
                    onBlur={() => { if (task && form.title.trim()) setEditingTitle(false); }}
                    onKeyDown={e => { if (e.key === 'Escape' && task) setEditingTitle(false); }}
                  />
                ) : (
                  <div
                    className={styles.titleDisplay}
                    style={containsHebrew(form.title) ? { direction: 'rtl', textAlign: 'right' } : undefined}
                    onClick={() => {
                      setEditingTitle(true);
                      window.setTimeout(() => titleRef.current?.focus(), 0);
                    }}
                  >
                    {form.title || <span className={styles.titlePlaceholder}>Click to add title...</span>}
                  </div>
                )}
              </div>

              <div className={styles.descriptionField}>
                <div className={styles.descriptionHeader}>
                  <label>Description</label>
                  <span className={styles.headerLinks}>
                    <button
                      type="button"
                      className={styles.expandBtn}
                      disabled={translation.busy || (!form.title.trim() && !form.description.trim())}
                      // Title and description go together: they are one piece of
                      // writing, and translating half reads as a mistake.
                      onClick={() => translation.toggle(
                        [form.title, form.description].filter(Boolean).join('\n\n'),
                      )}
                    >
                      {translation.busy ? 'Translating…' : translation.showing ? 'Hide translation' : 'Translate'}
                    </button>
                    <button type="button" className={styles.expandBtn} onClick={() => setExpanded(true)}>
                      Expand
                    </button>
                  </span>
                </div>

                <RichTextEditor
                  value={form.description}
                  onChange={html => set('description', html)}
                  placeholder="Optional description..."
                  people={people}
                />

                {translation.error && <div className={styles.translationError}>{translation.error}</div>}

                {translation.showing && translation.text !== null && (
                  <div className={styles.translation} dir="auto">
                    <span className={styles.translationLabel}>Translation</span>
                    {/* Through the same sanitiser the editor's own output goes
                        through, never raw. */}
                    <div dangerouslySetInnerHTML={{ __html: sanitize(translation.text) }} />
                  </div>
                )}
              </div>

              <div className={styles.row}>
                <div className={styles.field}>
                  <label htmlFor="tb-type">Type</label>
                  <select id="tb-type" value={form.type} onChange={e => set('type', e.target.value as TaskType)}>
                    {TYPES.map(t => <option key={t} value={t}>{LABELS[t] ?? t}</option>)}
                  </select>
                </div>

                <div className={styles.field}>
                  <label htmlFor="tb-priority">Priority</label>
                  <select id="tb-priority" value={form.priority} onChange={e => set('priority', e.target.value as TaskPriority)}>
                    {PRIORITIES.map(p => <option key={p} value={p}>{LABELS[p] ?? p}</option>)}
                  </select>
                </div>

                <div className={styles.field}>
                  <label htmlFor="tb-status">Status</label>
                  <select id="tb-status" value={form.status} onChange={e => set('status', e.target.value as TaskStatus)}>
                    {STATUSES.map(s => <option key={s} value={s}>{LABELS[s] ?? s}</option>)}
                  </select>
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.field}>
                  <label htmlFor="tb-assignee">
                    {task?.opener
                      ? <>Assigned to by <span className={styles.openerName}>{task.opener}</span></>
                      : 'Assignee'}
                  </label>
                  <select id="tb-assignee" value={form.assignee} onChange={e => set('assignee', e.target.value)}>
                    <option value="">Unassigned</option>
                    {people.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                </div>

                <div className={styles.field}>
                  <label htmlFor="tb-due">Due Date</label>
                  <input id="tb-due" type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
                </div>
              </div>

              <div className={styles.inlineRow}>
                <label htmlFor="tb-tags">Tags</label>
                <div className={styles.inlineField}>
                  <input
                    id="tb-tags"
                    type="text"
                    value={form.tags}
                    placeholder="e.g., urgent, backend, ui"
                    onChange={e => set('tags', e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.dependsOnRow}>
                <label htmlFor="tb-depends">Depends On</label>
                <div className={styles.dependsOnField}>
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
                    <div className={styles.autocompleteWrapper}>
                      <input
                        id="tb-depends"
                        type="text"
                        autoComplete="off"
                        value={search}
                        placeholder={`Type ${MIN_SEARCH}+ letters to search...`}
                        onChange={e => { setSearch(e.target.value); setShowSuggestions(true); setHighlighted(-1); }}
                        onFocus={() => setShowSuggestions(true)}
                        onKeyDown={e => {
                          if (!showSuggestions || suggestions.length === 0) return;
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setHighlighted(i => (i + 1) % suggestions.length);
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setHighlighted(i => (i <= 0 ? suggestions.length : i) - 1);
                          } else if (e.key === 'Enter' && highlighted >= 0) {
                            // Only when a row is highlighted, so Enter still
                            // submits the form when the list is merely open.
                            e.preventDefault();
                            set('dependsOn', suggestions[highlighted].id);
                            setSearch('');
                            setShowSuggestions(false);
                            setHighlighted(-1);
                          } else if (e.key === 'Escape') {
                            setShowSuggestions(false);
                          }
                        }}
                        // Delayed so a click on a suggestion lands before the
                        // list is torn down by the blur.
                        onBlur={() => window.setTimeout(() => setShowSuggestions(false), 120)}
                      />
                      {showSuggestions && suggestions.length > 0 && (
                        <div className={styles.suggestionsList}>
                          {suggestions.map((t, i) => (
                            <div
                              key={t.id}
                              className={`${styles.suggestionItem} ${i === highlighted ? styles.highlighted : ''}`}
                              onMouseEnter={() => setHighlighted(i)}
                              onClick={() => { set('dependsOn', t.id); setSearch(''); setShowSuggestions(false); }}
                            >
                              <span className={styles.autocompleteTitle}>#{t.id} {t.title}</span>
                              <span className={`${styles.autocompleteStatus} ${styles[t.status]}`}>
                                {t.status === 'done' ? '✓' : t.status === 'in_progress' ? '⏳' : '○'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.actions}>
              <div className={styles.actionsRow1}>
                {task && onDelete && (
                  confirmDelete ? (
                    <>
                      <button type="button" className={styles.deleteBtn} onClick={() => onDelete(task.id)}>
                        Delete #{task.id}?
                      </button>
                      <button type="button" className={styles.cancelBtn} onClick={() => setConfirmDelete(false)}>
                        Keep
                      </button>
                    </>
                  ) : (
                    <button type="button" className={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>
                      Delete
                    </button>
                  )
                )}

                <div className={styles.toggles}>
                  <label className={`${styles.toggleChip} ${form.isDraft ? styles.draftActive : ''}`}>
                    <input type="checkbox" checked={form.isDraft} onChange={e => set('isDraft', e.target.checked)} />
                    Draft
                  </label>
                  <label className={`${styles.toggleChip} ${form.atRisk ? styles.atRiskActive : ''}`}>
                    <input type="checkbox" checked={form.atRisk} onChange={e => set('atRisk', e.target.checked)} />
                    ⚠ Risk
                  </label>
                  <label className={`${styles.toggleChip} ${form.assignee === 'Limbo' ? styles.limboActive : ''}`}>
                    <input
                      type="checkbox"
                      checked={form.assignee === 'Limbo'}
                      onChange={e => set('assignee', e.target.checked ? 'Limbo' : '')}
                    />
                    💀 Limbo
                  </label>
                  {task && form.status === 'done' && (
                    <label className={`${styles.toggleChip} ${task.acknowledged ? styles.completedActive : ''}`}>
                      <input
                        type="checkbox"
                        checked={task.acknowledged}
                        // Saved on the spot rather than with the form: it is an
                        // approval, and holding it behind Save meant it reverted
                        // silently whenever the dialog was closed with Cancel.
                        onChange={e => void onSubmit({ acknowledged: e.target.checked })}
                      />
                      &#10003; Done
                    </label>
                  )}
                  {task && onDeploy && (
                    <button
                      type="button"
                      className={`${styles.toggleChip} ${task.deployedAt ? styles.deployedBadge : styles.deployBtn}`}
                      onClick={() => onDeploy(task.id)}
                    >
                      🚀 {task.deployedAt ? 'Deployed' : 'Deploy'}
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.rightActions}>
                {error && <span className={styles.translationError}>{error}</span>}
                <button type="button" className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={!form.title.trim() || busy}>
                  {busy ? (task ? 'Saving...' : 'Creating...') : (task ? 'Save' : 'Create')}
                </button>
              </div>
            </div>
          </form>

          {task && (
            <div className={styles.commentsColumn}>
              <CommentThread
                taskId={task.id}
                me={me}
                people={people}
                onChangeIdentity={onChangeIdentity}
              />
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div className={styles.expandedOverlay} onMouseDown={() => setExpanded(false)}>
          <div className={styles.expandedEditor} onMouseDown={e => e.stopPropagation()}>
            <div className={styles.expandedHeader}>
              <h4>Edit Description</h4>
              <button type="button" className={styles.closeBtn} onClick={() => setExpanded(false)}>&times;</button>
            </div>
            <div className={styles.expandedContent}>
              <RichTextEditor
                value={form.description}
                onChange={html => set('description', html)}
                placeholder="Write your description..."
                minHeight={420}
                people={people}
              />
            </div>
            <div className={styles.expandedActions}>
              <button type="button" className={styles.submitBtn} onClick={() => setExpanded(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
