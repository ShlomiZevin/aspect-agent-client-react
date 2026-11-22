/**
 * `useIsListField()` (task #947) — "is this name a multi-value field?" for
 * the places that print a condition as text (filter summaries, tooltips,
 * snippet filter labels), so they say "includes …" on a list exactly like
 * the condition editor. Looks at every agent field and every crew's own
 * fields in the open doc.
 */
import { useMemo } from 'react';
import { useBuilder } from './BuilderContext';
import { isMultiField } from './multiValue';

export function useIsListField(): (name: string) => boolean {
  const { doc } = useBuilder();
  return useMemo(() => {
    const names = new Set<string>();
    for (const a of doc.agents) {
      for (const f of a.fields ?? []) if (isMultiField(f)) names.add(f.name);
      for (const c of a.crews ?? []) for (const f of c.fields ?? []) if (isMultiField(f)) names.add(f.name);
    }
    return (name: string) => names.has(name);
  }, [doc.agents]);
}
