import { useCallback, useEffect, useRef, useState } from 'react';
import type { InsightSummary, TrackedMetric } from '../../types/insights';
import { insightsService } from '../../services/insightsService';

interface State<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useAsync<T>(fetcher: (datasetId: string) => Promise<T>, datasetId: string): State<T> {
  const [state, setState] = useState<Omit<State<T>, 'refetch'>>({ data: null, loading: true, error: null });
  const [refreshKey, setRefreshKey] = useState(0);
  // `useTracked` runs real SQL aggregate queries — StrictMode's dev-mode
  // mount->cleanup->mount double-invoke would otherwise fire it twice per
  // load for no benefit. Dedupe by key (datasetId+refreshKey) via a ref, not
  // a per-closure `cancelled` flag: the first invoke's cleanup (fired
  // synchronously by StrictMode's simulated unmount) would otherwise mark
  // its OWN in-flight fetch as cancelled, and since the second invoke
  // returns early without fetching at all, NOTHING ever resolves the
  // loading state — the request completes (visible in the network tab) but
  // the UI stays stuck on the skeleton forever. Checking the ref's *current*
  // value at resolution time (instead of a boolean captured at effect-start)
  // still correctly discards a response once a genuinely new key comes in.
  const inFlightKey = useRef<string | null>(null);

  useEffect(() => {
    const key = `${datasetId}:${refreshKey}`;
    if (inFlightKey.current === key) return;
    inFlightKey.current = key;

    setState(s => ({ ...s, loading: true, error: null }));
    fetcher(datasetId)
      .then(data => { if (inFlightKey.current === key) setState({ data, loading: false, error: null }); })
      .catch(err => { if (inFlightKey.current === key) setState({ data: null, loading: false, error: err.message }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId, refreshKey]);

  const refetch = useCallback(() => setRefreshKey(k => k + 1), []);

  return { ...state, refetch };
}

/** Fast, in-memory — usually resolves before `useTracked`. */
export function useInsights(datasetId: string): State<InsightSummary[]> {
  return useAsync(insightsService.getInsights, datasetId);
}

/** Slower — real SQL aggregate queries, kept independent so it doesn't hold up the insights grid. */
export function useTracked(datasetId: string): State<TrackedMetric[]> {
  return useAsync(insightsService.getTracked, datasetId);
}
