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

  // Detect current domain when modal opens
  const currentDomain = useMemo(() => (isOpen ? getCurrentDomain() : 'general'), [isOpen]);

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

          <AssigneeManager assignees={assignees} onAddAssignee={handleAddAssignee} />
        </div>

        {/* Content */}
        <div className={`${styles.content} ${showForm ? styles.contentWithPanel : ''}`}>
          {isLoading ? (
            <div className={styles.loading}>Loading...</div>
          ) : (
            <>
              {/* Main board/list area */}
              <div className={styles.boardArea}>
                {viewMode === 'board' ? (
                  <TaskBoard tasks={tasks} onTaskClick={handleTaskClick} onStatusChange={handleStatusChange} />
                ) : (
                  <TaskList
                    tasks={tasks}
                    onTaskClick={handleTaskClick}
                    onDeleteTask={handleDeleteTask}
                  />
                )}
              </div>

              {/* Side panel for form */}
              {showForm && (
                <div className={styles.formPanel}>
                  <TaskForm
                    task={editingTask}
                    assignees={assignees}
                    currentDomain={currentDomain}
                    onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
                    onCancel={handleCloseForm}
                    onDelete={editingTask ? () => handleDeleteTask(editingTask) : undefined}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className={styles.footer}>
          <span className={styles.hint}>Press Ctrl+Shift+Space to toggle • Esc to close</span>
        </div>
      </div>
    </div>
  );
}
