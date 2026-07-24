/**
 * ChatPanel — right column. Two tabs:
 *
 *   - Builder Chat: talk to an AI helper that knows the full JSON
 *     shape, the current doc, and the spec. Helper model is fixed
 *     to Claude Sonnet 4.6 via the central registry.
 *
 *   - User Chat: chat with the in-progress agent itself. Below the
 *     transcript, an "addon activity" panel shows what each addon
 *     did during the last turn (transparency).
 *
 * Collapsible (#737): the » chevron shrinks the whole column to a
 * thin rail so the canvas gets the full screen. The chats stay
 * MOUNTED while collapsed (display:none) — collapsing mid-preview
 * must not reset the conversation or a streaming turn.
 */

import { useEffect, useRef, useState } from 'react';
import { BuilderChat } from './BuilderChat';
import { UserChat } from './UserChat';
import styles from './ChatPanel.module.css';

type Tab = 'builder' | 'user';

const COLLAPSED_KEY = 'builder:chatCollapsed';
const WIDTH_KEY = 'builder:chatWidth';
const DEFAULT_WIDTH = 380;
const MIN_WIDTH = 280;

/** Clamp a candidate width to [MIN, viewport-aware max] so the canvas
 *  always keeps a usable slice and the panel never overflows the screen. */
function clampWidth(w: number): number {
  const max = Math.max(MIN_WIDTH, Math.min(900, window.innerWidth - 360));
  return Math.min(max, Math.max(MIN_WIDTH, w));
}

export function ChatPanel() {
  // Default to User Chat — that's the surface authors reach for most
  // (test the agent they're building). Builder Chat is one tab away.
  const [tab, setTab] = useState<Tab>('user');
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
  });

  // Persisted, drag-resizable panel width. Shared by both tabs (Builder
  // Chat + User Chat) since it's the whole column that resizes.
  const [width, setWidth] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem(WIDTH_KEY) || '', 10);
      return Number.isFinite(v) ? clampWidth(v) : DEFAULT_WIDTH;
    } catch { return DEFAULT_WIDTH; }
  });
  const [dragging, setDragging] = useState(false);
  const latestWidth = useRef(width);
  latestWidth.current = width;

  // Keep the panel from overrunning a shrinking window.
  useEffect(() => {
    const onResize = () => setWidth(w => clampWidth(w));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const persistWidth = (w: number) => {
    try { localStorage.setItem(WIDTH_KEY, String(w)); } catch { /* ignore */ }
  };

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    setDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    // Panel is on the RIGHT: dragging the handle left grows it, so the
    // width delta is the negative of the horizontal mouse delta.
    const onMove = (ev: MouseEvent) => {
      const next = clampWidth(startW - (ev.clientX - startX));
      latestWidth.current = next;
      setWidth(next);
    };
    const onUp = () => {
      setDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      persistWidth(latestWidth.current);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const resetWidth = () => {
    setWidth(DEFAULT_WIDTH);
    persistWidth(DEFAULT_WIDTH);
  };

  return (
    <>
      {collapsed && (
        <div className={styles.collapsedRail}>
          <button
            type="button"
            className={styles.railBtn}
            onClick={toggleCollapsed}
            title="Show chat panel"
          >
            «
          </button>
          <span className={styles.railLabel}>💬 Chat</span>
        </div>
      )}

      <div
        className={`${styles.wrap} ${collapsed ? styles.wrapHidden : ''}`}
        style={collapsed ? undefined : { width }}
      >
        {/* Left-edge drag handle: resize the whole chat column; the
            canvas gives/takes the difference. Double-click = reset. */}
        <div
          className={`${styles.resizeHandle} ${dragging ? styles.resizeHandleActive : ''}`}
          onMouseDown={startDrag}
          onDoubleClick={resetWidth}
          role="separator"
          aria-orientation="vertical"
          title="Drag to resize · double-click to reset"
        />
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'builder' ? styles.tabActive : ''}`}
            onClick={() => setTab('builder')}
          >
            <span className={styles.tabIcon}>🛠️</span>
            <span>Builder Chat</span>
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'user' ? styles.tabActive : ''}`}
            onClick={() => setTab('user')}
          >
            <span className={styles.tabIcon}>💬</span>
            <span>User Chat</span>
          </button>
          {width !== DEFAULT_WIDTH && (
            <button
              type="button"
              className={styles.resetWidthBtn}
              onClick={resetWidth}
              title="Reset panel width"
            >
              ↺
            </button>
          )}
          <button
            type="button"
            className={styles.collapseBtn}
            onClick={toggleCollapsed}
            title="Hide chat panel — full-screen builder"
          >
            »
          </button>
        </div>

        <div className={styles.body}>
          {tab === 'builder' ? <BuilderChat /> : <UserChat />}
        </div>
      </div>
    </>
  );
}
