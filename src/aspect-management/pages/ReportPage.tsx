import { useCallback, useMemo, useState } from 'react';
import { api } from '../api';
import { hours as formatHours, longDate, shiftDate, todayInIsrael } from '../format';
import { Icon, Loading, Num } from '../ui';
import { useLoad } from '../useLoad';
import type { Person, Report, ReportEntry } from '../types';
import styles from '../ledger.module.css';

/** The select's value for internal work: a time entry with no client. */
const INTERNAL = 'internal';

interface Row {
  key: number;
  client: string;
  project: string;
  hours: string;
  description: string;
  billable: boolean;
}

let nextKey = 1;

function emptyRow(report: Report, client: string): Row {
  return { key: nextKey++, ...forClient(report, client), hours: '', description: '' };
}

/** Choosing a client decides the rest: its only project, and whether it bills. */
function forClient(report: Report, client: string) {
  const options = report.projects.filter(p => String(p.clientId) === client);
  return {
    client,
    project: options.length === 1 ? String(options[0].id) : '',
    billable: client !== INTERNAL,
  };
}

function toRows(report: Report): Row[] {
  if (report.entries.length === 0) {
    const recent = report.clients.find(c => c.recent);
    return [emptyRow(report, recent ? String(recent.id) : '')];
  }
  return report.entries.map(entry => ({
    key: nextKey++,
    client: entry.clientId ? String(entry.clientId) : INTERNAL,
    project: entry.projectId ? String(entry.projectId) : '',
    hours: String(entry.hours),
    description: entry.description,
    billable: entry.billable,
  }));
}

/** The form's content without its row keys, to tell whether anything changed. */
const snapshot = (rows: Row[], stuck: boolean, blocker: string) => JSON.stringify({
  rows: rows.map(({ client, project, hours, description, billable }) => ({ client, project, hours, description, billable })),
  blocker: stuck ? blocker.trim() : '',
});

/** 2. מה עשית היום? Phone first; the target is under a minute. */
export function ReportPage({ person }: { person: Person }) {
  const [date, setDate] = useState(todayInIsrael());
  const load = useCallback(() => api.report(person.id, date), [person.id, date]);
  const { data, error } = useLoad(load);

  return (
    <div className={styles.page}>
      {/* While the next day loads, `data` is still the day before. */}
      {data?.date === date
        ? <ReportForm key={date} person={person} report={data} onDate={setDate} />
        : <Loading error={error} />}
    </div>
  );
}

