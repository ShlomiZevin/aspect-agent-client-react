import { useCallback, useMemo, useState } from 'react';
import { ManagementError, api } from '../api';
import { TASK_TYPES, shiftDate, todayInIsrael, useText } from '../format';
import { Icon, Loading, Num } from '../ui';
import { useLoad } from '../useLoad';
import type { Person, Report, ReportEntry, TaskType } from '../types';
import styles from '../ledger.module.css';

/** The select's value for internal work: a time entry with no client. */
const INTERNAL = 'internal';

interface Row {
  key: number;
  client: string;
  project: string;
  start: string;
  end: string;
  /** The hours of a row sent before start and end existed; '' for every other row. */
  legacyHours: string;
  taskType: TaskType | '';
  description: string;
  billable: boolean;
}

let nextKey = 1;

/** A new row starts where the one before it ended. */
function emptyRow(report: Report, client: string, start = ''): Row {
  return { key: nextKey++, ...forClient(report, client), start, end: '', legacyHours: '', taskType: '', description: '' };
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
    start: entry.start ?? '',
    end: entry.end ?? '',
    legacyHours: entry.start ? '' : String(entry.hours),
    taskType: entry.taskType ?? '',
    description: entry.description,
    billable: entry.billable,
  }));
}

const minutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/** The server computes the same; this is for the row's line and the day's total. */
function rowHours(row: Row): number {
  if (row.start && row.end) {
    const span = minutes(row.end) - minutes(row.start);
    return span > 0 ? Math.round((span / 60) * 100) / 100 : 0;
  }
  return row.start || row.end ? 0 : Number(row.legacyHours) || 0;
}

