import styles from './DataLoaderPage.module.css';

export interface GCSFile {
  name: string;
  basename: string;
  size: string;
  created: string;
  updated: string;
}

export interface FileProgress {
  file: string;
  status: 'pending' | 'loading' | 'loaded' | 'error';
  rows?: number;
  rowsLoaded?: number;
  durationMs?: number;
  error?: string;
}

interface SourceFilesTableProps {
  files: GCSFile[];
  fileProgress?: FileProgress[];
  isReloading: boolean;
}

function formatBytes(bytes: string | number) {
  const n = parseInt(String(bytes));
  if (!n || isNaN(n)) return '—';
  if (n >= 1_073_741_824) return (n / 1_073_741_824).toFixed(1) + ' GB';
  if (n >= 1_048_576) return (n / 1_048_576).toFixed(1) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
}

function formatDate(iso: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Asia/Jerusalem',
    });
  } catch {
    return iso;
  }
}

function getStatusCell(fp?: FileProgress, isReloading?: boolean) {
  if (!fp) return isReloading ? <span className={styles.fileStatusPending}>Queued</span> : null;
  if (fp.status === 'loading') {
    const rows = fp.rowsLoaded;
    return (
      <span className={styles.fileStatusLoading}>
        Loading{rows ? `… ${rows.toLocaleString()} rows` : '…'}
      </span>
    );
  }
  if (fp.status === 'loaded') {
    return <span className={styles.fileStatusDone}>Done — {fp.rows?.toLocaleString()} rows</span>;
  }
  if (fp.status === 'error') {
    return <span className={styles.fileStatusError}>{fp.error}</span>;
  }
  return isReloading ? <span className={styles.fileStatusPending}>Queued</span> : null;
}

export function SourceFilesTable({ files, fileProgress, isReloading }: SourceFilesTableProps) {
  const fpMap = new Map(fileProgress?.map(fp => [fp.file, fp]) ?? []);
  const showStatus = isReloading || (fileProgress && fileProgress.length > 0);

  if (files.length === 0) {
    return <div className={styles.emptyState}>No CSV files found in GCS.</div>;
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>File</th>
          <th>Size</th>
          <th>Last Modified</th>
          {showStatus && <th>Status</th>}
        </tr>
      </thead>
      <tbody>
        {files.map(file => {
          const fp = fpMap.get(file.basename);
          return (
            <tr key={file.name}>
              <td className={styles.fileNameCell}>{file.basename}</td>
              <td>{formatBytes(file.size)}</td>
              <td>{formatDate(file.updated)}</td>
              {showStatus && <td>{getStatusCell(fp, isReloading)}</td>}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
