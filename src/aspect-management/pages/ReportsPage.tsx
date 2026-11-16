import { useCallback, useMemo, useState } from 'react';
import { api } from '../api';
import { BILLING_TYPES, TASK_TYPES, shiftMonth, todayInIsrael, useText, type Text } from '../format';
import { Field, Icon, Loading, Num, PageHead } from '../ui';
import { useLoad } from '../useLoad';
import type { MonthHoursRow } from '../types';
import styles from '../ledger.module.css';

type GroupBy = 'person' | 'client' | 'project';

/** A filter's value for "not set"; '' means no filter. */
const NOT_SET = 'none';

const clientAndProject = (r: MonthHoursRow, t: Text['t']) =>
  r.clientName ? `${r.clientName} · ${r.projectName ?? t('common.noProject')}` : t('common.internal');

/** What each slicing groups by, and what one line under a group is. */
const GROUPINGS: Record<GroupBy, {
  label: string;
  group: (r: MonthHoursRow, t: Text['t']) => [string, string];
  line: (r: MonthHoursRow, t: Text['t']) => [string, string];
}> = {
  person: {
    label: 'common.developer',
    group: r => [`${r.personId}`, r.personName],
    line: (r, t) => [`${r.clientId}-${r.projectId}`, clientAndProject(r, t)],
  },
  client: {
    label: 'common.client',
    group: (r, t) => [`${r.clientId}`, r.clientName ?? t('common.internal')],
    line: r => [`${r.projectId}-${r.personId}`, r.projectName ? `${r.projectName} · ${r.personName}` : r.personName],
  },
  project: {
    label: 'common.project',
    group: (r, t) => [`${r.clientId}-${r.projectId}`, clientAndProject(r, t)],
    line: r => [`${r.personId}`, r.personName],
  },
};

interface Sum {
  key: string;
  label: string;
  hours: number;
  billable: number;
}

interface Group extends Sum {
  lines: Sum[];
}

const byHours = (a: Sum, b: Sum) => b.hours - a.hours;

function groupRows(rows: MonthHoursRow[], groupBy: GroupBy, t: Text['t']): Group[] {
  const { group, line } = GROUPINGS[groupBy];
  const groups = new Map<string, Group & { byLine: Map<string, Sum> }>();
  for (const row of rows) {
    const [groupKey, groupLabel] = group(row, t);
    const [lineKey, lineLabel] = line(row, t);
    if (!groups.has(groupKey)) groups.set(groupKey, { key: groupKey, label: groupLabel, hours: 0, billable: 0, lines: [], byLine: new Map() });
    const g = groups.get(groupKey)!;
    if (!g.byLine.has(lineKey)) g.byLine.set(lineKey, { key: lineKey, label: lineLabel, hours: 0, billable: 0 });
    const l = g.byLine.get(lineKey)!;
    g.hours += row.hours;
    g.billable += row.billableHours;
    l.hours += row.hours;
    l.billable += row.billableHours;
  }
  return [...groups.values()]
    .map(({ byLine, ...g }) => ({ ...g, lines: [...byLine.values()].sort(byHours) }))
    .sort(byHours);
}

/** Hours per code, in the order of `codes`, then "not set" if any. */
function split<C extends string>(rows: MonthHoursRow[], pick: (r: MonthHoursRow) => C | null, codes: C[], label: (code: C) => string, notSet: string) {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(pick(row) ?? NOT_SET, (totals.get(pick(row) ?? NOT_SET) ?? 0) + row.hours);
  return [...codes.map(code => [code, label(code)]), [NOT_SET, notSet]]
    .filter(([code]) => totals.has(code))
    .map(([code, text]) => ({ label: text, hours: totals.get(code)! }));
}

