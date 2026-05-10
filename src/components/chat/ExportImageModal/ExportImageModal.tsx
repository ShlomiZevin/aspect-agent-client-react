import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import html2canvas from 'html2canvas';
import { useChatContext, useAgentConfig } from '../../../context';
import type { Message as MessageType } from '../../../types';
import styles from './ExportImageModal.module.css';

interface ExportImageModalProps {
  selectedIds: string[];
  onClose: () => void;
}

type RatioId = 'auto' | 'square' | 'story' | 'portrait' | 'landscape' | 'twitter';
type FrameId = 'none' | 'desktop' | 'mobile';

interface RatioOption {
  id: RatioId;
  label: string;
  width: number;
  /** null = canvas height matches content (auto). */
  height: number | null;
}

// Target export dimensions. Width is fixed per ratio; if content is taller than `height`,
// the canvas grows vertically (we never crop or shrink messages).
const RATIOS: RatioOption[] = [
  { id: 'auto',      label: 'Auto (fit content)', width: 1080, height: null },
  { id: 'square',    label: 'Square 1:1',         width: 1080, height: 1080 },
  { id: 'story',     label: 'Story 9:16',         width: 1080, height: 1920 },
  { id: 'portrait',  label: 'Portrait 4:5',       width: 1080, height: 1350 },
  { id: 'landscape', label: 'Landscape 16:9',     width: 1920, height: 1080 },
  { id: 'twitter',   label: 'Twitter 1.91:1',     width: 1200, height: 628 },
];

const FRAMES: { id: FrameId; label: string }[] = [
  { id: 'none',    label: 'No frame' },
  { id: 'desktop', label: 'Desktop' },
  { id: 'mobile',  label: 'Mobile' },
];

// Vertical pixels each frame consumes around the chat content (outer padding +
// frame border + inner padding). Must mirror the values in ExportImageModal.module.css.
const FRAME_CHROME: Record<FrameId, number> = {
  none:    60 * 2 + 40 * 2,            // outer padding + inner padding
  desktop: 70 * 2 + 48 * 2,            // outer padding + inner padding
  mobile:  80 * 2 + 14 * 2 + 64 + 36,  // outer padding + bezel border + inner padding (top + bottom)
};

const PREVIEW_MAX_WIDTH = 460;
const PREVIEW_MAX_HEIGHT = 560;

// Strip interactive UI markup from message content so the export shows only natural text.
const UI_TYPES = ['buttons', 'chips', 'checkbox', 'radio', 'toggle', 'select', 'id', 'input'];
const UI_RE = new RegExp(`\\[(${UI_TYPES.join('|')}):[^\\]]+\\]`, 'g');
function cleanContent(text: string): string {
  return text.replace(UI_RE, '').trim();
}

const RTL_RE = /[֐-׿؀-ۿ܀-ݏ]/;
function detectDir(messages: MessageType[]): 'rtl' | 'ltr' {
  let rtl = 0;
  let ltr = 0;
  for (const m of messages) {
    const firstLetter = m.content.match(/\p{L}/u);
    if (!firstLetter) continue;
    if (RTL_RE.test(firstLetter[0])) rtl++; else ltr++;
  }
  return rtl > ltr ? 'rtl' : 'ltr';
}

interface ExportMessageProps {
  msg: MessageType;
  dir: 'rtl' | 'ltr';
}

