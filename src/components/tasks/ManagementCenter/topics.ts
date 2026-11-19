import type { Task } from '../../../types/task';
import { parseAgenda } from './agendaParse';
import type { AgendaBlock } from './agendaParse';

export type LineBlock = Extract<AgendaBlock, { kind: 'line' }>;
export type Topic = { task: Task; blocks: AgendaBlock[]; total: number; ticked: number; done: boolean };

/** Tag prefixes: the call agenda, and a meeting's action items (never both on one topic). */
export const AGENDA_PREFIX = 'agendaFor:';
export const ACTIONS_PREFIX = 'actionsFor:';

/**
 * Agenda topics (type 'agenda') carrying a tag with this prefix, in board
 * order (finished topics stay in place) — one definition for the center and
 * the action-items page.
 */
export function topicsTagged(tasks: Task[] | null, prefix: string): Topic[] {
  if (!tasks) return [];
  return tasks
    .filter(t => t.type === 'agenda' && !t.isDraft && !t.tags.includes('agendaMeta') && t.tags.some(tag => tag.startsWith(prefix)))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id - b.id)
    .map(task => {
      const blocks = parseAgenda(task.description);
      const lines = blocks.filter((b): b is LineBlock => b.kind === 'line');
      const ticked = lines.filter(l => l.checked).length;
      const done = task.isCompleted || task.status === 'done' || (lines.length > 0 && ticked === lines.length);
      return { task, blocks, total: lines.length, ticked, done };
    });
}

export function isActionTopic(t: Topic): boolean {
  return t.task.tags.some(tag => tag.startsWith(ACTIONS_PREFIX));
}
