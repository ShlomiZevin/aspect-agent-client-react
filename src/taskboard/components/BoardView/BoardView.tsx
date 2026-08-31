import { useState } from 'react';
import type { DragEvent } from 'react';
import type { Task, TaskStatus } from '../../types';
import styles from './BoardView.module.css';

/**
 * The three status columns.
 *
 * Drag-and-drop uses the native HTML API rather than a library: the whole
 * interaction is "read an id on drop and call update", and a drag library would
 * be a dependency and a re-render story for that.
 */

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'To do' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'done', label: 'Done' },
];

interface Props {
  tasks: Task[];
  attentionIds: Set<number> | null;
  onOpen: (task: Task) => void;
  onMove: (id: number, status: TaskStatus) => void;
}

export function BoardView({ tasks, attentionIds, onOpen, onMove }: Props) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);

  const drop = (status: TaskStatus) => (e: DragEvent) => {
    e.preventDefault();
    setOver(null);
    const id = Number(e.dataTransfer.getData('text/plain'));
    setDragging(null);
    // A drop onto the column a task already sits in is a no-op, not a write —
    // otherwise every accidental nudge bumps updated_at and fires an SSE event
    // to everyone.
    const task = tasks.find(t => t.id === id);
    if (Number.isFinite(id) && task && task.status !== status) onMove(id, status);
  };

  return (
    <div className={styles.board}>
      {COLUMNS.map(({ status, label }) => {
        const column = tasks.filter(t => t.status === status);
        return (
          <section
            key={status}
            className={`${styles.column} ${over === status ? styles.dropping : ''}`}
            onDragOver={e => { e.preventDefault(); setOver(status); }}
            onDragLeave={() => setOver(o => (o === status ? null : o))}
            onDrop={drop(status)}
          >
            <header className={styles.columnHead}>
              <span className={styles.columnTitle}>{label}</span>
              <span className={styles.count}>{column.length}</span>
            </header>

            {column.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                needsAttention={attentionIds?.has(task.id) ?? false}
                dragging={dragging === task.id}
                onOpen={() => onOpen(task)}
                onDragStart={e => {
                  e.dataTransfer.setData('text/plain', String(task.id));
                  e.dataTransfer.effectAllowed = 'move';
                  setDragging(task.id);
                }}
                onDragEnd={() => setDragging(null)}
              />
            ))}

            {column.length === 0 && <p className={styles.empty}>Nothing here.</p>}
          </section>
        );
      })}
    </div>
  );
}

interface CardProps {
  task: Task;
  needsAttention: boolean;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
}

function TaskCard({ task, needsAttention, dragging, onOpen, onDragStart, onDragEnd }: CardProps) {
  return (
    // A button, not a div with onClick: the board is used with a keyboard, and
    // this is the only way into a task.
    <button
      type="button"
      className={`${styles.card} ${dragging ? styles.dragging : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
    >
      <span className={styles.cardTop}>
        <span className={styles.id}>#{task.id}</span>
        <span className={styles.title}>{task.title}</span>
      </span>

      <span className={styles.meta}>
        {(task.priority === 'critical' || task.priority === 'high') && (
          <span className={`${styles.chip} ${styles[task.priority]}`}>{task.priority}</span>
        )}
        {task.type !== 'task' && <span className={styles.chip}>{task.type}</span>}
        {task.atRisk && <span className={`${styles.chip} ${styles.risk}`}>at risk</span>}
        {needsAttention && <span className={`${styles.chip} ${styles.attention}`}>waiting on you</span>}
        {task.tags.map(tag => <span key={tag} className={styles.chip}>{tag}</span>)}
        {task.assignee && <span className={styles.assignee}>{task.assignee}</span>}
      </span>
    </button>
  );
}
