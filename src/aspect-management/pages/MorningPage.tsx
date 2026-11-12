import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { firstName, longDate } from '../format';
import { Card, Icon, Loading, Page, Stat, adminUi } from '../ui';
import { useLoad } from '../useLoad';
import type { Alert, Person } from '../types';
import styles from '../management.module.css';

const ICON_BY_KIND: Record<Alert['kind'], string> = {
  late: 'clock',
  over: 'warning',
  near: 'warning',
  blocker: 'warning',
  no_report: 'clients',
  no_followup: 'quotes',
};

function targetPath({ type, id }: Alert['target']) {
  if (type === 'project') return `/management/projects?open=${id}`;
  if (type === 'quote') return `/management/quotes?open=${id}`;
  return `/management/team?person=${id}`;
}

/** 1. הבוקר שלך: one row per alert, one action each. */
export function MorningPage({ person }: { person: Person }) {
  const { data, error } = useLoad(api.morning);
  const navigate = useNavigate();

  const urgent = data?.alerts.filter(a => a.severity === 'action').length ?? 0;
  const attention = data ? data.alerts.length - urgent : 0;

  return (
    <Page title={`בוקר טוב, ${firstName(person.name)}`} sub={data ? longDate(data.today) : undefined}>
      {!data ? <Loading error={error} /> : (
        <>
          <div className={styles.stats}>
            <Stat label="דורש טיפול" value={urgent} late={urgent > 0} note="איחורים, חריגות ותקיעות" />
            <Stat label="לשים לב" value={attention} note="דיווחים ומעקבים" />
            <Stat label="לקוחות" value={data.clientCount} />
          </div>

          {data.alerts.length === 0 ? (
            <Card>
              <div className={styles.empty}>
                <span className={`${styles.badge} ${styles.badgeOk} ${styles.badgeLarge}`}><Icon name="check" size={28} /></span>
                <p className={styles.emptyTitle}>הכל במסלול</p>
                <p className={styles.emptyText}>אין היום שום דבר שמחכה לך.</p>
              </div>
            </Card>
          ) : (
            <Card title="מחכה לך היום" note={`${data.alerts.length} פריטים`}>
              {data.alerts.map((alert, index) => (
                <div className={styles.row} key={index}>
                  <span className={`${styles.badge} ${alert.severity === 'action' ? styles.badgeAction : styles.badgeAttention}`}>
                    <Icon name={ICON_BY_KIND[alert.kind]} size={20} />
                  </span>
                  <div className={styles.rowBody}>
                    <span className={styles.rowName}>{alert.name}</span>
                    <span className={styles.rowLine}>{alert.line}</span>
                  </div>
                  {alert.detail && <span className={styles.rowDetail}>{alert.detail}</span>}
                  <button
                    type="button"
                    className={alert.severity === 'action' ? `${adminUi.btn} ${adminUi.btnPrimary}` : adminUi.btn}
                    onClick={() => navigate(targetPath(alert.target))}
                  >
                    {alert.action}
                  </button>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </Page>
  );
}
