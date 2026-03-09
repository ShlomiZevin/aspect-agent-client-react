import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Task, Assignee, CreateTaskData, TaskStatus } from '../../../types/task';
import { useBoardStream } from '../../../hooks/useBoardStream';
import type { BoardEvent } from '../../../hooks/useBoardStream';
import type { CrewMember } from '../../../types/crew';
import * as taskService from '../../../services/taskService';
import { getAgentCrew } from '../../../services/crewService';
import { TaskBoard } from '../TaskBoard/TaskBoard';
import { TaskList } from '../TaskList/TaskList';
import { TaskForm } from '../TaskForm/TaskForm';
import { AssigneeManager, getAssigneeColor } from '../AssigneeManager/AssigneeManager';
import { NotificationBell } from '../NotificationBell/NotificationBell';
import { useNotifications } from '../../../hooks/useNotifications';
import { getUserId, getDraftDefault, setDraftDefault } from '../../../utils/userIdentifier';
import styles from './TaskBoardModal.module.css';

interface TaskBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  openInDraftsMode?: boolean;
  onDraftsModeAcknowledged?: () => void;
}

type ViewMode = 'board' | 'list';

// Known domains (agents) in the system
const KNOWN_DOMAINS = ['freeda', 'aspect', 'banking', 'byline'];

// Lybi domains - when on any of these, show all of them in filter
const LYBI_DOMAINS = ['freeda', 'banking'];

// Map URL domain slugs to actual server agent names (used for crew API calls)
const DOMAIN_TO_AGENT_NAME: Record<string, string> = {
  freeda: 'Freeda 2.0',
  aspect: 'Aspect',
  banking: 'Banking Onboarder',
  byline: 'Byline',
};

/**
 * Detect current domain from URL path
 * e.g., /freeda/... -> 'freeda', /aspect/... -> 'aspect', / -> 'general'
 */
function getCurrentDomain(): string {
  const path = window.location.pathname.toLowerCase();
  for (const domain of KNOWN_DOMAINS) {
    if (path.startsWith(`/${domain}`)) {
      return domain;
    }
  }
  return 'general';
}

