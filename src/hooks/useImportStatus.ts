import { useEffect, useState } from 'react';

const POLL_INTERVAL_MS = 20_000;

interface StatusResponse {
  status: { status: 'running' | 'completed' | 'failed' } | null;
}

/** Polls the data-loader status endpoint and reports whether an import/index job is currently running for this schema. */
export function useImportStatus(baseURL: string, schema: string): boolean {
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = () => {
      fetch(`${baseURL}/api/admin/data-loader/${schema}/status`)
        .then(r => r.json())
        .then((data: StatusResponse) => {
          if (!cancelled) setIsImporting(data?.status?.status === 'running');
        })
        .catch(() => {});
    };

    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [baseURL, schema]);

  return isImporting;
}
