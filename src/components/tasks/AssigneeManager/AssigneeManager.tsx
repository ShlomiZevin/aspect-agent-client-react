import { useState } from 'react';
import type { Assignee } from '../../../types/task';
import styles from './AssigneeManager.module.css';

// ONLY PRIMARY COLORS - MAXIMUM POSSIBLE DISTINCTION (same as TaskCard)
const ASSIGNEE_COLORS = [
  '#FF0000', // PURE RED
  '#00FF00', // PURE GREEN
  '#0000FF', // PURE BLUE
  '#FFFF00', // PURE YELLOW
  '#FF00FF', // PURE MAGENTA
  '#00FFFF', // PURE CYAN
  '#FF8000', // PURE ORANGE
  '#000000', // BLACK
];

function getAssigneeColor(assignee: string): string {
  // Simple character sum with position weighting to avoid collisions
  let hash = 0;
  for (let i = 0; i < assignee.length; i++) {
    // Weight by position using prime number to maximize distribution
    hash = (hash + assignee.charCodeAt(i) * (i * 7 + 13)) % 9999991;
  }
  return ASSIGNEE_COLORS[hash % ASSIGNEE_COLORS.length];
}

interface AssigneeManagerProps {
  assignees: Assignee[];
  onAddAssignee: (name: string) => Promise<void>;
  selectedAssignee?: string | null;
  onAssigneeClick?: (assignee: string | null) => void;
}

export function AssigneeManager({ assignees, onAddAssignee, selectedAssignee, onAssigneeClick }: AssigneeManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAdd = async () => {
    if (!newName.trim()) return;

    setIsLoading(true);
    try {
      await onAddAssignee(newName.trim());
      setNewName('');
      setIsAdding(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewName('');
    }
  };

  return (
    <div className={styles.container}>
      <span className={styles.label}>Assignees:</span>
      <div className={styles.list}>
        {onAssigneeClick && (
          <button
            className={`${styles.chip} ${styles.clickable} ${selectedAssignee === null ? styles.active : ''}`}
            onClick={() => onAssigneeClick(null)}
          >
            All
          </button>
        )}
        {assignees.map(a => {
          const color = getAssigneeColor(a.name);
          const chipStyle = {
            '--assignee-color': color,
            borderColor: selectedAssignee === a.name ? color : undefined,
            backgroundColor: selectedAssignee === a.name ? `${color}15` : undefined,
          } as React.CSSProperties;

          return onAssigneeClick ? (
            <button
              key={a.id}
              className={`${styles.chip} ${styles.clickable} ${selectedAssignee === a.name ? styles.active : ''}`}
              style={chipStyle}
              onClick={() => onAssigneeClick(selectedAssignee === a.name ? null : a.name)}
            >
              <span className={styles.colorDot} style={{ backgroundColor: color }} />
              {a.name}
            </button>
          ) : (
            <span key={a.id} className={styles.chip} style={chipStyle}>
              <span className={styles.colorDot} style={{ backgroundColor: color }} />
              {a.name}
            </span>
          );
        })}
        {isAdding ? (
          <div className={styles.inputWrapper}>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Name..."
              autoFocus
              disabled={isLoading}
              className={styles.input}
            />
            <button
              onClick={handleAdd}
              disabled={isLoading || !newName.trim()}
              className={styles.addBtn}
            >
              {isLoading ? '...' : 'Add'}
            </button>
          </div>
        ) : (
          <button
            className={styles.plusBtn}
            onClick={() => setIsAdding(true)}
            title="Add assignee"
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}
