import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Task, Assignee, CreateTaskData, UpdateTaskData, TaskStatus } from '../../../types/task';
import { useBoardStream } from '../../../hooks/useBoardStream';
import type { BoardEvent } from '../../../hooks/useBoardStream';
import type { CrewMember } from '../../../types/crew';
import * as taskService from '../../../services/taskService';
import { getAgentCrew } from '../../../services/crewService';
import { TaskBoard } from '../TaskBoard/TaskBoard';
import { TaskList } from '../TaskList/TaskList';
import { TaskForm } from '../TaskForm/TaskForm';
import { AssigneeManager } from '../AssigneeManager/AssigneeManager';
import { GoalsSection } from '../GoalsSection/GoalsSection';
import { NotificationBell } from '../NotificationBell/NotificationBell';
import { useNotifications } from '../../../hooks/useNotifications';
import { getUserId } from '../../../utils/userIdentifier';
import styles from './TaskBoardModal.module.css';

export interface TaskBoardContentProps {
  isActive: boolean;
  onClose?: () => void;
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

export function TaskBoardContent({ isActive, onClose, openInDraftsMode, onDraftsModeAcknowledged }: TaskBoardContentProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [sideTask, setSideTask] = useState<Task | null>(null);
  const sideTaskRef = useRef<Task | null>(null);
  sideTaskRef.current = sideTask;
  const [showAllDomains, setShowAllDomains] = useState(false);
  const [filterDomain, setFilterDomain] = useState<string>('current');
  const [filterAssignee, setFilterAssignee] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);
  const [showDraftsOnly, setShowDraftsOnly] = useState(false);
  const [showLimbo, setShowLimbo] = useState(false);
  const [myTasksMode, setMyTasksMode] = useState(false);
  const [selectedDrafts, setSelectedDrafts] = useState<Set<number>>(new Set());
  const [selectedExports, setSelectedExports] = useState<Set<number>>(new Set());
  const [exportCopied, setExportCopied] = useState(false);
  const [idSearch, setIdSearch] = useState('');
  const [titleSearch, setTitleSearch] = useState('');
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [filterCrewMember, setFilterCrewMember] = useState<string | null>(null);
  const [filterOpener, setFilterOpener] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  // Pre-fill form as goal when adding from sidebar
  const [presetGoalMode, setPresetGoalMode] = useState(false);

  // Meeting notes modal (shared so both header and GoalsSection can trigger it)
  const [showMeetingNotes, setShowMeetingNotes] = useState(false);

  // Full-screen goals view
  const [goalsFullScreen, setGoalsFullScreen] = useState(false);

  // Export selection mode (toggled by user)
  const [exportMode, setExportMode] = useState(false);

  // Attention needed filter
  const [filterAttention, setFilterAttention] = useState(false);
  const [attentionTaskIds, setAttentionTaskIds] = useState<Set<number> | null>(null);
  const [attentionLoading, setAttentionLoading] = useState(false);

  // Delete confirmation modal state
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Test task unchecked warning modal
  const [testWarning, setTestWarning] = useState<{ taskId: number; uncheckedCount: number; source: 'status' | 'form' } | null>(null);

  // Manual refresh
  const [isRefreshing, setIsRefreshing] = useState(false);

  // What's New (deployed tasks)
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [whatsNewTasks, setWhatsNewTasks] = useState<Task[]>([]);
  const [whatsNewLoading, setWhatsNewLoading] = useState(false);

  // Get current user ID for draft filtering
  const currentUserId = useMemo(() => getUserId(), []);

  // Notifications: poll every 10s while active, refresh board on new notifications
  const loadDataRef = useRef<() => void>(() => {});
  const notificationsState = useNotifications(isActive, () => loadDataRef.current());

  // Live board updates via SSE
  const [commentRefreshTrigger, setCommentRefreshTrigger] = useState(0);
  const editingTaskRef = useRef<Task | null>(null);
  editingTaskRef.current = editingTask;
  const formDirtyRef = useRef(false);

  // When tasks refresh (SSE), sync editingTask with fresh server data — but only when form is clean
  useEffect(() => {
    if (!editingTask || formDirtyRef.current) return;
    const freshTask = tasks.find(t => t.id === editingTask.id);
    if (freshTask && freshTask !== editingTask) {
      setEditingTask(freshTask);
    }
  }, [tasks, editingTask]);

