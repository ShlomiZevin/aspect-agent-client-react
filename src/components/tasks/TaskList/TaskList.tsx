import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Task } from '../../../types/task';
import styles from './TaskList.module.css';

interface TaskListProps {
  tasks: Task[];
  crewDisplayNames?: Record<string, string>;
  onTaskClick: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  showDraftCheckboxes?: boolean;
  selectedDrafts?: Set<number>;
  onToggleDraftSelection?: (taskId: number) => void;
  showExportCheckboxes?: boolean;
  selectedExports?: Set<number>;
  onToggleExportSelection?: (taskId: number) => void;
}

const TYPE_LABELS: Record<string, string> = {
  task: 'Task', bug: 'Bug', feature: 'Feature', idea: 'Idea', read: 'Read',
};
const STATUS_LABELS: Record<string, string> = {
  todo: 'Todo', in_progress: 'In Progress', done: 'Done',
};
const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical',
};

function formatDueDate(dueDate: string | Date | null | undefined): { text: string; isOverdue: boolean } | null {
  if (!dueDate) return null;
  const date = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dueDay = new Date(date); dueDay.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = diffDays < 0;
  let text: string;
  if (diffDays === 0) text = 'Today';
  else if (diffDays === 1) text = 'Tomorrow';
  else if (diffDays === -1) text = 'Yesterday';
  else if (diffDays < -1) text = `${Math.abs(diffDays)}d ago`;
  else if (diffDays <= 7) text = `In ${diffDays}d`;
  else text = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return { text, isOverdue };
}

function formatCreatedAt(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const created = new Date(d); created.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

function containsHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

type FilterableColumn = 'domain' | 'type' | 'assignee' | 'priority' | 'status' | 'crew';

/** Extract unique values for a column from ALL tasks (not filtered) */
function getColumnValues(tasks: Task[], column: FilterableColumn, crewDisplayNames?: Record<string, string>): string[] {
  const values = new Set<string>();
  for (const task of tasks) {
    switch (column) {
      case 'domain': values.add(task.domain || 'general'); break;
      case 'type': values.add(task.type); break;
      case 'assignee': values.add(task.assignee || '—'); break;
      case 'priority': values.add(task.priority); break;
      case 'status': values.add(task.status); break;
      case 'crew': values.add(task.crewMember ? (crewDisplayNames?.[task.crewMember] || task.crewMember) : '—'); break;
    }
  }
  return Array.from(values).sort();
}

function getTaskColumnValue(task: Task, column: FilterableColumn, crewDisplayNames?: Record<string, string>): string {
  switch (column) {
    case 'domain': return task.domain || 'general';
    case 'type': return task.type;
    case 'assignee': return task.assignee || '—';
    case 'priority': return task.priority;
    case 'status': return task.status;
    case 'crew': return task.crewMember ? (crewDisplayNames?.[task.crewMember] || task.crewMember) : '—';
  }
}

function ColumnFilterDropdown({ column, values, selected, onChange, onClose, anchorRef }: {
  column: FilterableColumn;
  values: string[];
  selected: Set<string>;
  onChange: (newSelected: Set<string>) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [local, setLocal] = useState(() => new Set(selected));
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 2, left: rect.left });
    }
  }, [anchorRef]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const labelMap = column === 'type' ? TYPE_LABELS
    : column === 'status' ? STATUS_LABELS
    : column === 'priority' ? PRIORITY_LABELS
    : null;

  const toggle = (v: string) => {
    setLocal(prev => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  };

  if (!pos) return null;

  return createPortal(
    <div
      className={styles.filterDropdown}
      ref={ref}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={styles.filterActions}>
        <button className={styles.filterActionBtn} onClick={() => setLocal(new Set(values))}>All</button>
        <button className={styles.filterActionBtn} onClick={() => setLocal(new Set())}>None</button>
      </div>
      <div className={styles.filterOptions}>
        {values.map(v => (
          <label key={v} className={styles.filterOption}>
            <input type="checkbox" checked={local.has(v)} onChange={() => toggle(v)} />
            {labelMap?.[v] || (column === 'domain' ? (v === 'general' ? 'General' : v.charAt(0).toUpperCase() + v.slice(1)) : v)}
          </label>
        ))}
      </div>
      <div className={styles.filterFooter}>
        <button className={styles.filterCancelBtn} onClick={onClose}>Cancel</button>
        <button className={styles.filterOkBtn} onClick={() => { onChange(local); onClose(); }}>OK</button>
      </div>
    </div>,
    document.body
  );
}

