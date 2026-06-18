/**
 * LogoPicker — reusable logo upload + rectangle crop → data URL.
 *
 * Intentionally self-contained (no app/live-chat coupling) so it can be
 * reused elsewhere (e.g. the builder). Upload an image, drag a free
 * rectangle over the logo, Apply → returns a cropped PNG data URL that
 * preserves the rectangle's aspect ratio.
 */

import { useCallback, useRef, useState } from 'react';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import styles from './LogoPicker.module.css';

interface Props {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  /** Optional small caption above the control. */
  label?: string;
}

const MAX_OUTPUT_WIDTH = 480;

export function LogoPicker({ value, onChange, label }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [rawSrc, setRawSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRawSrc(String(reader.result));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    // Default to a centered 80%-wide rectangle.
    const w = 80;
    const h = Math.min(80, (height ? (width * 0.8 * 0.4) / height : 40)) || 50;
    setCrop({ unit: '%', x: (100 - w) / 2, y: (100 - h) / 2, width: w, height: h });
  }, []);

  const apply = () => {
    const image = imgRef.current;
    if (!image || !crop || !crop.width || !crop.height) return;
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const px = {
      x: (crop.x / 100) * image.width * scaleX,
      y: (crop.y / 100) * image.height * scaleY,
      width: (crop.width / 100) * image.width * scaleX,
      height: (crop.height / 100) * image.height * scaleY,
    };
    const ratio = px.width > MAX_OUTPUT_WIDTH ? MAX_OUTPUT_WIDTH / px.width : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(px.width * ratio));
    canvas.height = Math.max(1, Math.round(px.height * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(image, px.x, px.y, px.width, px.height, 0, 0, canvas.width, canvas.height);
    onChange(canvas.toDataURL('image/png'));
    setRawSrc(null);
  };

  return (
    <div className={styles.wrap}>
      {label && <div className={styles.label}>{label}</div>}

      <div className={styles.row}>
        <div className={styles.preview}>
          {value
            ? <img src={value} alt="logo" />
            : <span className={styles.empty}>—</span>}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.btn} onClick={() => fileRef.current?.click()}>
            {value ? 'Change' : 'Upload'}
          </button>
          {value && (
            <button type="button" className={styles.btnGhost} onClick={() => onChange(null)}>
              Remove
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      </div>

      {rawSrc && (
        <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) setRawSrc(null); }}>
          <div className={styles.modal}>
            <div className={styles.modalHead}>Select the logo area</div>
            <div className={styles.cropBox}>
              <ReactCrop crop={crop} onChange={(_, percent) => setCrop(percent)}>
                <img ref={imgRef} src={rawSrc} alt="crop" onLoad={onImageLoad} className={styles.cropImg} />
              </ReactCrop>
            </div>
            <div className={styles.modalFoot}>
              <button type="button" className={styles.btnGhost} onClick={() => setRawSrc(null)}>Cancel</button>
              <button type="button" className={styles.btn} onClick={apply} disabled={!crop?.width}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