  useBoardStream(isActive, (event: BoardEvent) => {
    if (event.type === 'task_created' || event.type === 'task_updated') {
      loadData();
    } else if (event.type === 'comment_added') {
      if (editingTaskRef.current?.id === event.taskId) {
        setCommentRefreshTrigger(n => n + 1);
      }
    }
  });

  // Detect current domain when active
  const currentDomain = useMemo(() => (isActive ? getCurrentDomain() : 'general'), [isActive]);

  // Count unassigned tasks (orphans) - not completed, no assignee, not draft
  const unassignedCount = useMemo(() => {
    return tasks.filter(t => !t.assignee && !t.isCompleted && !t.isDraft).length;
  }, [tasks]);

  // Count draft tasks created by current user
  const draftCount = useMemo(() => {
    return tasks.filter(t => t.isDraft && t.createdBy === currentUserId).length;
  }, [tasks, currentUserId]);


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

    // Limbo filter: off = hide Limbo, on = show ONLY Limbo
    if (showLimbo) {
      result = result.filter(t => t.assignee === 'Limbo');
    } else {
      result = result.filter(t => t.assignee !== 'Limbo');
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

    // Filter by priority
    if (filterPriority) {
      result = result.filter(t => t.priority === filterPriority);
    }

    // Filter by type
    if (filterType) {
      result = result.filter(t => t.type === filterType);
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
  }, [tasks, filterDomain, filterAssignee, filterCrewMember, filterOpener, filterPriority, filterType, currentDomain, showCompleted, showLimbo, showAllDomains, showUnassignedOnly, showDraftsOnly, currentUserId]);

