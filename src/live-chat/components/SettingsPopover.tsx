import { useEffect } from 'react';
import type { Dict } from '../i18n';
import type { LiveSettings } from '../useLiveSettings';
import { CLIENTS } from '../liveConfig';

interface Props {
  open: boolean;
  t: Dict;
  settings: LiveSettings;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onChange: (patch: Partial<LiveSettings>) => void;
  onOpenBranding: () => void;
}

export function SettingsPopover({ open, t, settings, triggerRef, onClose, onChange, onOpenBranding }: Props) {
  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const pop = document.getElementById('lybi-settings-pop');
      const target = e.target as Node;
      if (pop && !pop.contains(target) && !triggerRef.current?.contains(target)) onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onClose, triggerRef]);

  const { lang } = settings;

  return (
    <div id="lybi-settings-pop" className={`settings-pop ${open ? 'open' : ''}`}>
      <div className="set-title">{t.settings}</div>

      <div className="set-row">
        <label>{t.setLang}</label>
        <div className="seg">
          <button className={settings.lang === 'he' ? 'on' : ''} onClick={() => onChange({ lang: 'he' })}>עברית · RTL</button>
          <button className={settings.lang === 'en' ? 'on' : ''} onClick={() => onChange({ lang: 'en' })}>English · LTR</button>
        </div>
      </div>

      <div className="set-row">
        <label>{t.setTheme}</label>
        <div className="seg">
          <button className={settings.theme === 'light' ? 'on' : ''} onClick={() => onChange({ theme: 'light' })}>{t.light}</button>
          <button className={settings.theme === 'dark' ? 'on' : ''} onClick={() => onChange({ theme: 'dark' })}>{t.dark}</button>
        </div>
      </div>

      <div className="set-sep" />

      <div className="set-row">
        <label>{t.setClient}</label>
        <select className="set-select" value={settings.client} onChange={e => onChange({ client: e.target.value })}>
          {CLIENTS.map(c => <option key={c.id} value={c.id}>{c.name[lang]}</option>)}
        </select>
      </div>

      <div className="set-row">
        <button className="brand-settings-btn" onClick={onOpenBranding}>
          🎨 {lang === 'he' ? 'מיתוג, לוגו וצבעים' : 'Branding, logo & colors'}
        </button>
      </div>

      <div className="set-sep" />

      <div className="set-row">
        <label>{t.setMode}</label>
        <div className="seg">
          <button className={settings.mode === 'normal' ? 'on' : ''} onClick={() => onChange({ mode: 'normal' })}>{t.normal}</button>
          <button className={`grad ${settings.mode === 'debug' ? 'on' : ''}`} onClick={() => onChange({ mode: 'debug' })}>DEBUG</button>
        </div>
      </div>
    </div>
  );
}
