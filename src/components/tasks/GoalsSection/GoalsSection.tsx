import { useMemo, useState, useRef, useCallback } from 'react';
import type { Task, UpdateTaskData } from '../../../types/task';
import { RichTextEditor } from '../RichTextEditor/RichTextEditor';
import styles from './GoalsSection.module.css';

interface GoalsSectionProps {
  goals: Task[];
  allTasks: Task[];
  isFullScreen?: boolean;
  hideHeader?: boolean;
  title?: string;
  emoji?: string;
  tint?: string; // background for the list area
  headerTint?: string; // background for the header
  showOpener?: boolean;
  meetingDate?: string | null;
  meetingDateLabel?: string;
  meetingNotes?: string;
  showNotesModal?: boolean;
  onShowNotesModal?: (show: boolean) => void;
  onGoalClick: (task: Task) => void;
  onDeleteGoal?: (task: Task) => void;
  onAddGoal: () => void;
  onUpdateGoal: (id: number, updates: UpdateTaskData) => Promise<void>;
  onLinkedTaskClick?: (task: Task) => void;
  onToggleFullScreen?: () => void;
  onMeetingDateChange?: (date: string) => void;
  onMeetingNotesChange?: (notes: string) => void;
}

const STATUS_ICONS: Record<string, string> = {
  todo: '○',
  in_progress: '⏳',
  done: '✓',
};

function getOrder(tags: string[]): number {
  const tag = tags.find(t => t.startsWith('order:'));
  return tag ? parseInt(tag.split(':')[1], 10) : Infinity;
}

function setOrderTag(tags: string[], order: number): string[] {
  return [...tags.filter(t => !t.startsWith('order:')), `order:${order}`];
}

function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

