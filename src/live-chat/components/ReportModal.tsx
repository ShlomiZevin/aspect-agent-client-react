import { useState } from 'react';
import { createTask } from '../../services/taskService';
import { getUserId } from '../../utils/userIdentifier';
import type { Dict } from '../i18n';
import { IconClose } from '../icons';

interface Props {
  open: boolean;
  t: Dict;
  messageText: string;
  agentSlug: string;
  scenario: string;
  onClose: () => void;
  onDone: (toast: string) => void;
}

export function ReportModal({ open, t, messageText, agentSlug, scenario, onClose, onDone }: Props) {
  const [kind, setKind] = useState<'bug' | 'task'>('bug');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const ctx = messageText.slice(0, 200);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const uid = getUserId();
      const description = [
        details.trim(),
        '',
        `— Linked message: "${ctx}"`,
        `— Agent: ${agentSlug} · Scenario: ${scenario}`,
        `— URL: ${typeof window !== 'undefined' ? window.location.href : ''}`,
      ].join('\n');
      await createTask({
        type: kind,
        title: title.trim() || (kind === 'bug' ? 'Lybi Live bug' : 'Lybi Live task'),
        description,
        domain: 'lybi',
        tags: ['lybi-live'],
        createdBy: uid,
        opener: uid,
        isDraft: false,
      });
      onDone(kind === 'bug' ? t.bugCreated : t.taskCreated);
      setTitle('');
      setDetails('');
      setKind('bug');
    } catch {
      onDone(t.loadError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`modal-scrim ${open ? 'show' : ''}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-head">
          <h3><span className="mh-ic">{kind === 'bug' ? '🐞' : '✓'}</span><span>{kind === 'bug' ? t.reportBug : t.reportTask}</span></h3>
          <button className="icon-btn" onClick={onClose}><IconClose size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="seg">
            <button className={`grad ${kind === 'bug' ? 'on' : ''}`} onClick={() => setKind('bug')}>🐞 {t.bug}</button>
            <button className={`grad ${kind === 'task' ? 'on' : ''}`} onClick={() => setKind('task')}>✓ {t.task}</button>
          </div>
          <div>
            <label className="field-lbl" style={{ fontSize: 12.5, fontWeight: 700, display: 'block', marginBottom: 6 }}>{t.linkedMsg}</label>
            <div className="ctx-quote">{ctx || '—'}…</div>
          </div>
          <div className="field">
            <label>{t.title}</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t.titlePh} />
          </div>
          <div className="field">
            <label>{t.details}</label>
            <textarea value={details} onChange={e => setDetails(e.target.value)} placeholder={t.detailsPh} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>{t.cancel}</button>
          <button className="btn primary" onClick={submit} disabled={submitting}>
            {kind === 'bug' ? t.createBug : t.createTask}
          </button>
        </div>
      </div>
    </div>
  );
}
