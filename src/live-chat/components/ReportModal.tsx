/**
 * ReportModal — lightweight bug/task report from inside the live chat.
 *
 * Deliberately NOT the full board task form: title + details + optional
 * screenshots, everything else is filled automatically — the linked
 * message, a link to the conversation, agent + scenario, and the
 * reporter identity (the task board's "who are you" name, shared via
 * the same localStorage key the board uses).
 *
 * Screenshots are pasted (Ctrl+V) or attached, compressed client-side
 * and embedded in the task description as data-URL <img> tags — the
 * same convention the board's RichTextEditor uses, so they render (and
 * lightbox) on the board with zero server work.
 */
import { useEffect, useRef, useState } from 'react';
import { createTask, getAssignees } from '../../services/taskService';
import { getUserId } from '../../utils/userIdentifier';
import type { Dict } from '../i18n';
import { IconClose } from '../icons';

/** Same key the task board's "Who are you?" picker persists to. */
const IDENTITY_KEY = 'aspect_commenter_identity';

/** Deterministic dot colour per name — same idea as the board's
 *  assignee pills, so the chips read familiar. */
const DOT_COLORS = ['#22c55e', '#a3e635', '#3b82f6', '#ef4444', '#f97316', '#a855f7', '#06b6d4'];
function dotColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return DOT_COLORS[Math.abs(h) % DOT_COLORS.length];
}

interface Props {
  open: boolean;
  t: Dict;
  messageText: string;
  agentSlug: string;
  scenario: string;
  conversationId: number | null;
  onClose: () => void;
  onDone: (toast: string) => void;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Compress a pasted/attached image like the board's RichTextEditor
 *  does (canvas → jpeg) so descriptions stay a sane size. */
function compressImage(dataUrl: string, maxWidth = 1600, quality = 0.82): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ReportModal({ open, t, messageText, agentSlug, scenario, conversationId, onClose, onDone }: Props) {
  const [kind, setKind] = useState<'bug' | 'task'>('bug');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [shots, setShots] = useState<string[]>([]);
  const [reporter, setReporter] = useState<string>(() => {
    try { return localStorage.getItem(IDENTITY_KEY) ?? ''; } catch { return ''; }
  });
  // Board assignees for the "your name" chips. null = not available
  // (fetch failed / not loaded) → fall back to the stored identity,
  // read-only.
  const [names, setNames] = useState<string[] | null>(null);
  const fetchedRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || fetchedRef.current) return;
    fetchedRef.current = true;
    getAssignees()
      .then(list => setNames(list.map(a => a.name)))
      .catch(() => setNames(null));
  }, [open]);

  const ctx = messageText.slice(0, 200);

  const addImageFile = async (file: File) => {
    const raw = await fileToDataUrl(file);
    const compressed = await compressImage(raw);
    setShots(prev => [...prev, compressed]);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          void addImageFile(file);
        }
        return;
      }
    }
  };

  const buildDescription = (): string => {
    const convUrl = conversationId !== null
      ? `${window.location.origin}/${agentSlug}/live/c/${conversationId}`
      : null;

    let html = '';
    if (details.trim()) {
      html += `<div style="line-height:1.5;">${esc(details.trim()).replace(/\n/g, '<br>')}</div>`;
    }
    for (const src of shots) {
      html += `\n<img src="${src}" style="max-width:100%;border-radius:4px;margin:4px 0;">`;
    }
    html += `\n<hr style="border:none;border-top:1px solid #e2e8f0;margin:14px 0;">`;
    html += `\n<table style="border-collapse:collapse;">
<tr><td style="padding:3px 12px 3px 0;font-weight:600;">Agent</td><td style="padding:3px 0;">${esc(agentSlug)}</td></tr>
<tr><td style="padding:3px 12px 3px 0;font-weight:600;">Scenario</td><td style="padding:3px 0;">${esc(scenario)}</td></tr>`;
    if (convUrl) {
      html += `\n<tr><td style="padding:3px 12px 3px 0;font-weight:600;">Conversation</td><td style="padding:3px 0;"><a href="${convUrl}" style="color:#3b82f6;word-break:break-all;">${convUrl}</a></td></tr>`;
    }
    html += '\n</table>';
    if (ctx) {
      html += `\n<blockquote style="margin:10px 0 0 0;padding:10px 12px;background:#f8fafc;border-inline-start:3px solid #cbd5e1;border-radius:6px;font-size:13px;line-height:1.5;">${esc(ctx).replace(/\n/g, '<br>')}${messageText.length > 200 ? '…' : ''}</blockquote>`;
    }
    return html;
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const uid = getUserId();
      const name = reporter.trim();
      // Persist the name so the board (and the next report) knows it —
      // same key the board's "Who are you?" picker writes.
      if (name) {
        try { localStorage.setItem(IDENTITY_KEY, name); } catch { /* ignore */ }
      }
      await createTask({
        type: kind,
        title: title.trim() || (kind === 'bug' ? 'Lybi Live bug' : 'Lybi Live task'),
        description: buildDescription(),
        domain: 'general',
        tags: [agentSlug],
        createdBy: uid,
        opener: name || uid,
        isDraft: false,
      });
      onDone(kind === 'bug' ? t.bugCreated : t.taskCreated);
      setTitle('');
      setDetails('');
      setShots([]);
      setKind('bug');
    } catch {
      onDone(t.loadError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`modal-scrim ${open ? 'show' : ''}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" onPaste={onPaste}>
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
          {/* Reporter identity — the task board's assignees rendered as
              chips (same pick-don't-type model the board uses). Shares
              the board's "Who are you?" localStorage key. When the list
              isn't available, the stored identity shows read-only — no
              free-text name editing. */}
          <div className="field">
            <label>{t.yourName}</label>
            {names && names.length > 0 ? (
              <div className="name-chips">
                {names.map(n => (
                  <button
                    key={n}
                    type="button"
                    className={`name-chip ${reporter === n ? 'on' : ''}`}
                    onClick={() => setReporter(n)}
                  >
                    <span className="nc-dot" style={{ background: dotColor(n) }} />
                    {n}
                  </button>
                ))}
              </div>
            ) : (
              <div className="name-chips">
                <span className="name-chip static">
                  {reporter
                    ? <><span className="nc-dot" style={{ background: dotColor(reporter) }} />{reporter}</>
                    : t.yourNamePh}
                </span>
              </div>
            )}
          </div>
          <div className="field">
            <div className="attach-row">
              <button
                type="button"
                className="btn ghost"
                onClick={() => fileRef.current?.click()}
              >
                {t.attachShot}
              </button>
              <span className="attach-hint">{t.attachShotHint}</span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={e => {
                for (const f of Array.from(e.target.files ?? [])) void addImageFile(f);
                e.target.value = '';
              }}
            />
            {shots.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {shots.map((src, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={src} alt="" style={{ width: 84, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid rgba(0,0,0,0.12)' }} />
                    <button
                      type="button"
                      aria-label="remove screenshot"
                      onClick={() => setShots(prev => prev.filter((_, j) => j !== i))}
                      style={{
                        position: 'absolute', top: -6, insetInlineEnd: -6, width: 18, height: 18,
                        borderRadius: '50%', border: 'none', background: '#334155', color: '#fff',
                        fontSize: 11, lineHeight: '18px', padding: 0, cursor: 'pointer',
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
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