function ReportForm({ person, report, onDate }: { person: Person; report: Report; onDate: (d: string) => void }) {
  const [rows, setRows] = useState<Row[]>(() => toRows(report));
  const [stuck, setStuck] = useState(Boolean(report.blocker));
  const [blocker, setBlocker] = useState(report.blocker);
  const [saved, setSaved] = useState(() => snapshot(rows, stuck, blocker));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const today = todayInIsrael();
  const dirty = snapshot(rows, stuck, blocker) !== saved;
  const total = useMemo(() => rows.reduce((sum, r) => sum + (Number(r.hours) || 0), 0), [rows]);
  const recentClients = report.clients.filter(c => c.recent);
  const otherClients = report.clients.filter(c => !c.recent);

  const update = (key: number, change: Partial<Row>) => {
    setSent(false);
    setRows(current => current.map(r => (r.key === key ? { ...r, ...change } : r)));
  };

  const goTo = (date: string) => {
    if (dirty && !window.confirm('יש שינויים שלא נשלחו. לעבור יום בלי לשלוח?')) return;
    onDate(date);
  };

  const send = async () => {
    // A row nobody typed in is not a mistake to report; it is just not a row.
    const filled = rows.filter(r => r.hours.trim() || r.description.trim());
    const missingClient = filled.findIndex(r => !r.client);
    if (missingClient >= 0) {
      setError(`שורה ${missingClient + 1}: חסר לקוח`);
      return;
    }
    const entries: ReportEntry[] = filled.map(r => ({
      clientId: r.client === INTERNAL ? null : Number(r.client),
      projectId: r.project ? Number(r.project) : null,
      hours: Number(r.hours),
      description: r.description,
      billable: r.billable,
    }));

    setBusy(true);
    setError(null);
    try {
      await api.saveReport({ personId: person.id, date: report.date, entries, blocker: stuck ? blocker : '' });
      setSaved(snapshot(rows, stuck, blocker));
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={styles.reportDate}>
        <button type="button" className={styles.dayBtn} aria-label="היום הקודם" onClick={() => goTo(shiftDate(report.date, -1))}><Icon name="chevronStart" size={26} stroke={2} /></button>
        <span>{longDate(report.date)}</span>
        <button type="button" className={styles.dayBtn} aria-label="היום הבא" disabled={report.date >= today} onClick={() => goTo(shiftDate(report.date, 1))}><Icon name="chevronEnd" size={26} stroke={2} /></button>
      </div>

      <h1 className={styles.title} style={{ marginBottom: 14 }}>מה עשית היום?</h1>

      <div className={styles.reportHead}>
        <span>לקוח</span><span>שעות</span><span>מה עשית</span><span>לחיוב</span><span />
      </div>

      {rows.map(row => {
        const projects = report.projects.filter(p => String(p.clientId) === row.client);
        return (
          <div className={styles.reportRow} key={row.key}>
            <div className={styles.reportClient}>
              <select
                className={styles.input}
                aria-label="לקוח"
                value={row.client}
                onChange={e => update(row.key, forClient(report, e.target.value))}
              >
                <option value="">בחירה</option>
                {recentClients.length > 0 && (
                  <optgroup label="אחרונים">
                    {recentClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                )}
                {otherClients.length > 0 && (
                  <optgroup label={recentClients.length > 0 ? 'כל השאר' : 'לקוחות'}>
                    {otherClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                )}
                <option value={INTERNAL}>פנימי</option>
              </select>
              {projects.length > 0 && (
                <select
                  className={styles.input}
                  aria-label="פרויקט"
                  value={row.project}
                  onChange={e => update(row.key, { project: e.target.value })}
                >
                  <option value="">ללא פרויקט</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
            </div>
            <input
              className={`${styles.input} ${styles.reportHours}`}
              aria-label="שעות"
              type="number"
              inputMode="decimal"
              min="0"
              max="24"
              step="0.25"
              value={row.hours}
              onChange={e => update(row.key, { hours: e.target.value })}
            />
            <textarea
              className={`${styles.input} ${styles.reportDesc}`}
              rows={1}
              aria-label="מה עשית"
              value={row.description}
              onChange={e => update(row.key, { description: e.target.value })}
            />
            <label className={styles.reportCheck}>
              <input
                className={styles.checkbox}
                type="checkbox"
                aria-label="לחיוב"
                checked={row.billable}
                onChange={e => update(row.key, { billable: e.target.checked })}
              />
              <span className={styles.phoneOnly}>לחיוב</span>
            </label>
            <button
              type="button"
              className={styles.deleteBtn}
              aria-label="מחיקת שורה"
              onClick={() => { setSent(false); setRows(current => current.filter(r => r.key !== row.key)); }}
            >
              <Icon name="trash" size={26} stroke={1.6} />
            </button>
          </div>
        );
      })}

      <button
        type="button"
        className={styles.addRow}
        onClick={() => { setSent(false); setRows(current => [...current, emptyRow(report, recentClients[0] ? String(recentClients[0].id) : '')]); }}
      >
        <Icon name="plus" size={28} stroke={2} /> הוספת שורה
      </button>

      <div className={styles.total}>
        <span>סה״כ היום</span>
        <span><span className={styles.totalNumber}><Num>{formatHours(total)}</Num></span> שעות</span>
      </div>

      {stuck && (
        <textarea
          className={styles.input}
          style={{ marginBottom: 12 }}
          aria-label="מה תקוע?"
          placeholder="מה תקוע?"
          value={blocker}
          onChange={e => { setSent(false); setBlocker(e.target.value); }}
        />
      )}

      {error && <p className={styles.errorLine}>{error}</p>}
      {sent && <p className={styles.success}>נשלח. תודה!</p>}

      <div className={styles.reportActions}>
        <button type="button" className={`${styles.btnPrimary} ${styles.sendBtn}`} disabled={busy} onClick={send}>
          <span className={styles.sendLabel}>{busy ? 'שולח…' : 'שליחה'}</span>
          <Icon name="arrowEnd" size={26} stroke={2} />
        </button>
        <label className={styles.stuck}>
          <input
            className={styles.checkbox}
            type="checkbox"
            checked={stuck}
            onChange={e => { setSent(false); setStuck(e.target.checked); }}
          />
          משהו תקוע
        </label>
      </div>
    </>
  );
}