function ExportMessage({ msg, dir }: ExportMessageProps) {
  const isUser = msg.role === 'user';
  const text = cleanContent(msg.content);
  if (!text) return null;
  return (
    <div className={`${styles.row} ${isUser ? styles.rowUser : styles.rowBot}`} dir={dir}>
      <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleBot}`}>
        {!isUser && msg.crewMember && (
          <div className={styles.crewLabel}>{msg.crewMember}</div>
        )}
        <div className={styles.bubbleContent}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

export function ExportImageModal({ selectedIds, onClose }: ExportImageModalProps) {
  const { messages } = useChatContext();
  const config = useAgentConfig();

  const [ratioId, setRatioId] = useState<RatioId>('portrait');
  const [frameId, setFrameId] = useState<FrameId>('mobile');
  const [isExporting, setIsExporting] = useState(false);
  const [userZoom, setUserZoom] = useState<'fit' | number>('fit');

  const exportNodeRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previewAreaRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  // Selected user/assistant messages, in original order
  const items = useMemo<MessageType[]>(() => {
    const sel = new Set(selectedIds);
    return messages.filter(m => sel.has(m.id) && (m.role === 'user' || m.role === 'assistant'));
  }, [messages, selectedIds]);

  const dir = useMemo(() => detectDir(items), [items]);

  const ratio = RATIOS.find(r => r.id === ratioId)!;
  const exportWidth = ratio.width;

  // Measure natural content height; canvas grows if content needs more room.
  const [contentHeight, setContentHeight] = useState(0);
  useLayoutEffect(() => {
    if (!contentRef.current) return;
    const measure = () => {
      if (contentRef.current) setContentHeight(contentRef.current.scrollHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, [items, frameId]);

  // Total canvas height = max(target ratio, what the content + frame chrome actually need).
  const requiredHeight = contentHeight + FRAME_CHROME[frameId];
  const exportHeight = Math.max(ratio.height ?? 0, requiredHeight);

  // Auto-fit scale so the entire export node fits inside the preview area.
  const fitScale = useMemo(() => {
    if (!exportWidth || !exportHeight) return 1;
    return Math.min(PREVIEW_MAX_WIDTH / exportWidth, PREVIEW_MAX_HEIGHT / exportHeight, 1);
  }, [exportWidth, exportHeight]);

  const previewScale = userZoom === 'fit' ? fitScale : userZoom;

  // Reset zoom when ratio changes — different aspect needs a different fit.
  useEffect(() => { setUserZoom('fit'); }, [ratioId]);

  const handleExport = async () => {
    if (!exportNodeRef.current || isExporting) return;
    setIsExporting(true);
    const node = exportNodeRef.current;
    const oldTransform = node.style.transform;
    try {
      // html2canvas misreads dimensions when the source has CSS transform applied —
      // temporarily clear it so the captured node sits at its real layout box.
      node.style.transform = 'none';
      await new Promise(resolve => requestAnimationFrame(resolve));

      const canvas = await html2canvas(node, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        width: exportWidth,
        height: exportHeight,
      });
      const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = url;
      a.download = `${config.agentName.replace(/\s+/g, '-').toLowerCase()}-chat-${stamp}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      node.style.transform = oldTransform;
      setIsExporting(false);
    }
  };


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Mouse-wheel zoom on the preview area. Native listener with { passive: false } so we
  // can preventDefault and override the browser's default scroll/page-zoom behavior.
  useEffect(() => {
    const el = previewAreaRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setUserZoom(prev => {
        const current = prev === 'fit' ? fitScale : prev;
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const next = current * factor;
        return Math.max(0.05, Math.min(5, next));
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [fitScale]);

  // Click-drag pan: while the mouse is down inside the preview area, dragging shifts
  // the area's scroll position so the user can move around a zoomed-in image.
  useEffect(() => {
    if (!isPanning) return;
    const onMove = (e: MouseEvent) => {
      if (!previewAreaRef.current) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      previewAreaRef.current.scrollLeft = panStart.current.scrollLeft - dx;
      previewAreaRef.current.scrollTop = panStart.current.scrollTop - dy;
    };
    const onUp = () => setIsPanning(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isPanning]);

  const handlePanStart = (e: React.MouseEvent) => {
    if (e.button !== 0 || !previewAreaRef.current) return;
    setIsPanning(true);
    panStart.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: previewAreaRef.current.scrollLeft,
      scrollTop: previewAreaRef.current.scrollTop,
    };
  };

  const frameClass =
    frameId === 'desktop' ? styles.frameDesktop :
    frameId === 'mobile'  ? styles.frameMobile  :
    styles.frameNone;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Export to Image</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className={styles.body}>
          <div className={styles.controls}>
            <label className={styles.controlGroup}>
              <span className={styles.controlLabel}>Aspect Ratio</span>
              <select value={ratioId} onChange={e => setRatioId(e.target.value as RatioId)}>
                {RATIOS.map(r => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </label>

            <div className={styles.controlGroup}>
              <span className={styles.controlLabel}>Frame</span>
              <div className={styles.frameButtons}>
                {FRAMES.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    className={`${styles.frameBtn} ${frameId === f.id ? styles.frameBtnActive : ''}`}
                    onClick={() => setFrameId(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.controlGroup}>
              <span className={styles.controlLabel}>Preview Zoom</span>
              <div className={styles.zoomRow}>
                <span className={styles.zoomValue}>{Math.round(previewScale * 100)}%</span>
                <button
                  type="button"
                  className={styles.zoomFitBtn}
                  onClick={() => setUserZoom('fit')}
                >
                  Fit
                </button>
              </div>
              <div className={styles.zoomHint}>Scroll to zoom · drag to pan</div>
            </div>

            <div className={styles.meta}>
              {items.length} message{items.length === 1 ? '' : 's'} · {exportWidth}×{Math.round(exportHeight) || '…'}px
            </div>
          </div>

          <div
            ref={previewAreaRef}
            className={`${styles.previewArea} ${isPanning ? styles.panning : ''}`}
            onMouseDown={handlePanStart}
          >
            <div
              className={styles.previewWrap}
              style={{
                width: exportWidth * previewScale,
                height: exportHeight * previewScale,
              }}
            >
              <div
                ref={exportNodeRef}
                className={`${styles.exportNode} ${frameClass}`}
                style={{
                  width: exportWidth,
                  height: exportHeight,
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top left',
                }}
                dir={dir}
              >
                <div className={styles.frameInner}>
                  <div ref={contentRef} className={styles.exportContent}>
                    <div className={styles.exportHeader} dir={dir}>
                      {config.logo?.src && (
                        <img
                          src={config.logo.src}
                          alt={config.logo.alt}
                          width={56}
                          height={56}
                          className={styles.exportLogo}
                        />
                      )}
                      <span className={styles.exportTitle}>
                        {config.headerTitle || config.displayName || config.agentName}
                      </span>
                    </div>
                    <div className={styles.exportMessages}>
                      {items.map(m => (
                        <ExportMessage key={m.id} msg={m} dir={dir} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            className={styles.downloadBtn}
            onClick={handleExport}
            disabled={isExporting || items.length === 0}
          >
            {isExporting ? 'Exporting…' : 'Download PNG'}
          </button>
        </div>
      </div>
    </div>
  );
}
