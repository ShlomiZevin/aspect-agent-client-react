import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { Dialog, DialogForm, Field, Icon, Loading, Num, PageHead, Tag } from '../ui';
import { useLoad } from '../useLoad';
import { daysText } from '../format';
import type { Project, ProjectDraft } from '../types';
import styles from '../ledger.module.css';

export function ProjectStatus({ project }: { project: Project }) {
  if (project.status === 'done') return <Tag>הסתיים</Tag>;
  if (!project.late && !project.over && !project.near) return <Tag tone="ok"><Icon name="check" size={16} stroke={2.4} /> בזמן</Tag>;
  return (
    <div>
      <div className={styles.tags}>
        {project.late && <Tag tone="late"><Icon name="warning" size={16} stroke={2.2} /> באיחור</Tag>}
        {project.over && <Tag tone="late"><Icon name="warning" size={16} stroke={2.2} /> חריגה מתקציב</Tag>}
        {project.near && <Tag tone="wait">קרוב לתקציב</Tag>}
      </div>
      {project.late && <span className={styles.lateDays}>{daysText(project.lateDays)} באיחור</span>}
    </div>
  );
}

function HoursBar({ project }: { project: Project }) {
  if (project.pct === null) return <span className={styles.cellSoft}>אין תקציב שעות</span>;
  const tone = project.late || project.over ? styles.barFillLate : project.near ? styles.barFillNear : '';
  return (
    <div className={styles.bar}>
      <span className={styles.barPct}><Num>{project.pct}%</Num></span>
      <div className={styles.barTrack}>
        <div className={`${styles.barFill} ${tone}`} style={{ width: `${Math.min(project.pct, 100)}%` }} />
      </div>
    </div>
  );
}

const emptyDraft: ProjectDraft = { clientId: '', name: '', hoursBudget: '', dueDate: '', status: 'active', amount: '' };

/** 4. פרויקטים: one row per active project. */
export function ProjectsPage() {
  const { data: projects, error, reload } = useLoad(api.projects);
  const [picked, setPicked] = useState<{ project: Project | null } | null>(null);
  const [params, setParams] = useSearchParams();

  // Arriving from a morning alert or a client card opens that project.
  const fromLink = projects?.find(p => p.id === Number(params.get('open')));
  const dialog = picked ?? (fromLink ? { project: fromLink } : null);
  const close = () => {
    setPicked(null);
    setParams({}, { replace: true });
  };

  return (
    <div className={styles.page}>
      <PageHead
        title="פרויקטים פעילים"
        sub={projects ? `${projects.length} פרויקטים` : undefined}
        accent="לעמוד בזמנים!"
        action={<button type="button" className={styles.btnPrimary} onClick={() => setPicked({ project: null })}><Icon name="plus" size={22} stroke={2.2} /> פרויקט חדש</button>}
      />
      {!projects ? <Loading error={error} /> : projects.length === 0 ? <p className={styles.quietLine}>אין פרויקטים פעילים.</p> : (
        <div className={styles.ruled}>
          <div className={`${styles.tableHead} ${styles.projectsGrid}`}>
            <span>לקוח</span><span>סוג</span><span>ניצול שעות</span><span>סטטוס</span>
          </div>
          {projects.map(project => (
            <div
              key={project.id}
              className={`${styles.tableRow} ${styles.projectsGrid} ${styles.rowLink}`}
              role="button"
              tabIndex={0}
              onClick={() => setPicked({ project })}
              onKeyDown={e => { if (e.key === 'Enter') setPicked({ project }); }}
            >
              <span className={styles.cellName}>{project.clientName}</span>
              <span className={styles.typeCell}><Icon name="chart" size={26} />{project.name}</span>
              <HoursBar project={project} />
              <ProjectStatus project={project} />
            </div>
          ))}
        </div>
      )}
      {dialog && (
        <ProjectDialog
          projectId={dialog.project?.id}
          initial={dialog.project ? toDraft(dialog.project) : emptyDraft}
          onClose={close}
          onDone={() => { close(); reload(); }}
        />
      )}
    </div>
  );
}

const toDraft = (project: Project): ProjectDraft => ({
  clientId: project.clientId,
  name: project.name,
  hoursBudget: project.hoursBudget === null ? '' : String(project.hoursBudget),
  dueDate: project.dueDate ?? '',
  status: project.status,
  amount: project.amount === null ? '' : String(project.amount),
});

export function ProjectDialog({ projectId, initial, onClose, onDone }: {
  projectId?: number;
  initial: ProjectDraft;
  onClose: () => void;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const set = (change: Partial<ProjectDraft>) => setDraft(current => ({ ...current, ...change }));
  const { data: clients } = useLoad(api.clients);
  const save = useCallback(
    () => (projectId ? api.updateProject(projectId, draft) : api.createProject(draft)),
    [projectId, draft],
  );

  return (
    <Dialog title={projectId ? draft.name : 'פרויקט חדש'} onClose={onClose}>
      <DialogForm onSave={save} onDone={onDone} onCancel={onClose}>
        <Field label="לקוח">
          <select className={styles.input} value={draft.clientId} onChange={e => set({ clientId: Number(e.target.value) || '' })}>
            <option value="">בחירה</option>
            {clients?.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </Field>
        <Field label="שם או סוג הפרויקט">
          <input className={styles.input} value={draft.name} onChange={e => set({ name: e.target.value })} />
        </Field>
        <div className={styles.formRow}>
          <Field label="תקציב שעות">
            <input className={styles.input} type="number" min="0" step="0.5" value={draft.hoursBudget} onChange={e => set({ hoursBudget: e.target.value })} />
          </Field>
          <Field label="תאריך יעד">
            <input className={styles.input} type="date" value={draft.dueDate} onChange={e => set({ dueDate: e.target.value })} />
          </Field>
        </div>
        <div className={styles.formRow}>
          <Field label="סכום (₪)">
            <input className={styles.input} type="number" min="0" value={draft.amount} onChange={e => set({ amount: e.target.value })} />
          </Field>
          <Field label="סטטוס">
            <select className={styles.input} value={draft.status} onChange={e => set({ status: e.target.value as ProjectDraft['status'] })}>
              <option value="active">פעיל</option>
              <option value="done">הסתיים</option>
            </select>
          </Field>
        </div>
      </DialogForm>
    </Dialog>
  );
}
