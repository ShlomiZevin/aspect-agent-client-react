import { useState } from 'react';
import type { Assignee } from '../../../types/task';
import styles from './AssigneeManager.module.css';

// Manual color assignments for known assignees - maximally distinct (same as TaskCard)
const KNOWN_ASSIGNEE_COLORS: Record<string, string> = {
  'shlomi': '#FB8C00',  // Orange
  'kosta': '#1E88E5',   // Blue
  'noa': '#E53935',     // Red
};

// Extended color palette for other assignees - 16 highly distinct colors
const ASSIGNEE_COLORS = [
  '#43A047', // Green
  '#8E24AA', // Purple
  '#00ACC1', // Cyan
  '#D81B60', // Pink
  '#6D4C41', // Brown
  '#3949AB', // Indigo
  '#00897B', // Teal
  '#C0CA33', // Lime
  '#F4511E', // Deep Orange
  '#5E35B1', // Deep Purple
  '#039BE5', // Light Blue
  '#7CB342', // Light Green
  '#546E7A', // Blue Grey
  '#FFB300', // Amber
  '#EC407A', // Pink 400
  '#26A69A', // Teal 400
];

// FNV-1a hash - better distribution than simple sum
function fnv1aHash(str: string): number {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // FNV prime, unsigned
  }
  return hash;
}

export function getAssigneeColor(assignee: string): string {
  const name = assignee.toLowerCase();
  // Use manual assignment for known assignees
  if (KNOWN_ASSIGNEE_COLORS[name]) {
    return KNOWN_ASSIGNEE_COLORS[name];
  }
  // Fall back to hash for unknown assignees
  const hash = fnv1aHash(name);
  return ASSIGNEE_COLORS[hash % ASSIGNEE_COLORS.length];
}

interface AssigneeManagerProps {
  assignees: Assignee[];
  onAddAssignee: (name: string) => Promise<void>;
  selectedAssignee?: string | null;
  onAssigneeClick?: (assignee: string | null) => void;
  showUnassigned?: boolean;
  unassignedCount?: number;
  showUnassignedOnly?: boolean;
  onUnassignedClick?: () => void;
}

export function AssigneeManager({ assignees, onAddAssignee, selectedAssignee, onAssigneeClick, showUnassigned, unassignedCount, showUnassignedOnly, onUnassignedClick }: AssigneeManagerProps) {
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
        {showUnassigned && onUnassignedClick && (
          <button
            className={`${styles.chip} ${styles.clickable} ${showUnassignedOnly ? styles.active : ''}`}
            style={showUnassignedOnly ? { borderColor: '#94a3b8', backgroundColor: 'rgba(148, 163, 184, 0.1)' } : undefined}
            onClick={onUnassignedClick}
          >
            <span className={styles.colorDot} style={{ backgroundColor: '#94a3b8' }} />
            ?{unassignedCount ? ` ${unassignedCount}` : ''}
          </button>
        )}
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
