import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useText } from '../format';
import { Dialog, Icon, Loading, Num, PageHead } from '../ui';
import { useLoad } from '../useLoad';
import type { PersonWithHours } from '../types';
import styles from '../ledger.module.css';

/** צוות: who reported what. Opening a person shows their last two weeks. */
export function TeamPage() {
  const { data: people, error } = useLoad(api.people);
  const [picked, setPicked] = useState<PersonWithHours | null>(null);
  const [params, setParams] = useSearchParams();
  const { t, hours, hoursText, shortDate } = useText();

  // Arriving from a morning alert opens that person.
  const open = picked ?? people?.find(p => p.id === Number(params.get('person')));
  const close = () => {
    setPicked(null);
    setParams({}, { replace: true });
  };

  const team = people?.filter(p => p.active && p.role === 'developer');

  return (
    <div className={styles.page}>
      <PageHead title={t('team.title')} sub={team ? t('team.count', { n: team.length }) : undefined} accent={t('team.accent')} />
      {!team ? <Loading error={error} /> : team.length === 0 ? <p className={styles.quietLine}>{t('team.empty')}</p> : (
        <>
          <div className={`${styles.tableHead} ${styles.teamGrid}`}>
            <span>{t('team.name')}</span><span>{t('team.previousWorkday')}</span><span>{t('common.hoursThisMonth')}</span><span>{t('team.lastReport')}</span><span />
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
                  : <span className={styles.highlight}>{t('team.notReported')}</span>}
              </span>
              <span className={styles.monthHours}><Num>{hours(person.hoursThisMonth)}</Num></span>
              <span>{person.lastReportDate ? <Num>{shortDate(person.lastReportDate)}</Num> : '—'}</span>
              <span className={person.hoursPreviousWorkday > 0 ? styles.statusOk : styles.statusLate}>
                <Icon name={person.hoursPreviousWorkday > 0 ? 'check' : 'alert'} size={22} stroke={2.4} />
              </span>
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
  const { t, hoursText, longDate, taskType } = useText();

  const days = data ? [...new Set([...data.entries, ...data.blockers].map(x => x.date))].sort().reverse() : [];

  return (
    <Dialog title={person.name} onClose={onClose}>
      {!data ? <Loading error={error} /> : days.length === 0 ? <p className={styles.quietLine}>{t('team.noReports')}</p> : (
        days.map(day => (
          <div className={styles.dayBlock} key={day}>
            <div className={styles.dayTitle}>{longDate(day)}</div>
            {data.entries.filter(e => e.date === day).map(entry => (
              <div key={entry.id}>
                {entry.start && <><Num>{entry.start}–{entry.end}</Num>, </>}
                {hoursText(entry.hours)}, {entry.clientName ?? t('common.internal')}
                {entry.projectName && ` (${entry.projectName})`}: {entry.description}
                {(entry.taskType || !entry.billable) && (
                  <span className={styles.cellSoft}>
                    {[entry.taskType && taskType(entry.taskType), !entry.billable && t('common.notBillable')].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
            ))}
            {data.blockers.filter(b => b.date === day).map(blocker => (
              <div key={blocker.body} className={styles.ageLate}>{t('alert.blocker', { body: blocker.body })}</div>
            ))}
          </div>
        ))
      )}
    </Dialog>
  );
}
