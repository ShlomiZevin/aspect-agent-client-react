import { useState, useCallback } from 'react';
import type { Task, TaskStatus } from '../../../types/task';
import { TaskCard } from '../TaskCard/TaskCard';
import styles from './TaskBoard.module.css';

interface TaskBoardProps {
  tasks: Task[];
  allTasks: Task[]; // All tasks for dependency checking
  crewDisplayNames?: Record<string, string>;
  onTaskClick: (task: Task) => void;
  onStatusChange?: (taskId: number, newStatus: TaskStatus) => void;
  onAtRiskToggle?: (taskId: number, atRisk: boolean) => void;
  onMarkComplete?: (taskId: number, isCompleted: boolean) => void;
}

interface PendingMove {
  taskId: number;
  taskTitle: string;
  dependentTaskTitle: string;
  newStatus: TaskStatus;
}

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'TODO' },
  { status: 'in_progress', label: 'IN PROGRESS' },
  { status: 'done', label: 'DONE' },
];

export function TaskBoard({ tasks, allTasks, crewDisplayNames, onTaskClick, onStatusChange, onAtRiskToggle, onMarkComplete }: TaskBoardProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);

  const getTasksByStatus = (status: TaskStatus) =>
    tasks.filter(task => task.status === status);

  // Check if a task's dependency is satisfied (dependency task is done)
  const checkDependency = useCallback((task: Task): { satisfied: boolean; dependentTask?: Task } => {
    if (!task.dependsOn) {
      return { satisfied: true };
    }
    const dependentTask = allTasks.find(t => t.id === task.dependsOn);
    if (!dependentTask) {
      return { satisfied: true }; // Dependency was deleted, allow it
    }
    return {
      satisfied: dependentTask.status === 'done',
      dependentTask,
    };
  }, [allTasks]);

  // Get dependency info for display on TaskCard
  const getDependencyInfo = useCallback((task: Task): { name: string; satisfied: boolean } | undefined => {
    if (!task.dependsOn) return undefined;
    const { satisfied, dependentTask } = checkDependency(task);
    if (!dependentTask) return undefined;
    return { name: dependentTask.title, satisfied };
  }, [checkDependency]);

  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId.toString());
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverStatus(null);
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  };

  const handleDragLeave = () => {
    setDragOverStatus(null);
  };

  const handleDrop = (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverStatus(null);

    const taskId = parseInt(e.dataTransfer.getData('text/plain'), 10);
    const task = tasks.find(t => t.id === taskId);

    if (task && task.status !== newStatus && onStatusChange) {
      // Check dependency when moving to in_progress or done
      if (newStatus === 'in_progress' || newStatus === 'done') {
        const { satisfied, dependentTask } = checkDependency(task);
        if (!satisfied && dependentTask) {
          // Show custom warning modal
          setPendingMove({
            taskId,
            taskTitle: task.title,
            dependentTaskTitle: dependentTask.title,
            newStatus,
          });
          setDraggedTaskId(null);
          return;
        }
      }
      onStatusChange(taskId, newStatus);
    }

    setDraggedTaskId(null);
  };

  const handleConfirmMove = () => {
    if (pendingMove && onStatusChange) {
      onStatusChange(pendingMove.taskId, pendingMove.newStatus);
    }
    setPendingMove(null);
  };

  const handleCancelMove = () => {
    setPendingMove(null);
  };

  return (
    <div className={styles.boardWrapper}>
      <div className={styles.board}>
        {COLUMNS.map(column => (
          <div
            key={column.status}
            className={`${styles.column} ${dragOverStatus === column.status ? styles.dragOver : ''}`}
            onDragOver={(e) => handleDragOver(e, column.status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.status)}
          >
            <div className={styles.columnHeader}>
              <span className={styles.columnTitle}>{column.label}</span>
              <span className={styles.columnCount}>
                {getTasksByStatus(column.status).length}
              </span>
            </div>
            <div className={styles.columnContent}>
              {getTasksByStatus(column.status).map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnd={handleDragEnd}
                  className={`${styles.draggableCard} ${draggedTaskId === task.id ? styles.dragging : ''}`}
                >
                  <TaskCard
                    task={task}
                    dependencyInfo={getDependencyInfo(task)}
                    crewDisplayNames={crewDisplayNames}
                    onClick={() => onTaskClick(task)}
                    onAtRiskToggle={onAtRiskToggle}
                    onMarkComplete={onMarkComplete}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Dependency Warning Modal */}
      {pendingMove && (
        <div className={styles.warningOverlay} onClick={handleCancelMove}>
          <div className={styles.warningModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.warningIcon}>⚠️</div>
            <h3 className={styles.warningTitle}>Dependency Warning</h3>
            <p className={styles.warningText}>
              <strong>"{pendingMove.taskTitle}"</strong> depends on{' '}
              <strong>"{pendingMove.dependentTaskTitle}"</strong> which is not done yet.
            </p>
            <p className={styles.warningQuestion}>
              Move to {pendingMove.newStatus === 'in_progress' ? 'In Progress' : 'Done'} anyway?
            </p>
            <div className={styles.warningActions}>
              <button className={styles.cancelBtn} onClick={handleCancelMove}>
                Cancel
              </button>
              <button className={styles.proceedBtn} onClick={handleConfirmMove}>
                Move Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
