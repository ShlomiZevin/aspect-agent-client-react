import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { firstName, longDate } from '../format';
import { Icon, Loading } from '../ui';
import { useLoad } from '../useLoad';
import type { Alert, Person } from '../types';
import styles from '../ledger.module.css';

const ICON_BY_KIND: Record<Alert['kind'], string> = {
  late: 'clock',
  over: 'warning',
  near: 'warning',
  blocker: 'warning',
  no_report: 'clients',
  no_followup: 'quotes',
};

function targetPath({ type, id }: Alert['target']) {
  if (type === 'project') return `/aspect/management/projects?open=${id}`;
  if (type === 'quote') return `/aspect/management/quotes?open=${id}`;
  return `/aspect/management/team?person=${id}`;
}

/** 1. הבוקר שלך: one row per alert, one action each. No charts. */
export function MorningPage({ person }: { person: Person }) {
  const { data, error } = useLoad(api.morning);
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      {data && <div className={styles.dateLine}>{longDate(data.today)}</div>}
      <h1 className={styles.title}>
        בוקר טוב <span className={styles.greetingName}>{firstName(person.name)}</span>
      </h1>

      {!data ? <Loading error={error} /> : data.alerts.length === 0 ? (
        <div className={styles.onTrack} style={{ marginTop: 30 }}>
          <span className={`${styles.dot} ${styles.dotOk}`}><Icon name="check" size={28} /></span>
          <span className={styles.onTrackText}>הכל במסלול</span>
          <span className={styles.bigStat}>
            <span className={styles.bigNumber}>{data.clientCount}</span>
            לקוחות
          </span>
        </div>
      ) : (
        <>
          <h2 className={styles.sectionTitle} style={{ marginTop: 26 }}>מחכה לך היום</h2>
          <div className={styles.rows}>
            {data.alerts.map((alert, index) => (
              <div className={styles.row} key={index}>
                <span className={`${styles.dot} ${alert.severity === 'action' ? styles.dotAction : styles.dotAttention}`}>
                  <Icon name={ICON_BY_KIND[alert.kind]} size={26} />
                </span>
                <div className={styles.rowBody}>
                  <span className={styles.rowName}>{alert.name}</span>
                  <span className={styles.rowLine}>{alert.line}</span>
                </div>
                {alert.detail && <span className={styles.rowDetail}>{alert.detail}</span>}
                <button
                  type="button"
                  className={`${styles.btnAction} ${styles[`btnAction_${alert.severity}`]}`}
                  onClick={() => navigate(targetPath(alert.target))}
                >
                  {alert.action}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
