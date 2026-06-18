import type { Dict } from '../i18n';

interface Props {
  open: boolean;
  t: Dict;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Custom confirm modal (no browser confirm()) for delete actions. */
export function ConfirmDelete({ open, t, message, onCancel, onConfirm }: Props) {
  return (
    <div className={`modal-scrim ${open ? 'show' : ''}`} onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal" style={{ width: 380 }}>
        <div className="modal-head">
          <h3><span className="mh-ic">🗑</span><span>{message}</span></h3>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onCancel}>{t.cancel}</button>
          <button className="btn danger" onClick={onConfirm}>{t.delete}</button>
        </div>
      </div>
    </div>
  );
}
