import { useState } from 'react';
import { LogoPicker } from '../../components/common/LogoPicker/LogoPicker';
import { isHex, type BrandColors } from '../branding';
import type { UseBranding } from '../useBranding';
import type { Dict, Lang } from '../i18n';
import { IconClose } from '../icons';

interface Props {
  open: boolean;
  t: Dict;
  lang: Lang;
  branding: UseBranding;
  onClose: () => void;
}

/** One colour control: a native swatch + a `#hex` text field. The text
 *  field keeps its own buffer so partial input ("#E01") isn't clobbered;
 *  the parent remounts it (via key) when a preset is loaded. */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);

  const commit = (v: string) => {
    setText(v);
    if (isHex(v)) onChange(v.trim());
  };

  return (
    <div className="brand-color">
      <span className="brand-color-label">{label}</span>
      <input
        type="color"
        className="brand-swatch"
        value={isHex(value) ? value : '#000000'}
        onChange={e => { setText(e.target.value); onChange(e.target.value); }}
      />
      <input
        className="brand-hex"
        dir="ltr"
        value={text}
        spellCheck={false}
        onChange={e => commit(e.target.value)}
        onBlur={() => { if (!isHex(text)) setText(value); }}
        placeholder="#RRGGBB"
      />
    </div>
  );
}

export function BrandingModal({ open, t, lang, branding, onClose }: Props) {
  const { brand, presets, update, savePreset, loadPreset, deletePreset, reset } = branding;
  const [presetName, setPresetName] = useState('');
  const he = lang === 'he';

  const setColor = (key: keyof BrandColors, v: string) =>
    update({ colors: { ...brand.colors, [key]: v } });

  return (
    <div className={`modal-scrim ${open ? 'show' : ''}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal brand-modal">
        <div className="modal-head">
          <h3><span className="mh-ic">🎨</span><span>{he ? 'מיתוג' : 'Branding'}</span></h3>
          <button className="icon-btn" onClick={onClose}><IconClose size={20} /></button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>{he ? 'שם הסוכן' : 'Agent name'}</label>
            <input value={brand.agentName} onChange={e => update({ agentName: e.target.value })} placeholder={he ? 'שם להצגה' : 'Display name'} />
          </div>

          <LogoPicker label={he ? 'לוגו' : 'Logo'} value={brand.logo} onChange={logo => update({ logo })} />

          <div className="field">
            <label>{he ? 'צבעים' : 'Colors'}</label>
            <div className="brand-colors">
              <ColorField key={`${brand.id}-p`} label={he ? 'ראשי' : 'Primary'} value={brand.colors.primary} onChange={v => setColor('primary', v)} />
              <ColorField key={`${brand.id}-s`} label={he ? 'משני' : 'Secondary'} value={brand.colors.secondary} onChange={v => setColor('secondary', v)} />
              <ColorField key={`${brand.id}-t`} label={he ? 'שלישי' : 'Tertiary'} value={brand.colors.tertiary} onChange={v => setColor('tertiary', v)} />
            </div>
          </div>

          <div className="set-sep" />

          <div className="field">
            <label>{he ? 'ערכות שמורות' : 'Saved presets'}</label>
            {presets.length > 0 ? (
              <div className="brand-presets">
                {presets.map(p => (
                  <div key={p.id} className="brand-preset">
                    <button className="brand-preset-load" onClick={() => loadPreset(p.id)}>{p.presetName}</button>
                    <button className="brand-preset-del" onClick={() => deletePreset(p.id)} title={t.delete}>✕</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="brand-empty">{he ? 'אין ערכות שמורות' : 'No saved presets'}</div>
            )}
          </div>

          <div className="brand-save-row">
            <input
              className="brand-save-name"
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
              placeholder={he ? 'שם הערכה…' : 'Preset name…'}
            />
            <button
              className="btn primary"
              disabled={!presetName.trim()}
              onClick={() => { savePreset(presetName.trim()); setPresetName(''); }}
            >
              {he ? 'שמור' : 'Save'}
            </button>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn ghost" onClick={reset}>{he ? 'איפוס לברירת מחדל' : 'Reset to default'}</button>
          <button className="btn primary" onClick={onClose}>{he ? 'סגור' : 'Done'}</button>
        </div>
      </div>
    </div>
  );
}
