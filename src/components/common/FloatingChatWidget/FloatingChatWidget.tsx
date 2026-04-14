import { useState } from 'react';
import styles from './FloatingChatWidget.module.css';

export interface FloatingChatWidgetProps {
  /** URL to load inside the chat iframe (e.g. "/onezero?embed=true") */
  iframeSrc: string;
  /** Title shown in the widget header */
  title: string;
  /** Optional logo image src shown in header + button */
  logoSrc?: string;
  /** Optional accent color for the floating button (default: blue) */
  accentColor?: string;
  /** Text on the floating button (default: "צ'אט") */
  buttonText?: string;
  /** Icon shown if no logo (default: 💬) */
  buttonIcon?: string;
  /** Position of the floating button (default: 'bottom-left' for RTL pages) */
  position?: 'bottom-left' | 'bottom-right';
  /** Width of the open widget panel in px (default: 450) */
  width?: number;
  /** Direction of the page (default: 'rtl') */
  dir?: 'rtl' | 'ltr';
  /** Initially open */
  defaultOpen?: boolean;
}

/**
 * Generic floating chat widget. Shows a button that opens an overlay panel
 * containing an iframe. Used to embed any of our chat agents on top of any
 * page (landing, dashboard, etc.). Supports minimize via the close button.
 */
export function FloatingChatWidget({
  iframeSrc,
  title,
  logoSrc,
  accentColor = '#3b82f6',
  buttonText = "צ'אט",
  buttonIcon = '💬',
  position = 'bottom-left',
  width = 450,
  dir = 'rtl',
  defaultOpen = false,
}: FloatingChatWidgetProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [minimized, setMinimized] = useState(false);

  const buttonStyle: React.CSSProperties = {
    background: accentColor,
    boxShadow: `0 10px 30px ${accentColor}66`,
    [position === 'bottom-left' ? 'left' : 'right']: '2rem',
  };

  const handleOpen = () => {
    setOpen(true);
    setMinimized(false);
  };

  const handleMinimize = () => {
    setMinimized(true);
  };

  const handleClose = () => {
    setOpen(false);
    setMinimized(false);
  };

  return (
    <div dir={dir}>
      {(!open || minimized) && (
        <button
          className={styles.floatingButton}
          style={buttonStyle}
          onClick={handleOpen}
          aria-label={`פתח ${title}`}
        >
          {logoSrc ? (
            <span className={styles.buttonLogoWrap}>
              <img src={logoSrc} alt="" className={styles.buttonLogo} />
            </span>
          ) : (
            <span className={styles.buttonIcon}>{buttonIcon}</span>
          )}
          <span className={styles.buttonText}>{buttonText}</span>
        </button>
      )}

      {open && !minimized && (
        <div
          className={styles.overlay}
          style={{ justifyContent: position === 'bottom-left' ? 'flex-start' : 'flex-end' }}
        >
          <div className={styles.widget} style={{ width: `${width}px` }}>
            <div className={styles.header}>
              <div className={styles.headerTitle}>
                {logoSrc && (
                  <span className={styles.headerLogoWrap}>
                    <img src={logoSrc} alt="" />
                  </span>
                )}
                <span>{title}</span>
              </div>
              <div className={styles.headerActions}>
                <button
                  className={styles.iconBtn}
                  onClick={handleMinimize}
                  aria-label="מזער"
                  title="מזער"
                >
                  —
                </button>
                <button
                  className={styles.iconBtn}
                  onClick={handleClose}
                  aria-label="סגור"
                  title="סגור"
                >
                  ✕
                </button>
              </div>
            </div>
            <iframe src={iframeSrc} className={styles.iframe} title={title} />
          </div>
        </div>
      )}
    </div>
  );
}