export function TaskBoardModal({ isOpen, onClose, openInDraftsMode, onDraftsModeAcknowledged }: TaskBoardModalProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showAllDomains, setShowAllDomains] = useState(false);
  const [filterDomain, setFilterDomain] = useState<string>('current');
  const [filterAssignee, setFilterAssignee] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);
  const [showDraftsOnly, setShowDraftsOnly] = useState(false);
  const [selectedDrafts, setSelectedDrafts] = useState<Set<number>>(new Set());
  const [selectedExports, setSelectedExports] = useState<Set<number>>(new Set());
  const [exportCopied, setExportCopied] = useState(false);
  const [idSearch, setIdSearch] = useState('');
  const [draftByDefault, setDraftByDefault] = useState(() => getDraftDefault());
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [filterCrewMember, setFilterCrewMember] = useState<string | null>(null);
  const [filterOpener, setFilterOpener] = useState<string | null>(null);

  // Delete confirmation modal state
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get current user ID for draft filtering
  const currentUserId = useMemo(() => getUserId(), []);

  // Notifications: poll every 10s while modal is open
  const notificationsState = useNotifications(isOpen);

  // Live board updates via SSE
  const [commentRefreshTrigger, setCommentRefreshTrigger] = useState(0);
  const editingTaskRef = useRef<Task | null>(null);
  editingTaskRef.current = editingTask;

  useBoardStream(isOpen, (event: BoardEvent) => {
    if (event.type === 'task_created' || event.type === 'task_updated') {
      loadData();
    } else if (event.type === 'comment_added') {
      if (editingTaskRef.current?.id === event.taskId) {
        setCommentRefreshTrigger(n => n + 1);
      }
    }
  });

  // Detect current domain when modal opens
  const currentDomain = useMemo(() => (isOpen ? getCurrentDomain() : 'general'), [isOpen]);

  // Count unassigned tasks (orphans) - not completed, no assignee, not draft
  const unassignedCount = useMemo(() => {
    return tasks.filter(t => !t.assignee && !t.isCompleted && !t.isDraft).length;
  }, [tasks]);

  // Count draft tasks created by current user
  const draftCount = useMemo(() => {
    return tasks.filter(t => t.isDraft && t.createdBy === currentUserId).length;
  }, [tasks, currentUserId]);

  // Unique openers (creators) derived from current tasks
  const uniqueOpeners = useMemo(() => {
    const openers = new Set(tasks.filter(t => t.opener).map(t => t.opener!));
    return Array.from(openers).sort();
  }, [tasks]);

  // Map crew technical names to display names
  const crewDisplayNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const crew of crewMembers) {
      if (crew.displayName) map[crew.name] = crew.displayName;
    }
    return map;
  }, [crewMembers]);

  // Filter tasks by domain, assignee, and completed status
  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Draft filtering - mutually exclusive with other modes
    if (showDraftsOnly) {
      // Show only drafts created by current user
      return result.filter(t => t.isDraft && t.createdBy === currentUserId);
    }

    // Hide all drafts in normal views (only show non-draft tasks OR own drafts)
    result = result.filter(t => !t.isDraft || t.createdBy === currentUserId);

    // Filter by completed status first (hide completed by default)
    if (!showCompleted) {
      result = result.filter(t => !t.isCompleted);
    }

    // Filter by unassigned only
    if (showUnassignedOnly) {
      result = result.filter(t => !t.assignee);
    }
    // Or filter by specific assignee
    else if (filterAssignee) {
      result = result.filter(t => t.assignee === filterAssignee);
    }

    // Filter by crew member
    if (filterCrewMember) {
      result = result.filter(t => t.crewMember === filterCrewMember);
    }

    // Filter by creator (opener)
    if (filterOpener) {
      result = result.filter(t => t.opener === filterOpener);
    }

    // Then filter by domain
    if (filterDomain === 'all') {
      // "All Domains" means all domains currently visible in the dropdown
      if (showAllDomains) {
        // All known domains + general
        return result.filter(t => t.domain === 'general' || KNOWN_DOMAINS.includes(t.domain));
      } else if (LYBI_DOMAINS.includes(currentDomain)) {
        // Lybi domains + general
        return result.filter(t => t.domain === 'general' || LYBI_DOMAINS.includes(t.domain));
      } else {
        // Just current domain + general
        return result.filter(t => t.domain === currentDomain || t.domain === 'general');
      }
    }
    if (filterDomain === 'general') return result.filter(t => t.domain === 'general');
    if (filterDomain === 'current') return result.filter(t => t.domain === currentDomain || t.domain === 'general');
    return result.filter(t => t.domain === filterDomain);
  }, [tasks, filterDomain, filterAssignee, filterCrewMember, filterOpener, currentDomain, showCompleted, showAllDomains, showUnassignedOnly, showDraftsOnly, currentUserId]);

  // Handle opening in drafts mode (from Ctrl+Shift+L global shortcut)
  useEffect(() => {
    if (isOpen && openInDraftsMode) {
      setShowDraftsOnly(true);
      setViewMode('list'); // Show list view for easier selection
      setShowUnassignedOnly(false);
      setFilterAssignee(null);
      onDraftsModeAcknowledged?.();
    }
  }, [isOpen, openInDraftsMode, onDraftsModeAcknowledged]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyA') {
        e.preventDefault();
        setShowAllDomains(prev => {
          const newValue = !prev;
          if (newValue) setFilterDomain('all');
          return newValue;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const loadData = useCallback(async () => {
    // Show spinner only on first load — subsequent refreshes update silently
    if (!hasLoadedRef.current) setIsLoading(true);
    try {
      const [tasksData, assigneesData] = await Promise.all([
        taskService.getTasks(),
        taskService.getAssignees(),
      ]);
      setTasks(tasksData);
      setAssignees(assigneesData);
      hasLoadedRef.current = true;
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Determine the best domain to fetch crews from
  const crewFetchDomain = useMemo(() => {
    // If a specific domain is selected in the filter, use that
    if (filterDomain && filterDomain !== 'current' && filterDomain !== 'all' && filterDomain !== 'general') {
      return filterDomain;
    }
    // If we're on a specific agent page, use that
    if (currentDomain !== 'general') {
      return currentDomain;
    }
    // Fallback: try first lybi domain so crews are still available
    return LYBI_DOMAINS[0];
  }, [filterDomain, currentDomain]);

  // Fetch crew members for the active domain
  useEffect(() => {
    if (!isOpen) {
      setCrewMembers([]);
      return;
    }
    const baseURL = import.meta.env.DEV
      ? 'http://localhost:3000'
      : (import.meta.env.VITE_API_URL || 'https://aspect-server-138665194481.us-central1.run.app');
    const agentName = DOMAIN_TO_AGENT_NAME[crewFetchDomain] || crewFetchDomain;
    getAgentCrew(agentName, baseURL).then(setCrewMembers);
  }, [isOpen, crewFetchDomain]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    } else {
      // Reset so next open shows the spinner again
      hasLoadedRef.current = false;
    }
  }, [isOpen, loadData]);

  const handleAddAssignee = async (name: string) => {
    const assignee = await taskService.addAssignee(name);
    setAssignees(prev => [...prev, assignee]);
  };

  const handleCreateTask = async (data: CreateTaskData) => {
    // Add createdBy for draft tasks - always set it if isDraft is true
    // Add opener (human-readable identity) if set
    const taskData = {
      ...data,
      isDraft: data.isDraft || false,
      createdBy: data.isDraft ? currentUserId : undefined,
      opener: notificationsState.identity || undefined,
    };
    const task = await taskService.createTask(taskData);
    setTasks(prev => [task, ...prev]);
    setShowForm(false);
  };

  const handleUpdateTask = async (data: CreateTaskData) => {
    if (!editingTask) return;
    // Set createdBy when marking as draft, pass updatedBy for notification attribution
    const taskData = {
      ...data,
      createdBy: data.isDraft ? (editingTask.createdBy || currentUserId) : data.createdBy,
      updatedBy: notificationsState.identity || undefined,
    };
    const updated = await taskService.updateTask(editingTask.id, taskData);
    setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)));
    setEditingTask(null);
    setShowForm(false);
  };

  const handleDeleteTask = async (task: Task) => {
    setTaskToDelete(task);
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;
    setIsDeleting(true);
    try {
      await taskService.deleteTask(taskToDelete.id);
      setTasks(prev => prev.filter(t => t.id !== taskToDelete.id));
      if (editingTask?.id === taskToDelete.id) {
        setEditingTask(null);
        setShowForm(false);
      }
    } finally {
      setIsDeleting(false);
      setTaskToDelete(null);
    }
  };

  const cancelDeleteTask = () => {
    setTaskToDelete(null);
  };

  const handleTaskClick = (task: Task) => {
    setEditingTask(task);
    setShowForm(true);
  };

  const handleStatusChange = async (taskId: number, newStatus: TaskStatus) => {
    // Optimistic update
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, status: newStatus } : t)));

    try {
      await taskService.updateTask(taskId, { status: newStatus });
    } catch (err) {
      console.error('Failed to update task status:', err);
      // Revert on error
      loadData();
    }
  };

  const handleAtRiskToggle = async (taskId: number, atRisk: boolean) => {
    // Optimistic update
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, atRisk } : t)));

    try {
      await taskService.updateTask(taskId, { atRisk });
    } catch (err) {
      console.error('Failed to update task at-risk status:', err);
      // Revert on error
      loadData();
    }
  };

  const handleMarkComplete = async (taskId: number, isCompleted: boolean) => {
    // Optimistic update
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, isCompleted } : t)));

    try {
      await taskService.updateTask(taskId, { isCompleted });
    } catch (err) {
      console.error('Failed to update task completion status:', err);
      // Revert on error
      loadData();
    }
  };

  const handleToggleDraftSelection = (taskId: number) => {
    setSelectedDrafts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const handleSelectAllDrafts = () => {
    const allDraftIds = filteredTasks.filter(t => t.isDraft).map(t => t.id);
    setSelectedDrafts(new Set(allDraftIds));
  };

  const handleDeselectAllDrafts = () => {
    setSelectedDrafts(new Set());
  };

  const handleFireDrafts = async (taskIds: number[]) => {
    try {
      // Fire all selected drafts in parallel
      await Promise.all(
        taskIds.map(id => taskService.updateTask(id, { isDraft: false }))
      );

      // Update local state
      setTasks(prev => prev.map(t => (taskIds.includes(t.id) ? { ...t, isDraft: false } : t)));

      // Clear selection
      setSelectedDrafts(new Set());
    } catch (err) {
      console.error('Failed to fire drafts:', err);
      loadData();
    }
  };

  // Export selection handlers
  const handleToggleExportSelection = (taskId: number) => {
    setSelectedExports(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const handleSelectAllExports = () => {
    setSelectedExports(new Set(filteredTasks.map(t => t.id)));
  };

  const handleDeselectAllExports = () => {
    setSelectedExports(new Set());
  };

  const stripHtml = (html: string): string => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  const handleExportTasks = async () => {
    const tasksToExport = filteredTasks.filter(t => selectedExports.has(t.id));
    if (tasksToExport.length === 0) return;

    const lines: string[] = ['## Tasks', ''];
    tasksToExport.forEach((task, index) => {
      lines.push(`### ${index + 1}. [#${task.id}] ${task.title}`);
      if (task.description) {
        lines.push(stripHtml(task.description));
      }
      lines.push('');
    });

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setExportCopied(true);
      setTimeout(() => setExportCopied(false), 2000);
    } catch {
      console.error('Failed to copy to clipboard');
    }
  };

  const handleIdSearchSubmit = () => {
    const id = parseInt(idSearch, 10);
    if (!isNaN(id) && id > 0) {
      const task = tasks.find(t => t.id === id);
      if (task) {
        setEditingTask(task);
        setShowForm(true);
        setIdSearch('');
      }
    }
  };

  const handleCloseForm = () => {
    setEditingTask(null);
    setShowForm(false);
  };

  const handleOpenTaskById = useCallback((taskId: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setEditingTask(task);
      setShowForm(true);
    }
  }, [tasks]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleBackdropClick}>
      <div className={styles.modal} dir="ltr">
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Task Board</h2>
          <div className={styles.headerRight}>
            <NotificationBell notifications={notificationsState} assignees={assignees} onOpenTask={handleOpenTaskById} />
            <button className={styles.closeBtn} onClick={onClose} title="Close (Esc)">
              ×
            </button>
          </div>
        </div>

        {/* Toolbar - Row 1: Main Controls */}
        <div className={styles.toolbarRow1}>
          <button
            className={styles.addBtn}
            onClick={() => {
              setEditingTask(null);
              setShowForm(true);
            }}
          >
            + Add Task
          </button>

          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${viewMode === 'list' ? styles.active : ''}`}
              onClick={() => { setViewMode('list'); }}
            >
              List
            </button>
            <button
              className={`${styles.viewBtn} ${viewMode === 'board' ? styles.active : ''}`}
              onClick={() => { setViewMode('board'); setSelectedExports(new Set()); }}
            >
              Board
            </button>
          </div>

          <input
            className={styles.idSearch}
            type="text"
            placeholder="#ID"
            value={idSearch}
            onChange={(e) => setIdSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleIdSearchSubmit(); }}
            onClick={(e) => e.stopPropagation()}
          />

          <button
            className={`${styles.draftsBtn} ${showDraftsOnly ? styles.active : ''}`}
            onClick={() => {
              setShowDraftsOnly(!showDraftsOnly);
              setSelectedDrafts(new Set());
              if (!showDraftsOnly) {
                setShowUnassignedOnly(false);
                setFilterAssignee(null);
              }
            }}
            title="Show draft tasks (Ctrl+Shift+L)"
          >
            Drafts
            {draftCount > 0 && (
              <span className={styles.draftBadge}>{draftCount}</span>
            )}
          </button>

          <label
            className={styles.draftDefaultLabel}
            title="When enabled, new tasks are created as drafts by default"
          >
            <input
              type="checkbox"
              checked={draftByDefault}
              onChange={(e) => {
                const newValue = e.target.checked;
                setDraftByDefault(newValue);
                setDraftDefault(newValue);
              }}
            />
            Draft by default
          </label>

          <label className={styles.showCompletedLabel}>
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
            />
            Show Completed
          </label>
        </div>

        {/* Toolbar - Row 2: Domain, Crew & Assignee Filters */}
        <div className={styles.toolbarRow2}>
          <select
            className={styles.domainFilter}
            value={filterDomain}
            onChange={(e) => setFilterDomain(e.target.value)}
          >
            {showAllDomains ? (
              <>
                {KNOWN_DOMAINS.map(domain => (
                  <option key={domain} value={domain}>
                    {domain.charAt(0).toUpperCase() + domain.slice(1)}
                  </option>
                ))}
              </>
            ) : LYBI_DOMAINS.includes(currentDomain) ? (
              <>
                {LYBI_DOMAINS.map(domain => (
                  <option key={domain} value={domain}>
                    {domain.charAt(0).toUpperCase() + domain.slice(1)}
                  </option>
                ))}
              </>
            ) : (
              <option value="current">
                {currentDomain === 'general' ? 'General' : currentDomain.charAt(0).toUpperCase() + currentDomain.slice(1)}
              </option>
            )}
            <option value="general">General (Engine)</option>
            <option value="all">All Domains</option>
          </select>

          {crewMembers.length > 0 && (
            <select
              className={styles.crewFilter}
              value={filterCrewMember || ''}
              onChange={(e) => setFilterCrewMember(e.target.value || null)}
            >
              <option value="">All Crews</option>
              {crewMembers.map(crew => (
                <option key={crew.name} value={crew.name}>
                  {crew.displayName || crew.name}
                </option>
              ))}
            </select>
          )}

          <AssigneeManager
            assignees={assignees}
            onAddAssignee={handleAddAssignee}
            selectedAssignee={filterAssignee}
            onAssigneeClick={(assignee) => {
              setShowUnassignedOnly(false);
              setFilterAssignee(assignee);
            }}
          />
          <button
            className={`${styles.unassignedBtn} ${showUnassignedOnly ? styles.active : ''}`}
            onClick={() => {
              setShowUnassignedOnly(!showUnassignedOnly);
              if (!showUnassignedOnly) {
                setFilterAssignee(null);
              }
            }}
            title="Show unassigned tasks"
          >
            Unassigned
            {unassignedCount > 0 && (
              <span className={styles.unassignedBadge}>{unassignedCount}</span>
            )}
          </button>

          {uniqueOpeners.length > 0 && (
            <div className={styles.openerFilter}>
              <span className={styles.openerFilterLabel}>By:</span>
              <button
                className={`${styles.openerChip} ${filterOpener === null ? styles.openerChipActive : ''}`}
                onClick={() => setFilterOpener(null)}
              >
                All
              </button>
              {uniqueOpeners.map(opener => {
                const color = getAssigneeColor(opener);
                return (
                  <button
                    key={opener}
                    className={`${styles.openerChip} ${filterOpener === opener ? styles.openerChipActive : ''}`}
                    style={{
                      borderColor: filterOpener === opener ? color : undefined,
                      backgroundColor: filterOpener === opener ? `${color}15` : undefined,
                      ['--opener-color' as string]: color,
                    }}
                    onClick={() => setFilterOpener(filterOpener === opener ? null : opener)}
                  >
                    <span className={styles.openerDot} style={{ backgroundColor: color }} />
                    {opener}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Bulk Fire Drafts Toolbar */}
        {showDraftsOnly && filteredTasks.length > 0 && (
          <div className={styles.bulkActions}>
            <div className={styles.bulkInfo}>
              <label className={styles.selectAllLabel}>
                <input
                  type="checkbox"
                  checked={selectedDrafts.size === filteredTasks.length && filteredTasks.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleSelectAllDrafts();
                    } else {
                      handleDeselectAllDrafts();
                    }
                  }}
                />
                Select All ({filteredTasks.length})
              </label>
              {selectedDrafts.size > 0 && (
                <span className={styles.selectedCount}>{selectedDrafts.size} selected</span>
              )}
            </div>
            {selectedDrafts.size > 0 && (
              <button
                className={styles.fireBtn}
                onClick={() => handleFireDrafts(Array.from(selectedDrafts))}
              >
                🔥 Fire {selectedDrafts.size} Draft{selectedDrafts.size > 1 ? 's' : ''}
              </button>
            )}
          </div>
        )}

        {/* Export Bulk Action Bar */}
        {viewMode === 'list' && !showDraftsOnly && filteredTasks.length > 0 && (
          <div className={styles.exportActions}>
            <div className={styles.bulkInfo}>
              <label className={styles.exportSelectAllLabel}>
                <input
                  type="checkbox"
                  checked={selectedExports.size === filteredTasks.length && filteredTasks.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleSelectAllExports();
                    } else {
                      handleDeselectAllExports();
                    }
                  }}
                />
                Select All ({filteredTasks.length})
              </label>
              {selectedExports.size > 0 && (
                <span className={styles.exportSelectedCount}>{selectedExports.size} selected</span>
              )}
            </div>
            {selectedExports.size > 0 && (
              <button
                className={styles.exportBtn}
                onClick={handleExportTasks}
              >
                {exportCopied ? 'Copied!' : `Copy ${selectedExports.size} Task${selectedExports.size > 1 ? 's' : ''} for Claude Code`}
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className={styles.content}>
          {isLoading ? (
            <div className={styles.loading}>Loading...</div>
          ) : (
            <div className={styles.boardArea}>
              {viewMode === 'board' ? (
                <TaskBoard tasks={filteredTasks} allTasks={tasks} crewDisplayNames={crewDisplayNames} onTaskClick={handleTaskClick} onStatusChange={handleStatusChange} onAtRiskToggle={handleAtRiskToggle} onMarkComplete={handleMarkComplete} />
              ) : (
                <TaskList
                  tasks={filteredTasks}
                  crewDisplayNames={crewDisplayNames}
                  onTaskClick={handleTaskClick}
                  onDeleteTask={handleDeleteTask}
                  showDraftCheckboxes={showDraftsOnly}
                  selectedDrafts={selectedDrafts}
                  onToggleDraftSelection={handleToggleDraftSelection}
                  showExportCheckboxes={!showDraftsOnly}
                  selectedExports={selectedExports}
                  onToggleExportSelection={handleToggleExportSelection}
                />
              )}
            </div>
          )}
        </div>

        {/* Form overlay */}
        {showForm && (
          <div className={styles.formOverlay} onClick={handleCloseForm}>
            <div className={`${styles.formContainer} ${editingTask ? styles.formContainerEdit : ''}`} onClick={(e) => e.stopPropagation()}>
              <TaskForm
                task={editingTask}
                assignees={assignees}
                allTasks={tasks}
                currentDomain={currentDomain}
                showAllDomains={showAllDomains}
                crewMembers={crewMembers}
                commentRefreshTrigger={commentRefreshTrigger}
                onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
                onCancel={handleCloseForm}
                onDelete={editingTask ? () => handleDeleteTask(editingTask) : undefined}
              />
            </div>
          </div>
        )}

        {/* Footer hint */}
        <div className={styles.footer}>
          <span className={styles.hint}>Ctrl+Shift+Space toggle • Ctrl+Shift+L drafts • Esc close</span>
        </div>

        {/* Delete confirmation modal */}
        {taskToDelete && (
          <div className={styles.deleteOverlay} onClick={cancelDeleteTask}>
            <div className={styles.deleteModal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.deleteIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </div>
              <h3 className={styles.deleteTitle}>Delete task?</h3>
              <p className={styles.deleteText}>
                "{taskToDelete.title}" will be permanently deleted.
              </p>
              <div className={styles.deleteActions}>
                <button
                  type="button"
                  className={styles.deleteCancelBtn}
                  onClick={cancelDeleteTask}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.deleteConfirmBtn}
                  onClick={confirmDeleteTask}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