export function TaskList({ tasks, crewDisplayNames, onTaskClick, onDeleteTask, showDraftCheckboxes, selectedDrafts, onToggleDraftSelection, showExportCheckboxes, selectedExports, onToggleExportSelection }: TaskListProps) {
  const showCheckboxes = showDraftCheckboxes || showExportCheckboxes;

  // Column filters: map of column -> set of allowed values
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});
  const [openFilter, setOpenFilter] = useState<FilterableColumn | null>(null);

  const hasAnyFilter = Object.keys(columnFilters).length > 0;

  const clearAllFilters = useCallback(() => {
    setColumnFilters({});
    setOpenFilter(null);
  }, []);

  const applyFilter = useCallback((column: FilterableColumn, selected: Set<string>) => {
    const allValues = getColumnValues(tasks, column, crewDisplayNames);
    if (selected.size === allValues.length) {
      // All selected = remove filter
      setColumnFilters(prev => {
        const { [column]: _, ...rest } = prev;
        return rest;
      });
    } else {
      setColumnFilters(prev => ({ ...prev, [column]: selected }));
    }
  }, [tasks, crewDisplayNames]);

  // Apply column filters
  const filteredTasks = useMemo(() => {
    if (!hasAnyFilter) return tasks;
    return tasks.filter(task => {
      for (const [col, allowed] of Object.entries(columnFilters)) {
        const value = getTaskColumnValue(task, col as FilterableColumn, crewDisplayNames);
        if (!allowed.has(value)) return false;
      }
      return true;
    });
  }, [tasks, columnFilters, hasAnyFilter, crewDisplayNames]);

  // Refs for filter header anchors
  const headerRefs = useRef<Record<string, HTMLElement | null>>({});
  const justClosedRef = useRef<string | null>(null);

  if (tasks.length === 0) {
    return (
      <div className={styles.empty}>
        No tasks yet. Click "+ Add Task" to create one.
      </div>
    );
  }

  const renderFilterableHeader = (column: FilterableColumn, label: string) => {
    const isFiltered = !!columnFilters[column];
    const allValues = getColumnValues(tasks, column, crewDisplayNames);
    const currentSelected = columnFilters[column] || new Set(allValues);

    return (
      <th
        className={`${styles.filterableTh} ${isFiltered ? styles.filteredTh : ''}`}
        onClick={() => {
          if (justClosedRef.current === column) {
            justClosedRef.current = null;
            return;
          }
          setOpenFilter(openFilter === column ? null : column);
        }}
        ref={(el) => { headerRefs.current[column] = el; }}
      >
        <span className={styles.thContent}>{label}<span className={styles.filterIcon}>{isFiltered ? '▾' : '▿'}</span></span>
        {openFilter === column && (
          <ColumnFilterDropdown
            column={column}
            values={allValues}
            selected={currentSelected}
            onChange={(s) => applyFilter(column, s)}
            onClose={() => { justClosedRef.current = column; setOpenFilter(null); setTimeout(() => { justClosedRef.current = null; }, 200); }}
            anchorRef={{ current: headerRefs.current[column] }}
          />
        )}
      </th>
    );
  };

  return (
    <div className={styles.tableWrapper} dir="ltr">
      {hasAnyFilter && (
        <div className={styles.filterBar}>
          <span className={styles.filterBarText}>Filtered ({filteredTasks.length}/{tasks.length})</span>
          <button className={styles.clearFiltersBtn} onClick={clearAllFilters}>Clear filters</button>
        </div>
      )}
      <table className={styles.table}>
        <thead>
          <tr>
            {showCheckboxes && (
              <th className={styles.checkboxCol}>
                {showExportCheckboxes && (
                  <input
                    type="checkbox"
                    title="Select all"
                    checked={selectedExports ? selectedExports.size === filteredTasks.length && filteredTasks.length > 0 : false}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onToggleExportSelection && filteredTasks.forEach(t => {
                          if (!selectedExports?.has(t.id)) onToggleExportSelection(t.id);
                        });
                      } else {
                        onToggleExportSelection && selectedExports?.forEach(id => onToggleExportSelection(id));
                      }
                    }}
                    className={styles.exportCheckbox}
                  />
                )}
              </th>
            )}
            <th className={styles.titleCol}>Title</th>
            {renderFilterableHeader('domain', 'Domain')}
            {renderFilterableHeader('crew', 'Crew')}
            {renderFilterableHeader('type', 'Type')}
            {renderFilterableHeader('assignee', 'Assignee')}
            {renderFilterableHeader('priority', 'Priority')}
            <th>Due</th>
            <th>Created</th>
            {renderFilterableHeader('status', 'Status')}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filteredTasks.map(task => (
            <tr key={task.id} className={task.atRisk ? styles.atRiskRow : ''} onClick={() => onTaskClick(task)}>
              {showCheckboxes && (
                <td className={styles.checkboxCell}>
                  {showDraftCheckboxes ? (
                    <input
                      type="checkbox"
                      checked={selectedDrafts?.has(task.id) || false}
                      onChange={(e) => { e.stopPropagation(); onToggleDraftSelection?.(task.id); }}
                      onClick={(e) => e.stopPropagation()}
                      className={styles.draftCheckbox}
                    />
                  ) : (
                    <input
                      type="checkbox"
                      checked={selectedExports?.has(task.id) || false}
                      onChange={(e) => { e.stopPropagation(); onToggleExportSelection?.(task.id); }}
                      onClick={(e) => e.stopPropagation()}
                      className={styles.exportCheckbox}
                    />
                  )}
                </td>
              )}
              <td className={styles.titleCell}>
                <span className={styles.titleWrapper}>
                  {task.atRisk && <span className={styles.atRiskIcon}>⚠</span>}
                  <span className={styles.title} style={containsHebrew(task.title) ? { direction: 'rtl', textAlign: 'right' } : undefined}>{task.title}</span>
                </span>
                {task.description && (
                  <span className={styles.description}>{stripHtml(task.description)}</span>
                )}
              </td>
              <td><span className={styles.domain}>{task.domain === 'general' ? 'Gen' : task.domain.charAt(0).toUpperCase() + task.domain.slice(1)}</span></td>
              <td>{task.crewMember ? <span className={styles.crewMember}>{crewDisplayNames?.[task.crewMember] || task.crewMember}</span> : <span className={styles.unassigned}>—</span>}</td>
              <td><span className={`${styles.badge} ${styles[task.type]}`}>{TYPE_LABELS[task.type]}</span></td>
              <td>{task.assignee ? <span className={styles.assignee}>@{task.assignee}</span> : <span className={styles.unassigned}>—</span>}</td>
              <td><span className={`${styles.priority} ${styles[task.priority]}`}>{PRIORITY_LABELS[task.priority]}</span></td>
              <td>{(() => { const due = formatDueDate(task.dueDate); if (!due) return <span className={styles.noDueDate}>—</span>; return <span className={`${styles.dueDate} ${due.isOverdue ? styles.overdue : ''}`}>{due.text}</span>; })()}</td>
              <td>{task.createdAt ? <span className={styles.createdAt}>{formatCreatedAt(task.createdAt)}</span> : <span className={styles.noDueDate}>—</span>}</td>
              <td><span className={`${styles.status} ${styles[task.status]}`}>{STATUS_LABELS[task.status]}</span></td>
              <td><button className={styles.deleteBtn} onClick={(e) => { e.stopPropagation(); onDeleteTask(task); }} title="Delete">×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
