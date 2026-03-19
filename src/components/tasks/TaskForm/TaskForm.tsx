import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  commentRefreshTrigger?: number;
  initialType?: TaskType; // Pre-fill type when creating (e.g., 'goal' from Goals sidebar)
  currentIdentity?: string; // Current user identity for permission checks
  onSubmit: (data: CreateTaskData) => void;
  onAutoSave?: (data: CreateTaskData) => Promise<void>;
  onMarkRead?: () => void;
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
  { value: 'test', label: 'Test' },
  { value: 'read', label: 'Read' },
  { value: 'goal', label: 'Goal' },
];

// Format creation date for display
function formatCreatedAt(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const created = new Date(d);
  created.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Check if text contains Hebrew characters
function containsHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

/** Sidebar showing test checklist steps — reads live from description HTML */
function TestStepsSidebar({ description, onStepClick, onNoteChange }: { description: string; onStepClick: (index: number) => void; onNoteChange?: (index: number, note: string) => void }) {
  const steps = useMemo(() => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = description;
    const items = tempDiv.querySelectorAll('.checklist-item');
    return Array.from(items).map((item, i) => {
      const state = item.getAttribute('data-state') || 'unchecked';
      const textSpan = item.querySelector('span:not(.checklist-state):not(.checklist-note-text)');
      const text = textSpan?.textContent || `Step ${i + 1}`;
      const noteEl = item.parentNode?.nextSibling as HTMLElement | null;
      const noteInput = noteEl?.classList?.contains('checklist-note-wrap')
        ? noteEl.querySelector('.checklist-note') as HTMLInputElement | null
        : item.querySelector('.checklist-note') as HTMLInputElement | null;
      const noteValue = noteInput?.getAttribute('value') || noteInput?.value || '';
      return { state, text, noteValue, index: i };
    });
  }, [description]);

  if (steps.length === 0) return null;

  return (
    <div className={styles.checklistSidebar}>
      <div className={styles.checklistSidebarHeader}>Test Steps</div>
      <div className={styles.checklistSidebarList}>
        {steps.map(({ state, text, noteValue, index }) => (
          <div key={index} className={styles.checklistSidebarItem}>
            <div className={styles.checklistSidebarRow}>
              <span className={styles.checklistSidebarIcon} onClick={() => onStepClick(index)}>
                {state === 'pass' ? '✅' : state === 'fail' ? '❌' : '☐'}
              </span>
              <span className={`${styles.checklistSidebarText} ${state === 'pass' ? styles.checklistPass : ''}`}>
                {text}
              </span>
            </div>
            {state === 'fail' && (
              <input
                className={styles.checklistSidebarNoteInput}
                type="text"
                placeholder="What failed?"
                value={noteValue}
                onChange={(e) => onNoteChange?.(index, e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TaskForm({ task, assignees, allTasks, currentDomain, showAllDomains, crewMembers, commentRefreshTrigger, initialType, currentIdentity, onSubmit, onAutoSave, onMarkRead, onCancel, onDelete }: TaskFormProps) {
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
  const [linkedTasks, setLinkedTasks] = useState<number[]>([]);
  const [dependsOnSearch, setDependsOnSearch] = useState('');
  const [showDependsOnDropdown, setShowDependsOnDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [tagsInput, setTagsInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDraft, setIsDraft] = useState(getDraftDefault());
  const [crewMember, setCrewMember] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const isFirstRenderForTaskRef = useRef(true);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dependsOnRef = useRef<HTMLDivElement>(null);
  const dependsOnInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

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

  // Close dropdown when clicking outside (but not on the portal dropdown itself)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dependsOnRef.current && !dependsOnRef.current.contains(e.target as Node)) {
        // Check if click is on the autocomplete dropdown (rendered in portal)
        const target = e.target as HTMLElement;
        if (target.closest('[data-depends-dropdown]')) return;
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

  // Calculate fixed position for autocomplete dropdown (escapes overflow:hidden parents)
  useLayoutEffect(() => {
    if (showDependsOnDropdown && dependsOnSuggestions.length > 0 && dependsOnInputRef.current) {
      const rect = dependsOnInputRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 2, left: rect.left, width: rect.width });
    } else {
      setDropdownPos(null);
    }
  }, [showDependsOnDropdown, dependsOnSuggestions]);

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

  // Reset dirty-tracking flag whenever the task changes (must run before the dirty-tracking effect)
  useEffect(() => {
    isFirstRenderForTaskRef.current = true;
  }, [task]);

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
      // Initialize linkedTasks — merge linkedTasks array with legacy dependsOn for goals
      const lt = task.linkedTasks?.length ? [...task.linkedTasks] : [];
      if ((task.type === 'goal' || task.type === 'agenda') && task.dependsOn && !lt.includes(task.dependsOn)) {
        lt.push(task.dependsOn);
      }
      setLinkedTasks(lt);
      setDependsOnSearch(''); // Clear search - we show chip when selected
      // Filter out internal tags from visible tags input
      setTagsInput(task.tags.filter(t => !t.startsWith('meetingDate:') && !t.startsWith('order:') && t !== 'goalsMeta').join(', '));
      setIsDirty(false);
      setSaveStatus('idle');
      setCrewMember(task.crewMember || '');
      setIsDraft(task.isDraft || false);
    } else {
      // Default to general for new tasks
      setDomain('general');
      setDueDate('');
      setAtRisk(false);
      setIsCompleted(false);
      setDependsOn(null);
      setLinkedTasks([]);
      setDependsOnSearch('');
      setCrewMember('');
      setIsDraft(getDraftDefault());
      setIsDirty(false);
      setSaveStatus('idle');
      // Apply initialType preset (e.g., 'goal' from Goals sidebar)
      if (initialType) {
        setType(initialType);
      } else {
        setType('feature');
      }
    }
  // allTasks intentionally excluded — it's only used for dependency UI memos, not form initialization
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, initialType]);

  const isGoal = type === 'goal' || type === 'agenda';
  const isRead = type === 'read';

  // Track user edits — skip the first render after task initialization to avoid false positives
  useEffect(() => {
    if (isFirstRenderForTaskRef.current) {
      isFirstRenderForTaskRef.current = false;
      return;
    }
    if (task) setIsDirty(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, status, priority, type, domain, assignee, dueDate, atRisk, isCompleted, dependsOn, linkedTasks.length, tagsInput, crewMember, isDraft]);

  // Build the submit payload (shared between handleSubmit and autosave)
  const buildSubmitData = useCallback((): CreateTaskData => {
    let tags: string[];
    if (isGoal && task) {
      tags = task.tags.filter(t => t.startsWith('order:'));
    } else if (isGoal) {
      tags = [];
    } else {
      tags = tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0);
    }
    const processedDescription = description.trim() ? linkifyHtml(description.trim()) : undefined;
    if (isGoal) {
      return {
        title: title.trim(),
        description: processedDescription,
        type,
        assignee: type === 'agenda' ? null : (assignee || null),
        dependsOn: null, // Goals use linkedTasks instead
        linkedTasks,
        tags,
        status: task?.status || 'todo',
        priority: task?.priority || 'medium',
        domain: task?.domain || 'general',
      };
    }
    return {
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
      dependsOn,
      tags,
      crewMember: crewMember || null,
      isDraft,
    };
  }, [isGoal, task, tagsInput, description, title, type, assignee, dependsOn, linkedTasks, status, priority, domain, dueDate, atRisk, isCompleted, crewMember, isDraft]);

  // Autosave: debounce 2.5s after last change when editing an existing task
  useEffect(() => {
    if (!isDirty || !task || !onAutoSave) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      if (!title.trim()) return;
      setSaveStatus('saving');
      try {
        await onAutoSave(buildSubmitData());
        setIsDirty(false);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 2000);
      } catch {
        setSaveStatus('idle');
      }
    }, 2500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [isDirty, buildSubmitData, task, onAutoSave, title]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;


    // For goals, preserve internal tags (meetingDate, order) but skip user tags input
    let tags: string[];
    if (isGoal && task) {
      // Keep existing internal tags (order for sorting)
      tags = task.tags.filter(t => t.startsWith('order:'));
    } else if (isGoal) {
      tags = [];
    } else {
      tags = tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);
    }

    // Linkify URLs in description before saving
    const processedDescription = description.trim() ? linkifyHtml(description.trim()) : undefined;

    if (isGoal) {
      // Goals have a minimal data shape
      onSubmit({
        title: title.trim(),
        description: processedDescription,
        type,
        assignee: type === 'agenda' ? null : (assignee || null),
        dependsOn: null,
        linkedTasks,
        tags,
        // Set sensible defaults for required fields
        status: task?.status || 'todo',
        priority: task?.priority || 'medium',
        domain: task?.domain || 'general',
      });
    } else {
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
        dependsOn,
        tags,
        crewMember: crewMember || null,
        isDraft,
      });
    }
  };

  // Read-only view for "read" type tasks
  const [readEditMode, setReadEditMode] = useState(false);
  if (isRead && task && !readEditMode) {
    const isAssignee = currentIdentity && task.assignee && currentIdentity.toLowerCase() === task.assignee.toLowerCase();
    const isOpener = currentIdentity && task.opener && currentIdentity.toLowerCase() === task.opener.toLowerCase();

    return (
      <div className={styles.form}>
        <div className={styles.header}>
          <h3>
            📖 {task.title}
            <span className={styles.taskId}>#{task.id}</span>
            {task.assignee && <span className={styles.readAssignee}>for {task.assignee}</span>}
          </h3>
          <button type="button" className={styles.closeBtn} onClick={onCancel}>×</button>
        </div>
        {task.description && (
          <div className={styles.readContent} dangerouslySetInnerHTML={{ __html: task.description }} />
        )}
        <div className={styles.actions}>
          {onDelete && isOpener && (
            <button type="button" className={styles.deleteBtn} onClick={onDelete}>Delete</button>
          )}
          {isOpener && (
            <button type="button" className={styles.cancelBtn} onClick={() => setReadEditMode(true)}>Edit</button>
          )}
          <div className={styles.rightActions}>
            <button type="button" className={styles.cancelBtn} onClick={onCancel}>Close</button>
            {isAssignee && onMarkRead && (
              task.isCompleted ? (
                <button type="button" className={styles.cancelBtn} onClick={onMarkRead}>
                  Mark as Unread
                </button>
              ) : (
                <button type="button" className={styles.submitBtn} onClick={onMarkRead}>
                  ✓ Mark as Read
                </button>
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={task ? styles.twoColumn : undefined}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.header}>
          <h3>
            {type === 'goal' ? (task ? 'Edit Goal' : 'New Goal') : type === 'agenda' ? (task ? 'Edit Agenda Item' : 'New Agenda Item') : (task ? 'Edit Task' : 'New Task')}
            {task && <span className={styles.taskId}>#{task.id}</span>}
            {task?.createdAt && (
              <span className={styles.createdDate} title={new Date(task.createdAt).toLocaleString()}>
                Created {formatCreatedAt(task.createdAt)}
              </span>
            )}
          </h3>
          <button type="button" className={styles.closeBtn} onClick={onCancel}>
            ×
          </button>
        </div>

        <div className={styles.formBody}>
          <div className={styles.titleField}>
            <label>{type === 'agenda' ? 'Agenda Item *' : isGoal ? 'Goal *' : 'Title *'}</label>
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
                placeholder={type === 'agenda' ? 'Agenda item...' : isGoal ? 'Goal title...' : 'Task title...'}
                autoFocus
                className={styles.titleTextarea}
                rows={1}
                style={containsHebrew(title) ? { direction: 'rtl', textAlign: 'right' } : undefined}
              />
            ) : (
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

          {/* === Goal-specific simplified fields === */}
          {isGoal ? (
            <>
              {type !== 'agenda' && (
                <div className={styles.inlineRow}>
                  <label htmlFor="assignee">Assigned to</label>
                  <div className={styles.inlineField}>
                    <select id="assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                      <option value="">Unassigned</option>
                      {assignees.map(a => (
                        <option key={a.id} value={a.name}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className={styles.dependsOnRow} ref={dependsOnRef}>
                <label htmlFor="dependsOn">Linked Tasks</label>
                <div className={styles.dependsOnField}>
                  <div className={styles.autocompleteWrapper}>
                    <input
                      ref={dependsOnInputRef}
                      id="dependsOn"
                      type="text"
                      value={dependsOnSearch}
                      onChange={(e) => {
                        setDependsOnSearch(e.target.value);
                        setShowDependsOnDropdown(true);
                      }}
                      onFocus={() => setShowDependsOnDropdown(true)}
                      onKeyDown={handleDependsOnKeyDown}
                      placeholder={linkedTasks.length ? 'Add another...' : 'Search board tasks to link...'}
                      autoComplete="off"
                    />
                    {showDependsOnDropdown && dependsOnSuggestions.length > 0 && dropdownPos && createPortal(
                      <div
                        className={styles.autocompleteDropdown}
                        data-depends-dropdown
                        style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999 }}
                      >
                        {dependsOnSuggestions.filter(t => !linkedTasks.includes(t.id)).map((t, index) => (
                          <div
                            key={t.id}
                            className={`${styles.autocompleteItem} ${index === highlightedIndex ? styles.highlighted : ''}`}
                            onClick={() => {
                              setLinkedTasks(prev => [...prev, t.id]);
                              setDependsOnSearch('');
                              setShowDependsOnDropdown(false);
                              setHighlightedIndex(-1);
                            }}
                            onMouseEnter={() => setHighlightedIndex(index)}
                          >
                            <span className={styles.autocompleteTitle}>#{t.id} {t.title}</span>
                            <span className={`${styles.autocompleteStatus} ${styles[t.status]}`}>
                              {t.status === 'done' ? '✓' : t.status === 'in_progress' ? '⏳' : '○'}
                            </span>
                          </div>
                        ))}
                      </div>,
                      document.body
                    )}
                  </div>
                  {linkedTasks.length > 0 && (
                    <div className={styles.linkedChips}>
                      {linkedTasks.map(ltId => {
                        const lt = allTasks.find(t => t.id === ltId);
                        return (
                          <div key={ltId} className={styles.selectedDependency}>
                            <span className={styles.dependencyChip}>
                              #{ltId} {lt?.title || 'Unknown'}
                            </span>
                            <button
                              type="button"
                              className={styles.removeDepBtn}
                              onClick={() => setLinkedTasks(prev => prev.filter(id => id !== ltId))}
                              title="Remove"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* === Regular task fields === */}
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
                  <label htmlFor="assignee">
                    {task?.opener ? <>Assigned to by <span className={styles.openerName}>{task.opener.startsWith('user_') || task.opener.startsWith('anon_') ? 'Anon' : task.opener}</span></> : 'Assignee'}
                  </label>
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
                <label htmlFor="dependsOn">{type === 'test' ? 'Tests Task' : 'Depends On'}</label>
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
                        ref={dependsOnInputRef}
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
                      {showDependsOnDropdown && dependsOnSuggestions.length > 0 && dropdownPos && createPortal(
                        <div
                          className={styles.autocompleteDropdown}
                          data-depends-dropdown
                          style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999 }}
                        >
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
                        </div>,
                        document.body
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

        </div>

        <div className={styles.actions}>
          {task && onDelete && (
            <button type="button" className={styles.deleteBtn} onClick={onDelete}>
              Delete
            </button>
          )}
          {!isGoal && (
            <div className={styles.toggles}>
              <label className={`${styles.toggleChip} ${isDraft ? styles.draftActive : ''}`}>
                <input
                  type="checkbox"
                  checked={isDraft}
                  onChange={(e) => setIsDraft(e.target.checked)}
                />
                Draft
              </label>
              <label className={`${styles.toggleChip} ${atRisk ? styles.atRiskActive : ''}`}>
                <input
                  type="checkbox"
                  checked={atRisk}
                  onChange={(e) => setAtRisk(e.target.checked)}
                />
                ⚠ Risk
              </label>
              <label className={`${styles.toggleChip} ${assignee === 'Limbo' ? styles.limboActive : ''}`}>
                <input
                  type="checkbox"
                  checked={assignee === 'Limbo'}
                  onChange={(e) => setAssignee(e.target.checked ? 'Limbo' : '')}
                />
                💀 Limbo
              </label>
              {status === 'done' && (
                <label className={`${styles.toggleChip} ${isCompleted ? styles.completedActive : ''}`}>
                  <input
                    type="checkbox"
                    checked={isCompleted}
                    onChange={(e) => setIsCompleted(e.target.checked)}
                  />
                  ✓ Done
                </label>
              )}
            </div>
          )}
          <div className={styles.rightActions}>
            <button type="button" className={styles.cancelBtn} onClick={onCancel}>
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={saveStatus === 'saving'}
            >
              {task
                ? (saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? '✓ Saved' : 'Save')
                : 'Create'}
            </button>
          </div>
        </div>
      </form>

      {/* Test tasks: live checklist sidebar — reads from description state */}
      {task && type === 'test' && description && (
        <TestStepsSidebar description={description} onStepClick={(index) => {
          const editors = document.querySelectorAll('[contenteditable]');
          for (const editor of Array.from(editors)) {
            const cbs = editor.querySelectorAll('.checklist-item input[type="checkbox"]');
            if (cbs.length > 0 && cbs[index]) {
              (cbs[index] as HTMLElement).click();
              return;
            }
          }
        }} onNoteChange={(index, note) => {
          const editors = document.querySelectorAll('[contenteditable]');
          for (const editor of Array.from(editors)) {
            const items = editor.querySelectorAll('.checklist-item');
            if (items.length > 0 && items[index]) {
              const noteWrap = items[index].parentNode?.nextSibling as HTMLElement | null;
              const noteInput = noteWrap?.classList?.contains('checklist-note-wrap')
                ? noteWrap.querySelector('.checklist-note') as HTMLInputElement
                : items[index].querySelector('.checklist-note') as HTMLInputElement;
              if (noteInput) {
                noteInput.value = note;
                noteInput.setAttribute('value', note);
                setDescription(editor.innerHTML);
              }
              return;
            }
          }
        }} />
      )}

      {/* Comments column — only for existing tasks */}
      {task && (
        <div className={styles.commentsColumn}>
          <CommentsSection taskId={task.id} assignees={assignees} refreshTrigger={commentRefreshTrigger} />
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
