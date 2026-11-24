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
        .then(r => {
          // 404 = this schema has no data loader (a demo dataset), so it never
          // imports: stop asking instead of logging a 404 every 20 seconds.
          if (r.status === 404) { clearInterval(interval); return null; }
          return r.json();
        })
        .then((data: StatusResponse | null) => {
          if (!cancelled && data) setIsImporting(data.status?.status === 'running');
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