/** The form's content without its row keys, to tell whether anything changed. */
const snapshot = (rows: Row[], stuck: boolean, blocker: string) => JSON.stringify({
  rows: rows.map(({ client, project, start, end, legacyHours, taskType, description, billable }) =>
    ({ client, project, start, end, legacyHours, taskType, description, billable })),
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
  const [error, setError] = useState<unknown>(null);
  const [sent, setSent] = useState(false);
  const text = useText();
  const { t, hoursText, longDate } = text;

  const today = todayInIsrael();
  const dirty = snapshot(rows, stuck, blocker) !== saved;
  const total = useMemo(() => rows.reduce((sum, r) => sum + rowHours(r), 0), [rows]);
  const recentClients = report.clients.filter(c => c.recent);
  const otherClients = report.clients.filter(c => !c.recent);

  const update = (key: number, change: Partial<Row>) => {
    setSent(false);
    setRows(current => current.map(r => (r.key === key ? { ...r, ...change } : r)));
  };

  const goTo = (date: string) => {
    if (dirty && !window.confirm(t('report.unsent'))) return;
    onDate(date);
  };

  const addRow = () => {
    setSent(false);
    setRows(current => [
      ...current,
      emptyRow(report, recentClients[0] ? String(recentClients[0].id) : '', current[current.length - 1]?.end ?? ''),
    ]);
  };

  const send = async () => {
    // A row nobody typed in is not a mistake to report; it is just not a row.
    const filled = rows.filter(r => r.start || r.end || r.legacyHours || r.description.trim());
    const missingClient = filled.findIndex(r => !r.client);
    if (missingClient >= 0) {
      setError(new ManagementError('', 'rowNoClient', { row: missingClient + 1 }));
      return;
    }
    // The server checks the times and the task type, and names the row.
    const entries: ReportEntry[] = filled.map(r => ({
      clientId: r.client === INTERNAL ? null : Number(r.client),
      projectId: r.project ? Number(r.project) : null,
      start: r.start || null,
      end: r.end || null,
      hours: rowHours(r),
      taskType: r.taskType || null,
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
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={styles.reportDate}>
        <button type="button" className={styles.dayBtn} aria-label={t('report.prevDay')} onClick={() => goTo(shiftDate(report.date, -1))}><Icon name="chevronStart" size={26} stroke={2} /></button>
        <span>{longDate(report.date)}</span>
        <button type="button" className={styles.dayBtn} aria-label={t('report.nextDay')} disabled={report.date >= today} onClick={() => goTo(shiftDate(report.date, 1))}><Icon name="chevronEnd" size={26} stroke={2} /></button>
      </div>

      <h1 className={styles.title} style={{ marginBottom: 14 }}>{t('report.title')}</h1>

      <div className={styles.reportHead}>
        <span>{t('common.client')}</span><span>{t('report.times')}</span><span>{t('report.what')}</span><span>{t('common.billable')}</span><span />
      </div>

      {rows.map(row => {
        const projects = report.projects.filter(p => String(p.clientId) === row.client);
        const hours = rowHours(row);
        return (
          <div className={styles.reportRow} key={row.key}>
            <div className={styles.reportClient}>
              <select
                className={styles.input}
                aria-label={t('common.client')}
                value={row.client}
                onChange={e => update(row.key, forClient(report, e.target.value))}
              >
                <option value="">{t('common.choose')}</option>
                {recentClients.length > 0 && (
                  <optgroup label={t('report.recent')}>
                    {recentClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                )}
                {otherClients.length > 0 && (
                  <optgroup label={recentClients.length > 0 ? t('report.others') : t('report.clients')}>
                    {otherClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                )}
                <option value={INTERNAL}>{t('common.internal')}</option>
              </select>
              {projects.length > 0 && (
                <select
                  className={styles.input}
                  aria-label={t('common.project')}
                  value={row.project}
                  onChange={e => update(row.key, { project: e.target.value })}
                >
                  <option value="">{t('common.noProject')}</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              <select
                className={styles.input}
                aria-label={t('report.taskType')}
                value={row.taskType}
                onChange={e => update(row.key, { taskType: e.target.value as TaskType | '' })}
              >
                <option value="">{t('report.taskType')}</option>
                {TASK_TYPES.map(code => <option key={code} value={code}>{text.taskType(code)}</option>)}
              </select>
            </div>
            <div className={styles.reportTimes}>
              <input
                className={styles.input}
                aria-label={t('report.from')}
                type="time"
                dir="ltr"
                value={row.start}
                onChange={e => update(row.key, { start: e.target.value })}
              />
              <input
                className={styles.input}
                aria-label={t('report.to')}
                type="time"
                dir="ltr"
                value={row.end}
                onChange={e => update(row.key, { end: e.target.value })}
              />
              {hours > 0 && <span className={styles.rowHours}>{hoursText(hours)}</span>}
            </div>
            <textarea
              className={`${styles.input} ${styles.reportDesc}`}
              rows={1}
              aria-label={t('report.what')}
              value={row.description}
              onChange={e => update(row.key, { description: e.target.value })}
            />
            <label className={styles.reportCheck}>
              <input
                className={styles.checkbox}
                type="checkbox"
                aria-label={t('common.billable')}
                checked={row.billable}
                onChange={e => update(row.key, { billable: e.target.checked })}
              />
              <span className={styles.phoneOnly}>{t('common.billable')}</span>
            </label>
            <button
              type="button"
              className={styles.deleteBtn}
              aria-label={t('report.deleteRow')}
              onClick={() => { setSent(false); setRows(current => current.filter(r => r.key !== row.key)); }}
            >
              <Icon name="trash" size={26} stroke={1.6} />
            </button>
          </div>
        );
      })}

      <button type="button" className={styles.addRow} onClick={addRow}>
        <Icon name="plus" size={28} stroke={2} /> {t('report.addRow')}
      </button>

      <div className={styles.total}>
        <span>{t('report.totalToday')}</span>
        <span><span className={styles.totalNumber}><Num>{text.hours(total)}</Num></span> {t('common.hours')}</span>
      </div>

      {stuck && (
        <textarea
          className={styles.input}
          style={{ marginBottom: 12 }}
          aria-label={t('report.whatIsStuck')}
          placeholder={t('report.whatIsStuck')}
          value={blocker}
          onChange={e => { setSent(false); setBlocker(e.target.value); }}
        />
      )}

      {error !== null && <p className={styles.errorLine}>{text.error(error)}</p>}
      {sent && <p className={styles.success}>{t('report.sent')}</p>}

      <div className={styles.reportActions}>
        <button type="button" className={`${styles.btnPrimary} ${styles.sendBtn}`} disabled={busy} onClick={send}>
          <span className={styles.sendLabel}>{busy ? t('report.sending') : t('report.send')}</span>
          <Icon name="arrowEnd" size={26} stroke={2} />
        </button>
        <label className={styles.stuck}>
          <input
            className={styles.checkbox}
            type="checkbox"
            checked={stuck}
            onChange={e => { setSent(false); setStuck(e.target.checked); }}
          />
          {t('report.stuck')}
        </label>
      </div>
    </>
  );
}
