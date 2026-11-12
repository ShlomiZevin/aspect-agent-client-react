import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { hours, hoursText, shortDate } from '../format';
import { Card, Loading, Num, Page, Tag, adminUi, type Tone } from '../ui';
import { useLoad } from '../useLoad';
import type { ClientCard, Person } from '../types';
import { ClientDialog } from './ClientsPage';
import { ProjectStatus } from './ProjectsPage';
import styles from '../management.module.css';

const SERVICE_TONE: Record<string, Tone> = { 'פעיל': 'ok', 'בהטמעה': 'wait' };

function HoursRing({ used, total }: { used: number; total: number | null }) {
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const share = total ? Math.min(used / total, 1) : 0;
  const over = total !== null && used > total;
  return (
    <svg className={styles.ring} width="160" height="160" viewBox="0 0 160 160" role="img" aria-label={`${hours(used)} שעות`}>
      <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--surface-light)" strokeWidth="11" />
      <circle
        cx="80" cy="80" r={radius} fill="none"
        stroke={over ? 'var(--error-color)' : 'var(--primary-color)'}
        strokeWidth="11"
        strokeDasharray={`${share * circumference} ${circumference}`}
        strokeLinecap="round"
        transform="rotate(-90 80 80)"
      />
      <text x="80" y={total === null ? 90 : 82} className={styles.ringNumber}>{hours(used)}</text>
      {total !== null && <text x="80" y="104" className={styles.ringOf}>מתוך {hours(total)}</text>}
    </svg>
  );
}

/** 3. לקוח: everything about one client on one page. The owner edits in a modal. */
export function ClientCardPage({ person }: { person: Person }) {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => api.client(Number(id)), [id]);
  const { data: client, error, reload } = useLoad(load);
  const [editing, setEditing] = useState(false);

  const crumbs = <span className={styles.crumbs}><Link to="/management/clients">לקוחות</Link> › {client?.name ?? '…'}</span>;

  if (!client) return <Page title={crumbs}><Loading error={error} /></Page>;

  return (
    <Page
      title={(
        <span className={styles.clientTitle}>
          <span className={styles.clientLogo}>
            {client.logoUrl ? <img src={client.logoUrl} alt="" /> : client.name.charAt(0)}
          </span>
          {client.name}
        </span>
      )}
      sub={crumbs}
      action={<button type="button" className={`${adminUi.btn} ${adminUi.btnPrimary}`} onClick={() => setEditing(true)}>עריכה</button>}
    >
      <div className={styles.grid3}>
        <Card title="שעות החודש" note={client.packageHours === null ? 'אין חבילה חודשית' : undefined}>
          <div className={styles.cardBody}><HoursRing used={client.hoursThisMonth} total={client.packageHours} /></div>
        </Card>
        <Card title="שירותים">
          <div className={styles.cardBody}>
            {client.services.length === 0 ? <span className={styles.cellSoft}>אין שירותים</span> : (
              <div className={styles.services}>
                {client.services.map(service => (
                  <div className={styles.serviceLine} key={service.name}>
                    <span>{service.name}</span>
                    <Tag tone={SERVICE_TONE[service.status] ?? 'plain'}>{service.status}</Tag>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
        <Card title="פתוחים">
          <div className={styles.cardBody}>
            <span className={client.openItems > 0 ? `${styles.bigNumber} ${styles.bigNumberLate}` : styles.bigNumber}>{client.openItems}</span>
            <span className={styles.cellSoft}>פרויקטים פעילים והצעות מחיר פתוחות</span>
          </div>
        </Card>
      </div>

      <div className={styles.grid2}>
        <Card title="הבא בתור">
          <div className={styles.cardBody}>
            {client.nextStep ? (
              <>
                <div className={styles.nextStep}>{client.nextStep}</div>
                {client.nextStepDate && <span className={styles.cellSoft}><Num>{shortDate(client.nextStepDate)}</Num></span>}
              </>
            ) : <span className={styles.cellSoft}>עוד לא נקבע</span>}
          </div>
        </Card>
        <Card title="הערה אחרונה">
          <div className={styles.cardBody}>
            {client.lastNote ? (
              <>
                <div className={styles.noteText}>{client.lastNote.body}</div>
                <span className={styles.cellSoft}>
                  <Num>{shortDate(client.lastNote.date)}</Num>
                  {client.lastNote.personName && `, ${client.lastNote.personName}`}
                </span>
              </>
            ) : <span className={styles.cellSoft}>אין עדיין</span>}
          </div>
        </Card>
      </div>

      <Card title="פרויקטים" note={`${client.projects.length} פרויקטים`}>
        {client.projects.length === 0 ? <p className={styles.quietLine}>אין פרויקטים.</p> : (
          client.projects.map(project => (
            <div className={styles.row} key={project.id}>
              <div className={styles.rowBody}>
                <Link to={`/management/projects?open=${project.id}`} className={styles.rowName}>{project.name}</Link>
                <span className={styles.rowLine}>
                  {hoursText(project.hoursUsed)}
                  {project.hoursBudget !== null && <> מתוך <Num>{hours(project.hoursBudget)}</Num></>}
                </span>
              </div>
              <ProjectStatus project={project} />
            </div>
          ))
        )}
      </Card>

      {editing && (
        <ClientDialog
          title={client.name}
          initial={toDraft(client)}
          showNote
          onSave={async (draft, note) => {
            await api.updateClient(client.id, draft);
            if (note.trim()) await api.addClientNote(client.id, note, person.id);
          }}
          onClose={() => setEditing(false)}
          onDone={() => { setEditing(false); reload(); }}
        />
      )}
    </Page>
  );
}

const toDraft = (client: ClientCard) => ({
  name: client.name,
  logoUrl: client.logoUrl,
  packageHours: client.packageHours === null ? '' : String(client.packageHours),
  services: client.services,
  nextStep: client.nextStep,
  nextStepDate: client.nextStepDate,
});
