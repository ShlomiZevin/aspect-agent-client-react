import { useCallback, useEffect, useState } from 'react';

/** Pass a stable function: `api.x`, or a useCallback when it takes a parameter. */
export function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load()
      .then(result => { if (!cancelled) { setData(result); setError(null); } })
      .catch((err: Error) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [load, tick]);

  const reload = useCallback(() => setTick(t => t + 1), []);
  return { data, error, reload };
}
