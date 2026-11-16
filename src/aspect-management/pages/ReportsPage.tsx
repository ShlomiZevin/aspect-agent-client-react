import { useCallback, useMemo, useState } from 'react';
import { api } from '../api';
import { BILLING_TYPES, TASK_TYPES, hours, monthName, shiftMonth, todayInIsrael } from '../format';
import { Field, Icon, Loading, Num, PageHead } from '../ui';
import { useLoad } from '../useLoad';
import type { MonthHoursRow } from '../types';
import styles from '../ledger.module.css';

type GroupBy = 'person' | 'client' | 'project';

/** A filter's value for "not set"; '' means no filter. */
const NOT_SET = 'none';

const clientAndProject = (r: MonthHoursRow) =>
  r.clientName ? `${r.clientName} · ${r.projectName ?? 'ללא פרויקט'}` : 'פנימי';

/** What each slicing groups by, and what one line under a group is. */
const GROUPINGS: Record<GroupBy, {
  label: string;
  group: (r: MonthHoursRow) => [string, string];
  line: (r: MonthHoursRow) => [string, string];
}> = {
  person: {
    label: 'מפתח',
    group: r => [`${r.personId}`, r.personName],
    line: r => [`${r.clientId}-${r.projectId}`, clientAndProject(r)],
  },
  client: {
    label: 'לקוח',
    group: r => [`${r.clientId}`, r.clientName ?? 'פנימי'],
    line: r => [`${r.projectId}-${r.personId}`, r.projectName ? `${r.projectName} · ${r.personName}` : r.personName],
  },
  project: {
    label: 'פרויקט',
    group: r => [`${r.clientId}-${r.projectId}`, clientAndProject(r)],
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

function groupRows(rows: MonthHoursRow[], groupBy: GroupBy): Group[] {
  const { group, line } = GROUPINGS[groupBy];
  const groups = new Map<string, Group & { byLine: Map<string, Sum> }>();
  for (const row of rows) {
    const [groupKey, groupLabel] = group(row);
    const [lineKey, lineLabel] = line(row);
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

/** Hours per code, in the order of `labels`, then "not set" if any. */
function split(rows: MonthHoursRow[], pick: (r: MonthHoursRow) => string | null, labels: Record<string, string>, notSet: string) {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(pick(row) ?? NOT_SET, (totals.get(pick(row) ?? NOT_SET) ?? 0) + row.hours);
  return [...Object.entries(labels), [NOT_SET, notSet]]
    .filter(([code]) => totals.has(code))
    .map(([code, label]) => ({ label, hours: totals.get(code)! }));
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

  // While the next month loads, `data` is still the month before.
  const loaded = data?.month === month ? data.rows : null;
  const rows = useMemo(() => loaded?.filter(r =>
    (!billing || (r.billingType ?? NOT_SET) === billing) && (!taskType || (r.taskType ?? NOT_SET) === taskType),
  ) ?? null, [loaded, billing, taskType]);
  const groups = useMemo(() => (rows ? groupRows(rows, groupBy) : []), [rows, groupBy]);
  const total = rows?.reduce((sum, r) => sum + r.hours, 0) ?? 0;
  const billable = rows?.reduce((sum, r) => sum + r.billableHours, 0) ?? 0;

  return (
    <div className={styles.page}>
      <PageHead
        title="דוחות שעות"
        sub={rows ? <><Num>{hours(total)}</Num> שעות ב{monthName(month)}</> : undefined}
        accent="הכל רשום!"
      />

      <div className={styles.reportDate}>
        <button type="button" className={styles.dayBtn} aria-label="החודש הקודם" onClick={() => setMonth(shiftMonth(month, -1))}><Icon name="chevronStart" size={26} stroke={2} /></button>
        <span>{monthName(month)}</span>
        <button type="button" className={styles.dayBtn} aria-label="החודש הבא" disabled={month >= thisMonth} onClick={() => setMonth(shiftMonth(month, 1))}><Icon name="chevronEnd" size={26} stroke={2} /></button>
      </div>

      <div className={styles.filters}>
        <Field label="פילוח לפי">
          <select className={styles.input} value={groupBy} onChange={e => setGroupBy(e.target.value as GroupBy)}>
            {Object.entries(GROUPINGS).map(([code, g]) => <option key={code} value={code}>{g.label}</option>)}
          </select>
        </Field>
        <Field label="סוג תשלום">
          <select className={styles.input} value={billing} onChange={e => setBilling(e.target.value)}>
            <option value="">הכל</option>
            {Object.entries(BILLING_TYPES).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            <option value={NOT_SET}>לא הוגדר</option>
          </select>
        </Field>
        <Field label="סוג משימה">
          <select className={styles.input} value={taskType} onChange={e => setTaskType(e.target.value)}>
            <option value="">הכל</option>
            {Object.entries(TASK_TYPES).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            <option value={NOT_SET}>לא סומן</option>
          </select>
        </Field>
      </div>

      {!rows ? <Loading error={error} /> : rows.length === 0 ? (
        <p className={styles.quietLine}>{loaded?.length ? 'אין שעות שמתאימות לסינון.' : 'אין שעות בחודש הזה.'}</p>
      ) : (
        <>
          <div className={styles.cardGrid}>
            <div className={`${styles.cardCell} ${styles.centerCell}`}>
              <h2 className={styles.cellTitle}>סה״כ</h2>
              <span className={styles.bigNumber}><Num>{hours(total)}</Num></span>
              <span className={styles.cellSoft}>מתוכן <Num>{hours(billable)}</Num> לחיוב</span>
            </div>
            <div className={styles.cardCell}>
              <h2 className={styles.cellTitle}>לפי סוג תשלום</h2>
              {split(rows, r => r.billingType, BILLING_TYPES, 'לא הוגדר').map(s => (
                <div className={styles.splitLine} key={s.label}><span>{s.label}</span><b><Num>{hours(s.hours)}</Num></b></div>
              ))}
            </div>
            <div className={styles.cardCell}>
              <h2 className={styles.cellTitle}>לפי סוג משימה</h2>
              {split(rows, r => r.taskType, TASK_TYPES, 'לא סומן').map(s => (
                <div className={styles.splitLine} key={s.label}><span>{s.label}</span><b><Num>{hours(s.hours)}</Num></b></div>
              ))}
            </div>
          </div>

          <div className={`${styles.tableHead} ${styles.hoursGrid}`} style={{ marginTop: 30 }}>
            <span>{GROUPINGS[groupBy].label}</span><span>שעות</span><span>לחיוב</span>
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
