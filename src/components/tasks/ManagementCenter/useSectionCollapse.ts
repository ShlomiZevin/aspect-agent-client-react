import { useCallback, useState } from 'react';
import type { AgendaBlock } from './agendaParse';
import type { Topic } from './topics';

/**
 * Action-item sections: how an action topic splits into `**Section**` groups,
 * and which ones this viewer folded (remembered per browser, one key for the
 * center and /tasks/actions, as "<topic id>:<section name>"; default open).
 * Rendered by ActionSections.tsx.
 */

export type SectionItem = { block: Exclude<AgendaBlock, { kind: 'heading' }>; i: number };
export type Section = { key: string; name: string | null; items: SectionItem[]; total: number; ticked: number };

const CLOSED_KEY = 'lybi-action-sections-closed';

export function sectionsOf(topic: Topic): Section[] {
  const out: Section[] = [];
  let cur: Section | null = null;
  for (let i = 0; i < topic.blocks.length; i++) {
    const block = topic.blocks[i];
    if (block.kind === 'heading') {
      cur = { key: `h${i}`, name: block.text, items: [], total: 0, ticked: 0 };
      out.push(cur);
      continue;
    }
    if (!cur) {
      cur = { key: 'lead', name: null, items: [], total: 0, ticked: 0 };
      out.push(cur);
    }
    cur.items.push({ block, i });
    if (block.kind === 'line') {
      cur.total++;
      if (block.checked) cur.ticked++;
    }
  }
  return out;
}

function readClosed(): Record<string, true> {
  try {
    const parsed = JSON.parse(localStorage.getItem(CLOSED_KEY) || 'null');
    if (parsed && typeof parsed === 'object') return parsed;
  } catch { /* private mode / bad value */ }
  return {};
}

const idOf = (topic: Topic, name: string) => `${topic.task.id}:${name}`;

export type SectionCollapse = ReturnType<typeof useSectionCollapse>;

export function useSectionCollapse() {
  const [closed, setClosed] = useState<Record<string, true>>(readClosed);

  const save = useCallback((update: (prev: Record<string, true>) => Record<string, true>) => {
    setClosed(prev => {
      const next = update(prev);
      try { localStorage.setItem(CLOSED_KEY, JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  }, []);

  const isOpen = (topic: Topic, name: string | null) => name === null || !closed[idOf(topic, name)];

  const setOpen = (topic: Topic, name: string, open: boolean) => save(prev => {
    const next = { ...prev };
    if (open) delete next[idOf(topic, name)];
    else next[idOf(topic, name)] = true;
    return next;
  });

  const named = (topics: Topic[]) =>
    topics.flatMap(t => sectionsOf(t).filter(s => s.name !== null).map(s => ({ t, name: s.name as string })));

  const hasSections = (topics: Topic[]) => named(topics).length > 0;
  const allOpen = (topics: Topic[]) => named(topics).every(({ t, name }) => isOpen(t, name));
  const setAll = (topics: Topic[], open: boolean) => save(prev => {
    const next = { ...prev };
    named(topics).forEach(({ t, name }) => {
      if (open) delete next[idOf(t, name)];
      else next[idOf(t, name)] = true;
    });
    return next;
  });

  return { isOpen, setOpen, hasSections, allOpen, setAll };
}