/** דוחות: one month's hours by developer, client and project. */
export function ReportsPage() {
  const thisMonth = todayInIsrael().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [groupBy, setGroupBy] = useState<GroupBy>('person');
  const [billing, setBilling] = useState('');
  const [taskType, setTaskType] = useState('');
  const load = useCallback(() => api.monthHours(month), [month]);
  const { data, error } = useLoad(load);
  const { t, hours, monthName, billingType, taskType: taskTypeLabel } = useText();

  // While the next month loads, `data` is still the month before.
  const loaded = data?.month === month ? data.rows : null;
  const rows = useMemo(() => loaded?.filter(r =>
    (!billing || (r.billingType ?? NOT_SET) === billing) && (!taskType || (r.taskType ?? NOT_SET) === taskType),
  ) ?? null, [loaded, billing, taskType]);
  const groups = rows ? groupRows(rows, groupBy, t) : [];
  const total = rows?.reduce((sum, r) => sum + r.hours, 0) ?? 0;
  const billable = rows?.reduce((sum, r) => sum + r.billableHours, 0) ?? 0;

  return (
    <div className={styles.page}>
      <PageHead
        title={t('reports.title')}
        sub={rows ? <><Num>{hours(total)}</Num> {t('reports.hoursIn', { month: monthName(month) })}</> : undefined}
        accent={t('reports.accent')}
      />

      <div className={styles.reportDate}>
        <button type="button" className={styles.dayBtn} aria-label={t('reports.prevMonth')} onClick={() => setMonth(shiftMonth(month, -1))}><Icon name="chevronStart" size={26} stroke={2} /></button>
        <span>{monthName(month)}</span>
        <button type="button" className={styles.dayBtn} aria-label={t('reports.nextMonth')} disabled={month >= thisMonth} onClick={() => setMonth(shiftMonth(month, 1))}><Icon name="chevronEnd" size={26} stroke={2} /></button>
      </div>

      <div className={styles.filters}>
        <Field label={t('reports.sliceBy')}>
          <select className={styles.input} value={groupBy} onChange={e => setGroupBy(e.target.value as GroupBy)}>
            {Object.entries(GROUPINGS).map(([code, g]) => <option key={code} value={code}>{t(g.label)}</option>)}
          </select>
        </Field>
        <Field label={t('common.billingType')}>
          <select className={styles.input} value={billing} onChange={e => setBilling(e.target.value)}>
            <option value="">{t('common.all')}</option>
            {BILLING_TYPES.map(code => <option key={code} value={code}>{billingType(code)}</option>)}
            <option value={NOT_SET}>{t('common.notSet')}</option>
          </select>
        </Field>
        <Field label={t('reports.taskType')}>
          <select className={styles.input} value={taskType} onChange={e => setTaskType(e.target.value)}>
            <option value="">{t('common.all')}</option>
            {TASK_TYPES.map(code => <option key={code} value={code}>{taskTypeLabel(code)}</option>)}
            <option value={NOT_SET}>{t('common.notMarked')}</option>
          </select>
        </Field>
      </div>

      {!rows ? <Loading error={error} /> : rows.length === 0 ? (
        <p className={styles.quietLine}>{loaded?.length ? t('reports.noMatch') : t('reports.noHours')}</p>
      ) : (
        <>
          <div className={styles.cardGrid}>
            <div className={`${styles.cardCell} ${styles.centerCell}`}>
              <h2 className={styles.cellTitle}>{t('reports.total')}</h2>
              <span className={styles.bigNumber}><Num>{hours(total)}</Num></span>
              <span className={styles.cellSoft}>{t('reports.ofWhich')} <Num>{hours(billable)}</Num> {t('reports.billable')}</span>
            </div>
            <div className={styles.cardCell}>
              <h2 className={styles.cellTitle}>{t('reports.byBilling')}</h2>
              {split(rows, r => r.billingType, BILLING_TYPES, billingType, t('common.notSet')).map(s => (
                <div className={styles.splitLine} key={s.label}><span>{s.label}</span><b><Num>{hours(s.hours)}</Num></b></div>
              ))}
            </div>
            <div className={styles.cardCell}>
              <h2 className={styles.cellTitle}>{t('reports.byTask')}</h2>
              {split(rows, r => r.taskType, TASK_TYPES, taskTypeLabel, t('common.notMarked')).map(s => (
                <div className={styles.splitLine} key={s.label}><span>{s.label}</span><b><Num>{hours(s.hours)}</Num></b></div>
              ))}
            </div>
          </div>

          <div className={`${styles.tableHead} ${styles.hoursGrid}`} style={{ marginTop: 30 }}>
            <span>{t(GROUPINGS[groupBy].label)}</span><span>{t('common.hoursTitle')}</span><span>{t('common.billable')}</span>
          </div>
          {groups.map(group => (
            <div key={group.key}>
              <div className={`${styles.tableRow} ${styles.hoursGrid} ${styles.groupRow}`}>
                <span className={styles.cellName}>{group.label}</span>
                <span className={styles.monthHours}><Num>{hours(group.hours)}</Num></span>
                <span className={styles.monthHours}><Num>{hours(group.billable)}</Num></span>
              </div>
              {group.lines.map(line => (
                <div className={`${styles.tableRow} ${styles.hoursGrid} ${styles.lineRow}`} key={line.key}>
                  <span>{line.label}</span>
                  <span><Num>{hours(line.hours)}</Num></span>
                  <span><Num>{hours(line.billable)}</Num></span>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
