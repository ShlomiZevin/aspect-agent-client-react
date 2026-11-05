import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { hoursText, longDate, shortDate } from '../format';
import { Dialog, Loading, Num, PageHead, Tag } from '../ui';
import { useLoad } from '../useLoad';
import type { PersonWithHours } from '../types';
import styles from '../ledger.module.css';

/** צוות: who reported what. Opening a person shows their last two weeks. */
export function TeamPage() {
  const { data: people, error } = useLoad(api.people);
  const [picked, setPicked] = useState<PersonWithHours | null>(null);
  const [params, setParams] = useSearchParams();

  // Arriving from a morning alert opens that person.
  const open = picked ?? people?.find(p => p.id === Number(params.get('person')));
  const close = () => {
    setPicked(null);
    setParams({}, { replace: true });
  };

  const team = people?.filter(p => p.active && p.role === 'developer');

  return (
    <div className={styles.page}>
      <PageHead title="צוות" sub={team ? `${team.length} מפתחים` : undefined} accent="כל הכבוד לצוות!" />
      {!team ? <Loading error={error} /> : team.length === 0 ? <p className={styles.quietLine}>עוד אין מפתחים. מוסיפים אותם בהגדרות.</p> : (
        <>
          <div className={`${styles.tableHead} ${styles.teamGrid}`}>
            <span>שם</span><span>יום העבודה הקודם</span><span>החודש</span><span>דיווח אחרון</span>
          </div>
          {team.map(person => (
            <div
              key={person.id}
              className={`${styles.tableRow} ${styles.teamGrid} ${styles.rowLink}`}
              role="button"
              tabIndex={0}
              onClick={() => setPicked(person)}
              onKeyDown={e => { if (e.key === 'Enter') setPicked(person); }}
            >
              <span className={styles.cellName}>{person.name}</span>
              <span>
                {person.hoursPreviousWorkday > 0
                  ? hoursText(person.hoursPreviousWorkday)
                  : <Tag tone="wait">לא דיווח</Tag>}
              </span>
              <span>{hoursText(person.hoursThisMonth)}</span>
              <span>{person.lastReportDate ? <Num>{shortDate(person.lastReportDate)}</Num> : '—'}</span>
            </div>
          ))}
        </>
      )}
      {open && <PersonDialog person={open} onClose={close} />}
    </div>
  );
}

function PersonDialog({ person, onClose }: { person: PersonWithHours; onClose: () => void }) {
  const load = useCallback(() => api.personReports(person.id), [person.id]);
  const { data, error } = useLoad(load);

  const days = data ? [...new Set([...data.entries, ...data.blockers].map(x => x.date))].sort().reverse() : [];

  return (
    <Dialog title={person.name} onClose={onClose}>
      {!data ? <Loading error={error} /> : days.length === 0 ? <p className={styles.quietLine}>אין דיווחים בשבועיים האחרונים.</p> : (
        days.map(day => (
          <div className={styles.dayBlock} key={day}>
            <div className={styles.dayTitle}>{longDate(day)}</div>
            {data.entries.filter(e => e.date === day).map(entry => (
              <div key={entry.id}>
                {hoursText(entry.hours)}, {entry.clientName ?? 'פנימי'}
                {entry.projectName && ` (${entry.projectName})`}: {entry.description}
                {!entry.billable && <span className={styles.cellSoft}>לא לחיוב</span>}
              </div>
            ))}
            {data.blockers.filter(b => b.date === day).map(blocker => (
              <div key={blocker.body} className={styles.ageLate}>משהו תקוע: {blocker.body}</div>
            ))}
          </div>
        ))
      )}
    </Dialog>
  );
}
