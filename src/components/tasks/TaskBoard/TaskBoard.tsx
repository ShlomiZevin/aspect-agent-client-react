import { useState } from 'react';
import type { Task, TaskStatus } from '../../../types/task';
import { TaskCard } from '../TaskCard/TaskCard';
import styles from './TaskBoard.module.css';

interface TaskBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onStatusChange?: (taskId: number, newStatus: TaskStatus) => void;
  onAtRiskToggle?: (taskId: number, atRisk: boolean) => void;
}

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'TODO' },
  { status: 'in_progress', label: 'IN PROGRESS' },
  { status: 'done', label: 'DONE' },
];

export function TaskBoard({ tasks, onTaskClick, onStatusChange, onAtRiskToggle }: TaskBoardProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);

  const getTasksByStatus = (status: TaskStatus) =>
    tasks.filter(task => task.status === status);

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
      onStatusChange(taskId, newStatus);
    }

    setDraggedTaskId(null);
  };

  return (
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
                  onClick={() => onTaskClick(task)}
                  onAtRiskToggle={onAtRiskToggle}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
