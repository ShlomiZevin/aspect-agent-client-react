import { useCallback, useState } from 'react';
import { TaskCard } from '../TaskCard';
import type { Task, TaskStatus } from '../../types';
import styles from './TaskColumns.module.css';

/**
 * The three status columns, with drag between them.
 *
 * Markup and stylesheet are the original board's, unchanged. That includes the
 * dependency warning: dragging a blocked task into In Progress or Done asks
 * before it moves, rather than moving it and leaving the blockage to be noticed
 * later.
 */
interface Props {
  tasks: Task[];
  /** Every task, so a dependency can be resolved even when filtered out. */
  allTasks: Task[];
  onTaskClick: (task: Task) => void;
  onStatusChange?: (taskId: number, newStatus: TaskStatus) => void;
  onAtRiskToggle?: (taskId: number, atRisk: boolean) => void;
  onMarkComplete?: (taskId: number, acknowledged: boolean) => void;
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

export function TaskColumns({
  tasks, allTasks, onTaskClick, onStatusChange, onAtRiskToggle, onMarkComplete,
}: Props) {
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);

  const byStatus = (status: TaskStatus) => tasks.filter(t => t.status === status);

  const checkDependency = useCallback((task: Task): { satisfied: boolean; dependentTask?: Task } => {
    if (!task.dependsOn) return { satisfied: true };
    const dependentTask = allTasks.find(t => t.id === task.dependsOn);
    // A dependency that no longer exists blocks nothing.
    if (!dependentTask) return { satisfied: true };
    return { satisfied: dependentTask.status === 'done', dependentTask };
  }, [allTasks]);

  const dependencyInfo = useCallback((task: Task) => {
    if (!task.dependsOn) return undefined;
    const { satisfied, dependentTask } = checkDependency(task);
    if (!dependentTask) return undefined;
    return { name: dependentTask.title, satisfied };
  }, [checkDependency]);

  const handleDrop = (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverStatus(null);

    const taskId = parseInt(e.dataTransfer.getData('text/plain'), 10);
    const task = tasks.find(t => t.id === taskId);

    if (task && task.status !== newStatus && onStatusChange) {
      if (newStatus === 'in_progress' || newStatus === 'done') {
        const { satisfied, dependentTask } = checkDependency(task);
        if (!satisfied && dependentTask) {
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

  return (
    <div className={styles.boardWrapper}>
      <div className={styles.board}>
        {COLUMNS.map(column => (
          <div
            key={column.status}
            className={`${styles.column} ${dragOverStatus === column.status ? styles.dragOver : ''}`}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverStatus(column.status); }}
            onDragLeave={() => setDragOverStatus(null)}
            onDrop={e => handleDrop(e, column.status)}
          >
            <div className={styles.columnHeader}>
              <span className={styles.columnTitle}>{column.label}</span>
              <span className={styles.columnCount}>{byStatus(column.status).length}</span>
            </div>
            <div className={styles.columnContent}>
              {byStatus(column.status).map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={e => {
                    setDraggedTaskId(task.id);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(task.id));
                  }}
                  onDragEnd={() => { setDraggedTaskId(null); setDragOverStatus(null); }}
                  className={`${styles.draggableCard} ${draggedTaskId === task.id ? styles.dragging : ''}`}
                >
                  <TaskCard
                    task={task}
                    dependencyInfo={dependencyInfo(task)}
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

      {pendingMove && (
        <div className={styles.warningOverlay} onClick={() => setPendingMove(null)}>
          <div className={styles.warningModal} onClick={e => e.stopPropagation()}>
            <div className={styles.warningIcon}>⚠️</div>
            <h3 className={styles.warningTitle}>Dependency Warning</h3>
            <p className={styles.warningText}>
              <strong>&quot;{pendingMove.taskTitle}&quot;</strong> depends on{' '}
              <strong>&quot;{pendingMove.dependentTaskTitle}&quot;</strong> which is not done yet.
            </p>
            <p className={styles.warningQuestion}>
              Move to {pendingMove.newStatus === 'in_progress' ? 'In Progress' : 'Done'} anyway?
            </p>
            <div className={styles.warningActions}>
              <button className={styles.cancelBtn} onClick={() => setPendingMove(null)}>Cancel</button>
              <button
                className={styles.proceedBtn}
                onClick={() => {
                  if (onStatusChange) onStatusChange(pendingMove.taskId, pendingMove.newStatus);
                  setPendingMove(null);
                }}
              >
                Move Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
