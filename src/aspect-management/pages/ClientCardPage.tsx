import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { hours, hoursText, shortDate } from '../format';
import { Loading, Num, Tag, type Tone } from '../ui';
import { useLoad } from '../useLoad';
import type { ClientCard, Person } from '../types';
import { ClientDialog } from './ClientsPage';
import { ProjectStatus } from './ProjectsPage';
import styles from '../ledger.module.css';

const SERVICE_TONE: Record<string, Tone> = { 'פעיל': 'ok', 'בהטמעה': 'wait' };

function HoursRing({ used, total }: { used: number; total: number | null }) {
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const share = total ? Math.min(used / total, 1) : 0;
  const over = total !== null && used > total;
  return (
    <svg className={styles.ring} width="160" height="160" viewBox="0 0 160 160" role="img" aria-label={`${hours(used)} שעות`}>
      <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--paper-2)" strokeWidth="11" />
      <circle
        cx="80" cy="80" r={radius} fill="none"
        stroke={over ? 'var(--oxblood)' : 'var(--forest)'}
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

  if (!client) return <div className={styles.page}><Loading error={error} /></div>;

  return (
    <div className={styles.page}>
      <div className={styles.crumbs}><Link to="/aspect/management/clients">לקוחות</Link> › {client.name}</div>
      <div className={styles.clientHead}>
        <div className={styles.logo}>
          {client.logoUrl ? <img src={client.logoUrl} alt="" /> : client.name.charAt(0)}
        </div>
        <h1 className={styles.title} style={{ flex: 1 }}>{client.name}</h1>
        <button type="button" className={styles.btnPrimary} onClick={() => setEditing(true)}>עריכה</button>
      </div>

      <div className={styles.cardGrid}>
        <section className={styles.cardCell}>
          <h2 className={styles.cellTitle}>שעות החודש</h2>
          <HoursRing used={client.hoursThisMonth} total={client.packageHours} />
        </section>
        <section className={styles.cardCell}>
          <h2 className={styles.cellTitle}>שירותים</h2>
          {client.services.length === 0 ? <span className={styles.quietLine}>—</span> : (
            <div className={styles.services}>
              {client.services.map(service => (
                <div className={styles.serviceLine} key={service.name}>
                  <span>{service.name}</span>
                  <Tag tone={SERVICE_TONE[service.status] ?? 'plain'}>{service.status}</Tag>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className={styles.cardCell}>
          <h2 className={styles.cellTitle}>פתוחים</h2>
          <div className={styles.bigRed}>{client.openItems}</div>
          <span className={styles.cellSoft}>פרויקטים פעילים והצעות מחיר פתוחות</span>
        </section>
      </div>

      <div className={styles.cardGrid} style={{ gridTemplateColumns: '1fr 1fr' }}>
        <section className={styles.cardCell}>
          <h2 className={styles.cellTitle}>הבא בתור</h2>
          {client.nextStep ? (
            <>
              <div className={styles.nextStep}>{client.nextStep}</div>
              {client.nextStepDate && <span className={styles.cellSoft}><Num>{shortDate(client.nextStepDate)}</Num></span>}
            </>
          ) : <span className={styles.cellSoft}>עוד לא נקבע</span>}
        </section>
        <section className={styles.cardCell}>
          <h2 className={styles.cellTitle}>הערה אחרונה</h2>
          {client.lastNote ? (
            <>
              <div>{client.lastNote.body}</div>
              <span className={styles.cellSoft}>
                <Num>{shortDate(client.lastNote.date)}</Num>
                {client.lastNote.personName && `, ${client.lastNote.personName}`}
              </span>
            </>
          ) : <span className={styles.cellSoft}>אין עדיין</span>}
        </section>
      </div>

      <section className={styles.cardFoot}>
        <h2 className={styles.sectionTitle}>פרויקטים</h2>
        {client.projects.length === 0 ? <p className={styles.quietLine}>אין פרויקטים.</p> : (
          <div className={styles.rows}>
            {client.projects.map(project => (
              <div className={styles.row} key={project.id}>
                <div className={styles.rowBody}>
                  <Link to={`/aspect/management/projects?open=${project.id}`} className={styles.rowName}>{project.name}</Link>
                  <span className={styles.rowLine}>
                    {hoursText(project.hoursUsed)}
                    {project.hoursBudget !== null && <> מתוך <Num>{hours(project.hoursBudget)}</Num></>}
                  </span>
                </div>
                <ProjectStatus project={project} />
              </div>
            ))}
          </div>
        )}
      </section>

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
    </div>
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
