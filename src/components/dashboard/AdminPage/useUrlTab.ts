import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * The active tab of an admin page, kept in the URL (`?tab=schedule`) instead
 * of component state — so a refresh, a shared link or Back lands on the same
 * tab rather than resetting to the first one.
 *
 * The first tab is the default and leaves no `?tab=` behind; an unknown value
 * in the URL falls back to it. Switching replaces the history entry, the same
 * way the task board keeps `?task=` (TaskBoardPage).
 */
export function useUrlTab<T extends string>(tabs: readonly T[]): [T, (tab: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get('tab');
  const tab = tabs.includes(raw as T) ? (raw as T) : tabs[0];

  const setTab = useCallback((next: T) => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (next === tabs[0]) params.delete('tab'); else params.set('tab', next);
      return params;
    }, { replace: true });
  // `tabs` is a module-level constant at every call site.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSearchParams]);

  return [tab, setTab];
}