function formatCreatedAt(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const created = new Date(d);
  created.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function GoalsSection({ goals, allTasks, isFullScreen, hideHeader, title = 'Goals', emoji = '🎯', tint, headerTint, showOpener, meetingDate, meetingDateLabel = 'Last meeting:', meetingNotes, showNotesModal: externalShowNotes, onShowNotesModal, onGoalClick, onDeleteGoal, onAddGoal, onUpdateGoal, onLinkedTaskClick, onToggleFullScreen, onMeetingDateChange, onMeetingNotesChange }: GoalsSectionProps) {
  const [internalShowNotes, setInternalShowNotes] = useState(false);
  const showNotesModal = externalShowNotes ?? internalShowNotes;
  const setShowNotesModal = onShowNotesModal ?? setInternalShowNotes;
  const [localNotes, setLocalNotes] = useState(meetingNotes || '');
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prevNotesRef = useRef(meetingNotes);
  if (meetingNotes !== prevNotesRef.current) {
    prevNotesRef.current = meetingNotes;
    setLocalNotes(meetingNotes || '');
  }

  const hasNotes = !!(localNotes && stripHtml(localNotes).trim());

  const handleNotesChange = useCallback((value: string) => {
    setLocalNotes(value);
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(() => {
      onMeetingNotesChange?.(value);
    }, 800);
  }, [onMeetingNotesChange]);

  const dragItemRef = useRef<number | null>(null);
  const dragOverRef = useRef<number | null>(null);

  const sortedGoals = useMemo(() => {
    return [...goals].sort((a, b) => {
      const oa = getOrder(a.tags);
      const ob = getOrder(b.tags);
      if (oa !== ob) return oa - ob;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [goals]);

  const handleCompletedToggle = (e: React.MouseEvent, goal: Task) => {
    e.stopPropagation();
    onUpdateGoal(goal.id, { isCompleted: !goal.isCompleted });
  };

  const handleLinkedTaskClick = (e: React.MouseEvent, linkedTask: Task) => {
    e.stopPropagation();
    if (onLinkedTaskClick) {
      onLinkedTaskClick(linkedTask);
    } else {
      onGoalClick({ ...linkedTask });
    }
  };

  const handleDragStart = useCallback((index: number) => {
    dragItemRef.current = index;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragOverRef.current = index;
  }, []);

  const handleDrop = useCallback(async () => {
    const fromIndex = dragItemRef.current;
    const toIndex = dragOverRef.current;
    dragItemRef.current = null;
    dragOverRef.current = null;

    if (fromIndex === null || toIndex === null || fromIndex === toIndex) return;

    const reordered = [...sortedGoals];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    await Promise.all(
      reordered.map((goal, i) =>
        onUpdateGoal(goal.id, { tags: setOrderTag(goal.tags, i + 1) })
      )
    );
  }, [sortedGoals, onUpdateGoal]);

  const handleDragEnd = useCallback(() => {
    dragItemRef.current = null;
    dragOverRef.current = null;
  }, []);

  const notesButton = onMeetingNotesChange && (
    <button
      className={`${styles.notesBtn} ${hasNotes ? styles.notesBtnActive : ''}`}
      onClick={() => setShowNotesModal(true)}
      title="Meeting notes"
    >
      📝
    </button>
  );

  return (
    <div className={`${styles.sidebar} ${isFullScreen ? styles.fullScreen : ''}`}>
      {!hideHeader && (
        <div className={styles.header} style={headerTint ? { background: headerTint } : undefined}>
          <div className={styles.headerTop}>
            <h3 className={styles.title}>
              <span className={styles.titleIcon}>{emoji}</span>
              {title}
              {notesButton}
            </h3>
            <div className={styles.headerActions}>
              <button className={styles.addBtn} onClick={onAddGoal}>+</button>
              {onToggleFullScreen && (
                <button
                  className={styles.expandBtn}
                  onClick={onToggleFullScreen}
                  title="Expand"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                </button>
              )}
            </div>
          </div>
          {onMeetingDateChange && (
            <div className={styles.meetingDate}>
              <span className={styles.meetingDateLabel}>{meetingDateLabel}</span>
              <input
                type="date"
                className={styles.meetingDateInput}
                value={meetingDate || ''}
                onChange={(e) => onMeetingDateChange(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      <div className={styles.goalsList} style={tint ? { background: tint } : undefined}>
        {sortedGoals.length === 0 ? (
          <div className={styles.empty}>
            No {title.toLowerCase()} yet.<br />
            {title === 'Agenda' ? 'Add items for the next meeting.' : 'Add goals from your team meeting.'}
          </div>
        ) : (
          sortedGoals.map((goal, index) => {
            // Support both linkedTasks array and legacy dependsOn
            const linkedIds = goal.linkedTasks?.length ? goal.linkedTasks : goal.dependsOn ? [goal.dependsOn] : [];
            const linkedTasksList = linkedIds.map(id => allTasks.find(t => t.id === id)).filter(Boolean) as Task[];

            return (
              <div
                key={goal.id}
                className={`${styles.goalItem} ${isFullScreen ? styles.goalItemFull : ''}`}
                onClick={() => onGoalClick(goal)}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              >
                <span className={styles.goalNumber}>{index + 1}.</span>
                <div className={styles.goalContent}>
                  <div className={`${styles.goalTitle} ${goal.isCompleted ? styles.completed : ''}`}>
                    {goal.title}
                  </div>
                  <div className={styles.goalMeta}>
                    {showOpener && goal.opener && (
                      <span className={styles.goalOpener}>{goal.opener.startsWith('user_') || goal.opener.startsWith('anon_') ? 'Anon' : goal.opener}</span>
                    )}
                    {goal.assignee && (
                      <span className={styles.goalAssignee}>{goal.assignee}</span>
                    )}
                    <span className={styles.goalCreated}>{formatCreatedAt(goal.createdAt)}</span>
                  </div>
                  {linkedTasksList.length > 0 && (
                    <div className={styles.linkedTasksList}>
                      {linkedTasksList.map(lt => (
                        <button
                          key={lt.id}
                          className={styles.linkedTask}
                          onClick={(e) => handleLinkedTaskClick(e, lt)}
                          title={`Linked: #${lt.id} ${lt.title}`}
                        >
                          <span className={`${styles.linkedTaskStatus} ${styles[lt.status]}`}>
                            {STATUS_ICONS[lt.status] || '○'}
                          </span>
                          <span className={styles.linkedTaskName}>#{lt.id} {lt.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {linkedTasksList.length === 0 && goal.description && (
                    <div className={styles.description}>
                      {stripHtml(goal.description)}
                    </div>
                  )}
                </div>
                {onDeleteGoal && (
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => { e.stopPropagation(); onDeleteGoal(goal); }}
                    title="Delete"
                  >
                    ×
                  </button>
                )}
                <input
                  type="checkbox"
                  className={styles.goalCheckbox}
                  checked={goal.isCompleted}
                  onClick={(e) => handleCompletedToggle(e, goal)}
                  onChange={() => {}}
                  title={goal.isCompleted ? 'Mark incomplete' : 'Mark complete'}
                />
              </div>
            );
          })
        )}
      </div>

      {/* Notes modal overlay */}
      {showNotesModal && (
        <div className={styles.notesOverlay} onClick={() => setShowNotesModal(false)}>
          <div className={styles.notesModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.notesModalHeader}>
              <span>📝 Meeting Notes</span>
              <button className={styles.notesModalClose} onClick={() => setShowNotesModal(false)}>×</button>
            </div>
            <div className={styles.notesEditorWrap}>
              <RichTextEditor
                value={localNotes}
                onChange={handleNotesChange}
                placeholder="Meeting notes..."
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
