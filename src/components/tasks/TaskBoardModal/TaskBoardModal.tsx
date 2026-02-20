import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Task, Assignee, CreateTaskData, TaskStatus } from '../../../types/task';
import * as taskService from '../../../services/taskService';
import { TaskBoard } from '../TaskBoard/TaskBoard';
import { TaskList } from '../TaskList/TaskList';
import { TaskForm } from '../TaskForm/TaskForm';
import { AssigneeManager } from '../AssigneeManager/AssigneeManager';
import styles from './TaskBoardModal.module.css';

interface TaskBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ViewMode = 'board' | 'list';

// Known domains (agents) in the system
const KNOWN_DOMAINS = ['freeda', 'aspect', 'banking', 'byline'];

// Lybi domains - when on any of these, show all of them in filter
const LYBI_DOMAINS = ['freeda', 'banking'];

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

export function TaskBoardModal({ isOpen, onClose }: TaskBoardModalProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [isLoading, setIsLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showAllDomains, setShowAllDomains] = useState(false);
  const [filterDomain, setFilterDomain] = useState<string>('current');
  const [filterAssignee, setFilterAssignee] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  // Detect current domain when modal opens
  const currentDomain = useMemo(() => (isOpen ? getCurrentDomain() : 'general'), [isOpen]);

  // Filter tasks by domain, assignee, and completed status
  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Filter by completed status first (hide completed by default)
    if (!showCompleted) {
      result = result.filter(t => !t.isCompleted);
    }

    // Filter by assignee
    if (filterAssignee) {
      result = result.filter(t => t.assignee === filterAssignee);
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
  }, [tasks, filterDomain, filterAssignee, currentDomain, showCompleted, showAllDomains]);

  // Ctrl+Shift+A to toggle all domains option
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setShowAllDomains(prev => {
          const newValue = !prev;
          // When enabling, switch to 'all'; when disabling, switch back to 'current'
          setFilterDomain(newValue ? 'all' : 'current');
          return newValue;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tasksData, assigneesData] = await Promise.all([
        taskService.getTasks(),
        taskService.getAssignees(),
      ]);
      setTasks(tasksData);
      setAssignees(assigneesData);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  const handleAddAssignee = async (name: string) => {
    const assignee = await taskService.addAssignee(name);
    setAssignees(prev => [...prev, assignee]);
  };

  const handleCreateTask = async (data: CreateTaskData) => {
    const task = await taskService.createTask(data);
    setTasks(prev => [task, ...prev]);
    setShowForm(false);
  };

  const handleUpdateTask = async (data: CreateTaskData) => {
    if (!editingTask) return;
    const updated = await taskService.updateTask(editingTask.id, data);
    setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)));
    setEditingTask(null);
    setShowForm(false);
  };

  const handleDeleteTask = async (task: Task) => {
    if (!confirm(`Delete "${task.title}"?`)) return;
    await taskService.deleteTask(task.id);
    setTasks(prev => prev.filter(t => t.id !== task.id));
    if (editingTask?.id === task.id) {
      setEditingTask(null);
      setShowForm(false);
    }
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

  const handleCloseForm = () => {
    setEditingTask(null);
    setShowForm(false);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Task Board</h2>
          <button className={styles.closeBtn} onClick={onClose} title="Close (Esc)">
            ×
          </button>
        </div>

        {/* Toolbar */}
        <div className={styles.toolbar}>
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
              onClick={() => setViewMode('list')}
            >
              List
            </button>
            <button
              className={`${styles.viewBtn} ${viewMode === 'board' ? styles.active : ''}`}
              onClick={() => setViewMode('board')}
            >
              Board
            </button>
          </div>

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

          <AssigneeManager
            assignees={assignees}
            onAddAssignee={handleAddAssignee}
            selectedAssignee={filterAssignee}
            onAssigneeClick={setFilterAssignee}
          />

          <label className={styles.showCompletedLabel}>
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
            />
            Show Completed
          </label>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {isLoading ? (
            <div className={styles.loading}>Loading...</div>
          ) : (
            <div className={styles.boardArea}>
              {viewMode === 'board' ? (
                <TaskBoard tasks={filteredTasks} allTasks={tasks} onTaskClick={handleTaskClick} onStatusChange={handleStatusChange} onAtRiskToggle={handleAtRiskToggle} onMarkComplete={handleMarkComplete} />
              ) : (
                <TaskList
                  tasks={filteredTasks}
                  onTaskClick={handleTaskClick}
                  onDeleteTask={handleDeleteTask}
                />
              )}
            </div>
          )}
        </div>

        {/* Form overlay */}
        {showForm && (
          <div className={styles.formOverlay} onClick={handleCloseForm}>
            <div className={styles.formContainer} onClick={(e) => e.stopPropagation()}>
              <TaskForm
                task={editingTask}
                assignees={assignees}
                allTasks={tasks}
                currentDomain={currentDomain}
                showAllDomains={showAllDomains}
                onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
                onCancel={handleCloseForm}
                onDelete={editingTask ? () => handleDeleteTask(editingTask) : undefined}
              />
            </div>
          </div>
        )}

        {/* Footer hint */}
        <div className={styles.footer}>
          <span className={styles.hint}>Ctrl+Shift+Space toggle • Ctrl+Shift+A all domains • Esc close</span>
        </div>
      </div>
    </div>
  );
}