  // Split goals and agenda from board tasks — they go to sidebar, rest to kanban/list
  // The goalsMeta sentinel stores the meeting date and is excluded from display
  const goalsMeta = useMemo(() => tasks.find(t => t.type === 'goal' && t.tags.includes('goalsMeta')), [tasks]);
  const agendaMeta = useMemo(() => tasks.find(t => t.type === 'agenda' && t.tags.includes('agendaMeta')), [tasks]);
  // Goals and agenda are unaffected by board filters (assignee, domain, crew, priority, etc.)
  // Only respect completed and draft visibility
  const goals = useMemo(() => {
    let result = tasks.filter(t => t.type === 'goal' && !t.tags.includes('goalsMeta'));
    if (!showCompleted) result = result.filter(t => !t.isCompleted);
    result = result.filter(t => !t.isDraft || t.createdBy === currentUserId);
    return result;
  }, [tasks, showCompleted, currentUserId]);
  const agendaItems = useMemo(() => {
    let result = tasks.filter(t => t.type === 'agenda' && !t.tags.includes('agendaMeta'));
    if (!showCompleted) result = result.filter(t => !t.isCompleted);
    result = result.filter(t => !t.isDraft || t.createdBy === currentUserId);
    return result;
  }, [tasks, showCompleted, currentUserId]);
  const boardTasksAll = useMemo(() => filteredTasks.filter(t => t.type !== 'goal' && t.type !== 'agenda'), [filteredTasks]);
  const boardTasks = useMemo(() => {
    let result = boardTasksAll;
    if (titleSearch.trim()) {
      const q = titleSearch.trim().toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q));
    }
    if (myTasksMode && notificationsState.identity) {
      const me = notificationsState.identity.toLowerCase();
      result = result.filter(t => t.assignee?.toLowerCase() === me);
    }
    return result;
  }, [boardTasksAll, titleSearch, myTasksMode, notificationsState.identity]);

  // Goals: last meeting date + notes
  const meetingDate = useMemo(() => {
    if (!goalsMeta) return null;
    const tag = goalsMeta.tags.find(t => t.startsWith('meetingDate:'));
    return tag ? tag.split(':')[1] : null;
  }, [goalsMeta]);
  const meetingNotes = useMemo(() => goalsMeta?.description || '', [goalsMeta]);

  // Agenda: next meeting date
  const nextMeetingDate = useMemo(() => {
    if (!agendaMeta) return null;
    const tag = agendaMeta.tags.find(t => t.startsWith('meetingDate:'));
    return tag ? tag.split(':')[1] : null;
  }, [agendaMeta]);

  // Handle opening in drafts mode (from Ctrl+Shift+L global shortcut)
  useEffect(() => {
    if (isActive && openInDraftsMode) {
      setShowDraftsOnly(true);
      setViewMode('list'); // Show list view for easier selection
      setShowUnassignedOnly(false);
      setFilterAssignee(null);
      onDraftsModeAcknowledged?.();
    }
  }, [isActive, openInDraftsMode, onDraftsModeAcknowledged]);

  useEffect(() => {
    if (!isActive) return;
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
  }, [isActive]);

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
  loadDataRef.current = loadData;

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
    if (!isActive) {
      setCrewMembers([]);
      return;
    }
    const baseURL = import.meta.env.DEV
      ? 'http://localhost:3000'
      : (import.meta.env.VITE_API_URL || 'https://aspect-server-138665194481.us-central1.run.app');
    const agentName = DOMAIN_TO_AGENT_NAME[crewFetchDomain] || crewFetchDomain;
    getAgentCrew(agentName, baseURL).then(setCrewMembers);
  }, [isActive, crewFetchDomain]);

  useEffect(() => {
    if (isActive) {
      loadData();
    } else {
      // Reset so next open shows the spinner again
      hasLoadedRef.current = false;
    }
  }, [isActive, loadData]);

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
    setPresetGoalMode(false);
    setPresetType(null);
  };

  // Pending form data when test warning is shown
  const pendingFormDataRef = useRef<CreateTaskData | null>(null);

  const handleUpdateTask = async (data: CreateTaskData) => {
    if (!editingTask) return;

    // Warn if test task moved to done with unchecked checkboxes
    if (data.status === 'done' && editingTask.status !== 'done' && data.type === 'test' && data.description) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = data.description;
      const items = tempDiv.querySelectorAll('.checklist-item');
      const unchecked = Array.from(items).filter(item => {
        const state = item.getAttribute('data-state');
        return !state || state === 'unchecked';
      });
      if (unchecked.length > 0) {
        pendingFormDataRef.current = data;
        setTestWarning({ taskId: editingTask.id, uncheckedCount: unchecked.length, source: 'form' });
        return;
      }
    }

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

  // Auto-save: same as update but keeps form open
  // Skips status→done for test tasks with unchecked items (let manual Save handle the warning)
  const handleAutoSave = useCallback(async (data: CreateTaskData) => {
    if (!editingTaskRef.current) return;
    let saveData = { ...data };
    // Don't auto-save status=done for test tasks — defer to manual Save for the warning
    if (saveData.status === 'done' && editingTaskRef.current.status !== 'done' && saveData.type === 'test' && saveData.description) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = saveData.description;
      const items = tempDiv.querySelectorAll('.checklist-item');
      const hasUnchecked = Array.from(items).some(item => {
        const state = item.getAttribute('data-state');
        return !state || state === 'unchecked';
      });
      if (hasUnchecked) {
        // Save everything except the status change
        saveData = { ...saveData, status: editingTaskRef.current.status };
      }
    }
    const taskData = {
      ...saveData,
      createdBy: saveData.isDraft ? (editingTaskRef.current.createdBy || currentUserId) : saveData.createdBy,
      updatedBy: notificationsState.identity || undefined,
    };
    const updated = await taskService.updateTask(editingTaskRef.current.id, taskData);
    setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)));
  }, [currentUserId, notificationsState.identity]);

  const handleUpdateSideTask = async (data: CreateTaskData) => {
    if (!sideTaskRef.current) return;
    const updated = await taskService.updateTask(sideTaskRef.current.id, data);
    setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)));
    setSideTask(null);
  };

  const handleAutoSaveSideTask = useCallback(async (data: CreateTaskData) => {
    if (!sideTaskRef.current) return;
    const updated = await taskService.updateTask(sideTaskRef.current.id, data);
    setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)));
    setSideTask(updated);
  }, []);

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

  const handleTaskClick = async (task: Task) => {
    // Show immediately with local data, then refetch from server
    setEditingTask(task);
    setShowForm(true);
    try {
      const fresh = await taskService.getTask(task.id);
      setEditingTask(fresh);
      setTasks(prev => prev.map(t => (t.id === fresh.id ? fresh : t)));
    } catch {
      // Keep local version if fetch fails
    }
  };

  const handleStatusChange = async (taskId: number, newStatus: TaskStatus) => {
    // Warn if test task moved to done with unchecked checkboxes
    if (newStatus === 'done') {
      const task = tasks.find(t => t.id === taskId);
      if (task?.type === 'test' && task.description) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = task.description;
        const items = tempDiv.querySelectorAll('.checklist-item');
        const unchecked = Array.from(items).filter(item => {
          const state = item.getAttribute('data-state');
          return !state || state === 'unchecked';
        });
        if (unchecked.length > 0) {
          setTestWarning({ taskId, uncheckedCount: unchecked.length, source: 'status' });
          return;
        }
      }
    }

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

  const stripHtml = (html: string): string => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  const handleExportTasks = async () => {
    const tasksToExport = boardTasks.filter(t => selectedExports.has(t.id));
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

  const handleCloseForm = async () => {
    setEditingTask(null);
    setShowForm(false);
    setSideTask(null);
    setPresetGoalMode(false);
    setPresetType(null);
    // Re-fetch attention list if filter is active (user may have liked/replied)
    if (filterAttention && notificationsState.identity) {
      const ids = await taskService.getNeedsAttention(notificationsState.identity);
      setAttentionTaskIds(new Set(ids));
    }
  };

  const handleOpenTaskById = useCallback((taskId: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setEditingTask(task);
      setShowForm(true);
    }
  }, [tasks]);

  const handleMeetingDateChange = async (newDate: string) => {
    if (goalsMeta) {
      // Update existing sentinel
      const filteredTags = goalsMeta.tags.filter(t => !t.startsWith('meetingDate:'));
      const newTags = newDate ? [...filteredTags, `meetingDate:${newDate}`] : filteredTags;
      const updated = await taskService.updateTask(goalsMeta.id, { tags: newTags });
      setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)));
    } else if (newDate) {
      // Create sentinel task to hold meeting date
      const sentinel = await taskService.createTask({
        title: 'Goals Meeting Date',
        type: 'goal',
        tags: ['goalsMeta', `meetingDate:${newDate}`],
        domain: 'general',
        status: 'todo',
      });
      setTasks(prev => [sentinel, ...prev]);
    }
  };

  const handleNextMeetingDateChange = async (newDate: string) => {
    if (agendaMeta) {
      const filteredTags = agendaMeta.tags.filter(t => !t.startsWith('meetingDate:'));
      const newTags = newDate ? [...filteredTags, `meetingDate:${newDate}`] : filteredTags;
      const updated = await taskService.updateTask(agendaMeta.id, { tags: newTags });
      setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)));
    } else if (newDate) {
      const sentinel = await taskService.createTask({
        title: 'Agenda Meeting Date',
        type: 'agenda',
        tags: ['agendaMeta', `meetingDate:${newDate}`],
        domain: 'general',
        status: 'todo',
      });
      setTasks(prev => [sentinel, ...prev]);
    }
  };

  const handleMeetingNotesChange = async (notes: string) => {
    if (goalsMeta) {
      const updated = await taskService.updateTask(goalsMeta.id, { description: notes || undefined });
      setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)));
    } else if (notes) {
      // Create sentinel if it doesn't exist yet
      const sentinel = await taskService.createTask({
        title: 'Goals Meeting Date',
        type: 'goal',
        tags: ['goalsMeta'],
        domain: 'general',
        status: 'todo',
        description: notes,
      });
      setTasks(prev => [sentinel, ...prev]);
    }
  };

  const [presetType, setPresetType] = useState<'goal' | 'agenda' | null>(null);

  const handleAddGoal = () => {
    setEditingTask(null);
    setPresetType('goal');
    setPresetGoalMode(true);
    setShowForm(true);
  };

  const handleAddAgenda = () => {
    setEditingTask(null);
    setPresetType('agenda');
    setPresetGoalMode(true);
    setShowForm(true);
  };

  const handleUpdateGoal = async (id: number, updates: UpdateTaskData) => {
    const updated = await taskService.updateTask(id, updates);
    setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)));
  };

  const handleDeploy = async () => {
    if (!editingTask) return;
    const updated = await taskService.markDeployed(editingTask.id, notificationsState.identity || undefined);
    setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)));
    setEditingTask(updated);
  };

  const handleUndeploy = async () => {
    if (!editingTask) return;
    const updated = await taskService.updateTask(editingTask.id, { deployedAt: null, deployedReviewedBy: [] } as any);
    setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)));
    setEditingTask(updated);
  };

  const handleLoadWhatsNew = async () => {
    if (!notificationsState.identity) return;
    setWhatsNewLoading(true);
    try {
      const newTasks = await taskService.getWhatsNew(notificationsState.identity);
      setWhatsNewTasks(newTasks);
      setShowWhatsNew(true);
    } finally {
      setWhatsNewLoading(false);
    }
  };

  const handleDismissDeployed = async (taskId: number) => {
    if (!notificationsState.identity) return;
    setWhatsNewTasks(prev => prev.filter(t => t.id !== taskId));
    notificationsState.decrementWhatsNew();
    await taskService.dismissDeployed(taskId, notificationsState.identity);
  };

  return (
    <>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>
          {goalsFullScreen ? '🎯 Goals & Priorities' : '📋 Task Board'}
          <button
            className={`${styles.refreshBtn} ${isRefreshing ? styles.refreshSpin : ''}`}
            onClick={async () => { setIsRefreshing(true); await loadData(); setIsRefreshing(false); }}
            disabled={isRefreshing}
            title="Refresh tasks"
          >↻</button>
        </h2>
        {goalsFullScreen ? (
          <div className={styles.headerRight}>
            <div className={styles.goalsHeaderControls}>
              <label className={styles.showCompletedLabel}>
                <input
                  type="checkbox"
                  checked={showCompleted}
                  onChange={(e) => setShowCompleted(e.target.checked)}
                />
                Show Completed
              </label>
              <button
                className={styles.goalsBackBtn}
                onClick={() => setGoalsFullScreen(false)}
              >
                ← Board
              </button>
            </div>
            {onClose && (
              <button className={styles.closeBtn} onClick={onClose} title="Close (Esc)">
                ×
              </button>
            )}
          </div>
        ) : (
          <div className={styles.headerRight}>
            <button
              className={`${styles.whatsNewBtn} ${(notificationsState.whatsNewCount > 0 || whatsNewTasks.length > 0) ? styles.whatsNewActive : ''}`}
              onClick={showWhatsNew ? () => setShowWhatsNew(false) : handleLoadWhatsNew}
              disabled={whatsNewLoading}
              title="Recently deployed features"
            >
              {whatsNewLoading ? '⏳' : '🚀'} What's New{(showWhatsNew ? whatsNewTasks.length : notificationsState.whatsNewCount) > 0 ? ` (${showWhatsNew ? whatsNewTasks.length : notificationsState.whatsNewCount})` : ''}
            </button>
            <NotificationBell notifications={notificationsState} assignees={assignees} onOpenTask={handleOpenTaskById} />
            {onClose && (
              <button className={styles.closeBtn} onClick={onClose} title="Close (Esc)">
                ×
              </button>
            )}
          </div>
        )}
      </div>

      {/* Full-screen goals mode — takes over entire content */}
      {goalsFullScreen && (
        <div className={styles.fullScreenGoals}>
          <GoalsSection
            goals={agendaItems}
            allTasks={tasks}
            tint="rgba(99, 102, 241, 0.03)"
            headerTint="rgba(99, 102, 241, 0.07)"
            isFullScreen
            title="Agenda"
            emoji="📋"
            showOpener
            meetingDate={nextMeetingDate}
            meetingDateLabel="Next meeting:"
            onGoalClick={handleTaskClick}
            onDeleteGoal={handleDeleteTask}
            onAddGoal={handleAddAgenda}
            onUpdateGoal={handleUpdateGoal}
            onLinkedTaskClick={handleTaskClick}
            onMeetingDateChange={handleNextMeetingDateChange}
          />
          <GoalsSection
            goals={goals}
            allTasks={tasks}
            tint="rgba(245, 158, 11, 0.03)"
            headerTint="rgba(245, 158, 11, 0.07)"
            isFullScreen
            meetingDate={meetingDate}
            meetingDateLabel="Last meeting:"
            meetingNotes={meetingNotes}
            showNotesModal={showMeetingNotes}
            onShowNotesModal={setShowMeetingNotes}
            onGoalClick={handleTaskClick}
            onDeleteGoal={handleDeleteTask}
            onAddGoal={handleAddGoal}
            onUpdateGoal={handleUpdateGoal}
            onLinkedTaskClick={handleTaskClick}
            onMeetingDateChange={handleMeetingDateChange}
            onMeetingNotesChange={handleMeetingNotesChange}
          />
        </div>
      )}

      {!goalsFullScreen && <>
      {/* Toolbar - Row 1: Actions + Search */}
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
            className={`${styles.viewBtn} ${viewMode === 'list' && !myTasksMode ? styles.active : ''}`}
            onClick={() => { setViewMode('list'); setMyTasksMode(false); }}
          >
            List
          </button>
          <button
            className={`${styles.viewBtn} ${viewMode === 'board' ? styles.active : ''}`}
            onClick={() => { setViewMode('board'); setSelectedExports(new Set()); setExportMode(false); setMyTasksMode(false); }}
          >
            Board
          </button>
          <button
            className={`${styles.viewBtn} ${myTasksMode ? styles.active : ''}`}
            onClick={() => { setViewMode('list'); setMyTasksMode(!myTasksMode); }}
          >
            My Tasks
          </button>
        </div>

        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <input
            className={`${styles.titleSearch} ${titleSearch.trim() ? styles.titleSearchActive : ''}`}
            type="text"
            placeholder="Search..."
            value={titleSearch}
            onChange={(e) => setTitleSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          {titleSearch.trim() && (
            <button
              className={styles.titleSearchClear}
              onClick={() => setTitleSearch('')}
              title="Clear search"
            >
              ×
            </button>
          )}
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
      </div>

      {/* Toolbar - Row 2: Board filters + toggle buttons */}
      <div className={styles.toolbarRow2}>
        {viewMode === 'board' && (
          <>
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
              showUnassigned
              unassignedCount={unassignedCount}
              showUnassignedOnly={showUnassignedOnly}
              onAssigneeClick={(assignee) => {
                setShowUnassignedOnly(false);
                setFilterAssignee(assignee);
              }}
              onUnassignedClick={() => {
                setShowUnassignedOnly(!showUnassignedOnly);
                if (!showUnassignedOnly) setFilterAssignee(null);
              }}
            />

            <select
              className={styles.crewFilter}
              value={filterPriority || ''}
              onChange={(e) => setFilterPriority(e.target.value || null)}
            >
              <option value="">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              className={styles.crewFilter}
              value={filterType || ''}
              onChange={(e) => setFilterType(e.target.value || null)}
            >
              <option value="">All Types</option>
              <option value="task">Task</option>
              <option value="feature">Feature</option>
              <option value="bug">Bug</option>
              <option value="idea">Idea</option>
            </select>

            {assignees.length > 0 && (
              <select
                className={styles.crewFilter}
                value={filterOpener || ''}
                onChange={(e) => setFilterOpener(e.target.value || null)}
              >
                <option value="">By Creator</option>
                {assignees.map(a => (
                  <option key={a.id} value={a.name}>{a.name}</option>
                ))}
              </select>
            )}
          </>
        )}

        {viewMode === 'list' && !showDraftsOnly && (
          <>
            <button
              className={`${styles.selectToggleBtn} ${exportMode ? styles.selectActive : ''}`}
              onClick={() => {
                setExportMode(!exportMode);
                if (exportMode) setSelectedExports(new Set());
              }}
            >
              {exportMode ? '✓ Select' : 'Select'}
            </button>
            <button
              className={`${styles.selectToggleBtn} ${filterAttention ? styles.selectActive : ''}`}
              disabled={attentionLoading}
              onClick={async () => {
                if (filterAttention) {
                  setFilterAttention(false);
                  setAttentionTaskIds(null);
                } else if (notificationsState.identity) {
                  setAttentionLoading(true);
                  try {
                    const ids = await taskService.getNeedsAttention(notificationsState.identity);
                    setAttentionTaskIds(new Set(ids));
                    setFilterAttention(true);
                  } finally {
                    setAttentionLoading(false);
                  }
                }
              }}
              title="Tasks where you were mentioned in the last comment and haven't replied"
            >
              {attentionLoading ? '⏳...' : filterAttention && attentionTaskIds ? `🔔 Attention (${attentionTaskIds.size})` : '🔔 Needs my attention'}
            </button>
            {filterAttention && attentionTaskIds && attentionTaskIds.size > 0 && boardTasks.filter(t => attentionTaskIds.has(t.id)).length === 0 && (
              <span className={styles.attentionHint}>All in completed</span>
            )}
          </>
        )}

        <div className={styles.toggleGroup}>
          <button
            className={`${styles.filterToggleBtn} ${showDraftsOnly ? styles.filterToggleActive : ''}`}
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
            Drafts{draftCount > 0 ? ` (${draftCount})` : ''}
          </button>

          <button
            className={`${styles.filterToggleBtn} ${showCompleted ? styles.filterToggleActive : ''}`}
            onClick={() => setShowCompleted(!showCompleted)}
          >
            Completed
          </button>

          <button
            className={`${styles.filterToggleBtn} ${showLimbo ? styles.filterToggleActive : ''}`}
            onClick={() => setShowLimbo(!showLimbo)}
          >
            💀 Limbo
          </button>
        </div>
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

      {/* Export Action Bar — only when items are selected */}
      {viewMode === 'list' && exportMode && selectedExports.size > 0 && (
        <div className={styles.exportActions}>
          <span className={styles.exportSelectedCount}>{selectedExports.size} selected</span>
          <button className={styles.exportBtn} onClick={handleExportTasks}>
            {exportCopied ? 'Copied!' : `Copy ${selectedExports.size} for Claude Code`}
          </button>
        </div>
      )}

      {/* Content with Goals Sidebar */}
      <div className={styles.contentWithSidebar}>
        <div className={styles.content}>
          {isLoading ? (
            <div className={styles.loading}>Loading...</div>
          ) : (
            <div className={styles.boardArea}>
              {viewMode === 'board' ? (
                <TaskBoard tasks={boardTasks} allTasks={tasks} crewDisplayNames={crewDisplayNames} onTaskClick={handleTaskClick} onStatusChange={handleStatusChange} onAtRiskToggle={handleAtRiskToggle} onMarkComplete={handleMarkComplete} />
              ) : (
                <TaskList
                  tasks={filterAttention && attentionTaskIds ? boardTasks.filter(t => attentionTaskIds.has(t.id)) : boardTasks}
                  crewDisplayNames={crewDisplayNames}
                  onTaskClick={handleTaskClick}
                  onDeleteTask={handleDeleteTask}
                  showDraftCheckboxes={showDraftsOnly}
                  selectedDrafts={selectedDrafts}
                  onToggleDraftSelection={handleToggleDraftSelection}
                  showExportCheckboxes={exportMode && !showDraftsOnly}
                  selectedExports={selectedExports}
                  onToggleExportSelection={handleToggleExportSelection}
                />
              )}
            </div>
          )}
        </div>
        <div className={styles.sidebarColumn}>
          <GoalsSection
            goals={goals}
            allTasks={tasks}
            tint="rgba(245, 158, 11, 0.03)"
            headerTint="rgba(245, 158, 11, 0.07)"
            meetingDate={meetingDate}
            meetingNotes={meetingNotes}
            onGoalClick={handleTaskClick}
            onDeleteGoal={handleDeleteTask}
            onAddGoal={handleAddGoal}
            onUpdateGoal={handleUpdateGoal}
            onLinkedTaskClick={handleTaskClick}
            onToggleFullScreen={() => setGoalsFullScreen(true)}
            onMeetingDateChange={handleMeetingDateChange}
            onMeetingNotesChange={handleMeetingNotesChange}
          />
          <GoalsSection
            goals={agendaItems}
            allTasks={tasks}
            tint="rgba(99, 102, 241, 0.03)"
            headerTint="rgba(99, 102, 241, 0.07)"
            title="Agenda"
            emoji="📋"
            showOpener
            meetingDate={nextMeetingDate}
            meetingDateLabel="Next meeting:"
            onGoalClick={handleTaskClick}
            onDeleteGoal={handleDeleteTask}
            onAddGoal={handleAddAgenda}
            onUpdateGoal={handleUpdateGoal}
            onLinkedTaskClick={handleTaskClick}
            onMeetingDateChange={handleNextMeetingDateChange}
          />
        </div>
      </div>
      </>}

      {/* Form overlay */}
      {showForm && (
        <div className={`${styles.formOverlay} ${sideTask ? styles.formOverlayWithSide : ''}`} onClick={handleCloseForm}>
          <div className={`${styles.formContainer} ${editingTask ? styles.formContainerEdit : ''}`} onClick={(e) => e.stopPropagation()}>
            <TaskForm
              task={editingTask}
              assignees={assignees}
              allTasks={tasks}
              currentDomain={currentDomain}
              showAllDomains={showAllDomains}
              crewMembers={crewMembers}
              commentRefreshTrigger={commentRefreshTrigger}
              initialType={presetGoalMode ? (presetType || 'goal') : undefined}
              currentIdentity={notificationsState.identity || undefined}
              onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
              onAutoSave={editingTask ? handleAutoSave : undefined}
              onDirtyChange={(dirty) => { formDirtyRef.current = dirty; }}
              onMarkRead={(editingTask?.type === 'read' || editingTask?.type === 'test') ? async () => {
                const isRead = editingTask.isCompleted;
                const newStatus = isRead ? 'todo' : 'done';
                const newCompleted = !isRead;
                await taskService.updateTask(editingTask.id, { status: newStatus, isCompleted: newCompleted });
                setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, status: newStatus as Task['status'], isCompleted: newCompleted } : t));
                handleCloseForm();
              } : undefined}
              onLinkedTaskClick={(linkedTask) => {
                setSideTask(linkedTask);
                taskService.getTask(linkedTask.id).then(fresh => { if (fresh) setSideTask(fresh); }).catch(() => {});
              }}
              onDeploy={editingTask?.status === 'done' && !editingTask?.deployedAt ? handleDeploy : undefined}
              onUndeploy={editingTask?.deployedAt ? handleUndeploy : undefined}
              onCancel={handleCloseForm}
              onDelete={editingTask ? () => handleDeleteTask(editingTask) : undefined}
            />
          </div>
          {sideTask && (
            <div className={styles.sideTaskContainer} onClick={(e) => e.stopPropagation()}>
              <button className={styles.closeSideBtn} onClick={() => setSideTask(null)} title="Close">×</button>
              <TaskForm
                task={sideTask}
                assignees={assignees}
                allTasks={tasks}
                currentDomain={currentDomain}
                showAllDomains={showAllDomains}
                crewMembers={crewMembers}
                commentRefreshTrigger={commentRefreshTrigger}
                currentIdentity={notificationsState.identity || undefined}
                onSubmit={handleUpdateSideTask}
                onAutoSave={handleAutoSaveSideTask}
                onDirtyChange={() => {}}
                onLinkedTaskClick={(linkedTask) => {
                  setSideTask(linkedTask);
                  taskService.getTask(linkedTask.id).then(fresh => { if (fresh) setSideTask(fresh); }).catch(() => {});
                }}
                onCancel={() => setSideTask(null)}
              />
            </div>
          )}
        </div>
      )}

      {/* Footer hint */}
      {!goalsFullScreen && onClose && (
        <div className={styles.footer}>
          <span className={styles.hint}>Ctrl+Shift+Space toggle • Ctrl+Shift+L drafts • Esc close</span>
        </div>
      )}

      {/* What's New panel */}
      {showWhatsNew && (
        <div className={styles.whatsNewOverlay} onClick={() => setShowWhatsNew(false)}>
          <div className={styles.whatsNewPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.whatsNewHeader}>
              <h3>🚀 What's New</h3>
              <button className={styles.closeBtn} onClick={() => setShowWhatsNew(false)}>×</button>
            </div>
            {whatsNewTasks.length === 0 ? (
              <div className={styles.whatsNewEmpty}>No new deployments</div>
            ) : (
              <div className={styles.whatsNewList}>
                {whatsNewTasks.map(task => (
                  <div key={task.id} className={styles.whatsNewItem}>
                    <div className={styles.whatsNewItemContent} onClick={() => { setShowWhatsNew(false); handleTaskClick(task); }}>
                      <span className={styles.whatsNewTitle}>#{task.id} {task.title}</span>
                      <span className={styles.whatsNewTime}>
                        {task.deployedAt ? new Date(task.deployedAt).toLocaleDateString() : ''}
                      </span>
                    </div>
                    <button
                      className={styles.whatsNewDismiss}
                      onClick={() => handleDismissDeployed(task.id)}
                      title="Dismiss"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* Test task unchecked warning modal */}
      {testWarning && (
        <div className={styles.deleteOverlay} onClick={() => setTestWarning(null)}>
          <div className={styles.deleteModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.deleteIcon} style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3 className={styles.deleteTitle}>Unchecked test steps</h3>
            <p className={styles.deleteText}>
              {testWarning.uncheckedCount} test step{testWarning.uncheckedCount > 1 ? 's are' : ' is'} not tested yet. Move to Done anyway?
            </p>
            <div className={styles.deleteActions}>
              <button
                type="button"
                className={styles.deleteCancelBtn}
                onClick={() => setTestWarning(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.deleteConfirmBtn}
                style={{ background: '#f59e0b' }}
                onClick={async () => {
                  const { taskId, source } = testWarning;
                  setTestWarning(null);
                  if (source === 'form' && pendingFormDataRef.current && editingTask) {
                    const data = pendingFormDataRef.current;
                    pendingFormDataRef.current = null;
                    const taskData = {
                      ...data,
                      createdBy: data.isDraft ? (editingTask.createdBy || currentUserId) : data.createdBy,
                      updatedBy: notificationsState.identity || undefined,
                    };
                    const updated = await taskService.updateTask(editingTask.id, taskData);
                    setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)));
                    setEditingTask(null);
                    setShowForm(false);
                  } else {
                    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, status: 'done' as const } : t)));
                    try {
                      await taskService.updateTask(taskId, { status: 'done' });
                    } catch {
                      loadData();
                    }
                  }
                }}
              >
                Move to Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
