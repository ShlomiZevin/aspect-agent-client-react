import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Task, Assignee, CreateTaskData, TaskStatus, TaskPriority, TaskType } from '../../../types/task';
import type { CrewMember } from '../../../types/crew';
import { RichTextEditor } from '../RichTextEditor/RichTextEditor';
import { CommentsSection } from '../CommentsSection/CommentsSection';
import { getDraftDefault } from '../../../utils/userIdentifier';
import styles from './TaskForm.module.css';

// All known domains in the system
const ALL_DOMAINS = ['freeda', 'aspect', 'banking', 'byline'];

// Lybi domains - when on any of these, show all of them + general
const LYBI_DOMAINS = ['freeda', 'banking'];

/**
 * Convert plain URLs in text/HTML to clickable anchor tags
 */
function linkifyHtml(html: string): string {
  // URL regex - matches http(s) URLs not already inside href or src attributes
  const urlRegex = /(?<!href="|src="|">)(https?:\/\/[^\s<>"]+)/g;

  return html.replace(urlRegex, (url) => {
    // Clean up trailing punctuation that might have been captured
    const cleanUrl = url.replace(/[.,;:!?)]+$/, '');
    const trailing = url.slice(cleanUrl.length);
    return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>${trailing}`;
  });
}

interface TaskFormProps {
  task?: Task | null;
  assignees: Assignee[];
  allTasks: Task[]; // All tasks for dependency selector
  currentDomain: string; // Current domain from URL (e.g., 'freeda', 'aspect')
  showAllDomains?: boolean; // When true, show all domain options (Ctrl+Shift+A mode)
  crewMembers?: CrewMember[];
  onSubmit: (data: CreateTaskData) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'task', label: 'Task' },
  { value: 'feature', label: 'Feature' },
  { value: 'bug', label: 'Bug' },
  { value: 'idea', label: 'Idea' },
];

// Check if text contains Hebrew characters
function containsHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

export function TaskForm({ task, assignees, allTasks, currentDomain, showAllDomains, crewMembers, onSubmit, onCancel, onDelete }: TaskFormProps) {
  const [title, setTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [type, setType] = useState<TaskType>('feature');
  const [domain, setDomain] = useState<string>('general');
  const [assignee, setAssignee] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [atRisk, setAtRisk] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [dependsOn, setDependsOn] = useState<number | null>(null);
  const [dependsOnSearch, setDependsOnSearch] = useState('');
  const [showDependsOnDropdown, setShowDependsOnDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [tagsInput, setTagsInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDraft, setIsDraft] = useState(getDraftDefault());
  const [crewMember, setCrewMember] = useState<string>('');
  const dependsOnRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize title textarea
  useEffect(() => {
    if (titleInputRef.current) {
      titleInputRef.current.style.height = 'auto';
      titleInputRef.current.style.height = titleInputRef.current.scrollHeight + 'px';
    }
  }, [title, isEditingTitle]);

  // Filter out current task from dependency options (can't depend on self)
  const dependencyOptions = useMemo(() =>
    allTasks.filter(t => t.id !== task?.id),
    [allTasks, task?.id]
  );

  // Autocomplete suggestions - show after 3+ characters
  const dependsOnSuggestions = useMemo(() => {
    if (dependsOnSearch.length < 3) return [];
    const search = dependsOnSearch.toLowerCase();
    return dependencyOptions.filter(t =>
      t.title.toLowerCase().includes(search)
    ).slice(0, 8); // Limit to 8 suggestions
  }, [dependsOnSearch, dependencyOptions]);

  // Get the selected dependency task name for display
  const selectedDependencyName = useMemo(() => {
    if (!dependsOn) return '';
    const depTask = allTasks.find(t => t.id === dependsOn);
    return depTask?.title || '';
  }, [dependsOn, allTasks]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dependsOnRef.current && !dependsOnRef.current.contains(e.target as Node)) {
        setShowDependsOnDropdown(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlighted index when suggestions change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [dependsOnSuggestions]);

  // Use ref for suggestions to avoid stale closure issues
  const suggestionsRef = useRef(dependsOnSuggestions);
  suggestionsRef.current = dependsOnSuggestions;

  // Handle keyboard navigation for autocomplete
  const handleDependsOnKeyDown = useCallback((e: React.KeyboardEvent) => {
    const suggestions = suggestionsRef.current;

    // Handle Escape even if no suggestions
    if (e.key === 'Escape') {
      setShowDependsOnDropdown(false);
      setHighlightedIndex(-1);
      return;
    }

    // Only handle navigation if dropdown is visible with suggestions
    if (suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        setHighlightedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        e.stopPropagation();
        setHighlightedIndex(currentIndex => {
          if (currentIndex >= 0 && currentIndex < suggestions.length) {
            const selected = suggestions[currentIndex];
            setDependsOn(selected.id);
            setDependsOnSearch('');
            setShowDependsOnDropdown(false);
          }
          return -1;
        });
        break;
    }
  }, []);

  // Domain options:
  // - If showAllDomains (Ctrl+Shift+A), show all domains
  // - If on a lybi domain (freeda/byline/banking), show all lybi domains + general
  // - Otherwise show current + general
  const isLybiDomain = LYBI_DOMAINS.includes(currentDomain);
  const domainOptions = showAllDomains
    ? [
        { value: 'general', label: 'General (Engine)' },
        ...ALL_DOMAINS.map(d => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) }))
      ]
    : isLybiDomain
      ? [
          { value: 'general', label: 'General (Engine)' },
          ...LYBI_DOMAINS.map(d => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) }))
        ]
      : currentDomain && currentDomain !== 'general'
        ? [{ value: 'general', label: 'General (Engine)' }, { value: currentDomain, label: currentDomain.charAt(0).toUpperCase() + currentDomain.slice(1) }]
        : [{ value: 'general', label: 'General (Engine)' }];

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setStatus(task.status);
      setPriority(task.priority);
      setType(task.type);
      setDomain(task.domain || 'general');
      setAssignee(task.assignee || '');
      setDueDate(task.dueDate || '');
      setAtRisk(task.atRisk || false);
      setIsCompleted(task.isCompleted || false);
      setDependsOn(task.dependsOn || null);
      setDependsOnSearch(''); // Clear search - we show chip when selected
      setTagsInput(task.tags.join(', '));
      setCrewMember(task.crewMember || '');
      setIsDraft(task.isDraft || false);
    } else {
      // Default to general for new tasks
      setDomain('general');
      setDueDate('');
      setAtRisk(false);
      setIsCompleted(false);
      setDependsOn(null);
      setDependsOnSearch('');
      setCrewMember('');
      setIsDraft(getDraftDefault());
    }
  }, [task, allTasks]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    // Linkify URLs in description before saving
    const processedDescription = description.trim() ? linkifyHtml(description.trim()) : undefined;

    onSubmit({
      title: title.trim(),
      description: processedDescription,
      status,
      priority,
      type,
      domain,
      assignee: assignee || null,
      dueDate: dueDate || undefined,
      atRisk,
      isCompleted,
      dependsOn, // Pass null to clear, number to set
      tags,
      crewMember: crewMember || null,
      isDraft,
    });
  };

  return (
    <>
      <div className={task ? styles.twoColumn : undefined}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.header}>
          <h3>
            {task ? 'Edit Task' : 'New Task'}
            {task && <span className={styles.taskId}>#{task.id}</span>}
          </h3>
          <button type="button" className={styles.closeBtn} onClick={onCancel}>
            ×
          </button>
        </div>

        <div className={styles.formBody}>
          <div className={styles.titleField}>
            <label>Title *</label>
            {/* For new tasks or when editing: show textarea */}
            {(!task || isEditingTitle) ? (
              <textarea
                ref={titleInputRef}
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => {
                  if (task && title.trim()) {
                    setIsEditingTitle(false);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && task) {
                    setIsEditingTitle(false);
                  }
                }}
                placeholder="Task title..."
                autoFocus
                className={styles.titleTextarea}
                rows={1}
                style={containsHebrew(title) ? { direction: 'rtl', textAlign: 'right' } : undefined}
              />
            ) : (
              /* For existing tasks: show as clickable text */
              <div
                className={styles.titleDisplay}
                onClick={() => {
                  setIsEditingTitle(true);
                  setTimeout(() => titleInputRef.current?.focus(), 0);
                }}
                style={containsHebrew(title) ? { direction: 'rtl', textAlign: 'right' } : undefined}
              >
                {title || <span className={styles.titlePlaceholder}>Click to add title...</span>}
              </div>
            )}
          </div>

          <div className={styles.descriptionField}>
            <div className={styles.descriptionHeader}>
              <label>Description</label>
              <button
                type="button"
                className={styles.expandBtn}
                onClick={() => setIsExpanded(true)}
              >
                Expand
              </button>
            </div>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Optional description..."
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="type">Type</label>
              <select id="type" value={type} onChange={(e) => setType(e.target.value as TaskType)}>
                {TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="priority">Priority</label>
              <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                {PRIORITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="status">Status</label>
              <select id="status" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="domain">Domain</label>
              <select id="domain" value={domain} onChange={(e) => setDomain(e.target.value)}>
                {domainOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="assignee">Assignee</label>
              <select id="assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">Unassigned</option>
                {assignees.map(a => (
                  <option key={a.id} value={a.name}>{a.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="dueDate">Due Date</label>
              <input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.inlineRow}>
            <label htmlFor="crewMember">Crew</label>
            <div className={styles.inlineField}>
              {crewMembers && crewMembers.length > 0 ? (
                <select id="crewMember" value={crewMember} onChange={(e) => setCrewMember(e.target.value)}>
                  <option value="">None</option>
                  {crewMembers.map(c => (
                    <option key={c.name} value={c.name}>{c.displayName || c.name}</option>
                  ))}
                </select>
              ) : (
                <input id="crewMember" type="text" value={crewMember} onChange={(e) => setCrewMember(e.target.value)} placeholder="No crews available" />
              )}
            </div>
          </div>

          <div className={styles.inlineRow}>
            <label htmlFor="tags">Tags</label>
            <div className={styles.inlineField}>
              <input
                id="tags"
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g., urgent, backend, ui"
              />
            </div>
          </div>

          <div className={styles.dependsOnRow} ref={dependsOnRef}>
            <label htmlFor="dependsOn">Depends On</label>
            <div className={styles.dependsOnField}>
              {dependsOn ? (
                <div className={styles.selectedDependency}>
                  <span className={styles.dependencyChip}>
                    {selectedDependencyName}
                  </span>
                  <button
                    type="button"
                    className={styles.removeDepBtn}
                    onClick={() => {
                      setDependsOn(null);
                      setDependsOnSearch('');
                    }}
                    title="Remove dependency"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className={styles.autocompleteWrapper}>
                  <input
                    id="dependsOn"
                    type="text"
                    value={dependsOnSearch}
                    onChange={(e) => {
                      setDependsOnSearch(e.target.value);
                      setShowDependsOnDropdown(true);
                    }}
                    onFocus={() => setShowDependsOnDropdown(true)}
                    onKeyDown={handleDependsOnKeyDown}
                    placeholder="Type 3+ letters to search..."
                    autoComplete="off"
                  />
                  {showDependsOnDropdown && dependsOnSuggestions.length > 0 && (
                    <div className={styles.autocompleteDropdown}>
                      {dependsOnSuggestions.map((t, index) => (
                        <div
                          key={t.id}
                          className={`${styles.autocompleteItem} ${index === highlightedIndex ? styles.highlighted : ''}`}
                          onClick={() => {
                            setDependsOn(t.id);
                            setDependsOnSearch('');
                            setShowDependsOnDropdown(false);
                            setHighlightedIndex(-1);
                          }}
                          onMouseEnter={() => setHighlightedIndex(index)}
                        >
                          <span className={styles.autocompleteTitle}>{t.title}</span>
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
          {task && onDelete && (
            <button type="button" className={styles.deleteBtn} onClick={onDelete}>
              Delete
            </button>
          )}
          <label className={styles.draftToggle}>
            <input
              type="checkbox"
              checked={isDraft}
              onChange={(e) => setIsDraft(e.target.checked)}
            />
            <span className={styles.draftLabel}>
              Draft
              <span className={styles.draftHint}>(only you see it)</span>
            </span>
          </label>
          <label className={`${styles.checkboxLabel} ${atRisk ? styles.atRiskActive : ''}`}>
            <input
              type="checkbox"
              checked={atRisk}
              onChange={(e) => setAtRisk(e.target.checked)}
            />
            <span className={styles.checkboxIcon}>⚠</span>
            At Risk
          </label>
          {status === 'done' && (
            <label className={`${styles.checkboxLabel} ${isCompleted ? styles.completedActive : ''}`}>
              <input
                type="checkbox"
                checked={isCompleted}
                onChange={(e) => setIsCompleted(e.target.checked)}
              />
              <span className={styles.checkboxIcon}>✓</span>
              Completed
            </label>
          )}
          <div className={styles.rightActions}>
            <button type="button" className={styles.cancelBtn} onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className={styles.submitBtn}>
              {task ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </div>
      </form>

      {/* Comments column — only for existing tasks */}
      {task && (
        <div className={styles.commentsColumn}>
          <CommentsSection taskId={task.id} assignees={assignees} />
        </div>
      )}
      </div>

      {/* Expanded description editor */}
      {isExpanded && (
        <div className={styles.expandedOverlay} onClick={() => setIsExpanded(false)}>
          <div className={styles.expandedEditor} onClick={(e) => e.stopPropagation()}>
            <div className={styles.expandedHeader}>
              <h4>Edit Description</h4>
              <button type="button" className={styles.closeBtn} onClick={() => setIsExpanded(false)}>
                ×
              </button>
            </div>
            <div className={styles.expandedContent}>
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder="Write your description..."
                expanded
              />
            </div>
            <div className={styles.expandedActions}>
              <button
                type="button"
                className={styles.submitBtn}
                onClick={() => setIsExpanded(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
