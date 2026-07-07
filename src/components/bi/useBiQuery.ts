/** Runs a BI query spec and tracks loading/error/result. */
import { useEffect, useRef, useState } from 'react';
import type { QuerySpec, QueryResult } from '../../types/bi';
import { biService } from '../../services/biService';

interface State {
  result: QueryResult | null;
  loading: boolean;
  error: string | null;
}

/**
 * @param enabled  only run when true (spec has ≥1 measure)
 * @param deps     serialized spec — re-runs when it changes
 */
export function useBiQuery(datasetId: string, spec: QuerySpec, enabled: boolean): State {
  const [state, setState] = useState<State>({ result: null, loading: false, error: null });
  const reqId = useRef(0);
  const key = JSON.stringify({ datasetId, spec });

  useEffect(() => {
    if (!enabled) {
      setState({ result: null, loading: false, error: null });
      return;
    }
    const id = ++reqId.current;
    setState(s => ({ ...s, loading: true, error: null }));
    biService.query(datasetId, spec)
      .then(result => { if (id === reqId.current) setState({ result, loading: false, error: null }); })
      .catch(err => { if (id === reqId.current) setState({ result: null, loading: false, error: err.message }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return state;
}
