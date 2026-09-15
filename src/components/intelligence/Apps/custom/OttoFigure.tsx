/**
 * Otto's figure — the Orb, approved by the owner 2026-09-14 (design round
 * in tasks/pending/otto-intelligence-integration.md §12 Q2).
 *
 * Drawn in code, not a generated image, because the face ANIMATES with the
 * builder's real state: idle blinks and wanders, thinking spins the iris,
 * building lands blocks over a progress sweep, done pops happy arcs, error
 * shakes once and settles on an amber badge. `prefers-reduced-motion` gets
 * clean static poses per state — the review page ran motion unconditionally
 * to be judged; the product honors the OS.
 */
import styles from './OttoFigure.module.css';

export type OttoFigureState = 'idle' | 'think' | 'build' | 'done' | 'error';

interface Props {
  state: OttoFigureState;
  /** Height in px; width follows the viewBox ratio. */
  size?: number;
}

export function OttoFigure({ state, size = 190 }: Props) {
  return (
    <div className={styles.stage} data-state={state}>
      <svg viewBox="0 0 260 310" fill="none" style={{ height: size }} aria-hidden="true">
        <ellipse className={styles.shadow} cx="130" cy="288" rx="62" ry="9" fill="var(--ai-border-soft, #e7e9f1)" />
        <g className={styles.float}>
          <g className={`${styles.body} ${styles.anim}`}>
            <circle cx="130" cy="150" r="92" fill="var(--ai-surface, #fbfbfd)" stroke="var(--ai-border, #dfe2ec)" strokeWidth="2.5" />
            <ellipse cx="103" cy="82" rx="34" ry="16" fill="var(--ai-surface, #fff)" opacity=".85" transform="rotate(-24 103 82)" />
            <path d="M50 180 a92 92 0 0 0 160 0" stroke="var(--ai-border-soft, #eceef5)" strokeWidth="2.5" fill="none" />
            <circle cx="64" cy="196" r="3.6" fill="var(--ai-border, #e2e5ee)" />
            <circle cx="196" cy="196" r="3.6" fill="var(--ai-border, #e2e5ee)" />
            <circle cx="130" cy="239" r="3.6" fill="var(--ai-border, #e2e5ee)" />
            <circle cx="130" cy="132" r="52" fill="#171a23" />
            <circle cx="130" cy="132" r="52" stroke="var(--ai-border, #e2e5ee)" strokeWidth="3.5" fill="none" />
            <circle className={styles.glow} cx="130" cy="132" r="42" fill="var(--ai-accent, #6d28d9)" opacity=".2" />
            <circle cx="130" cy="132" r="38" fill="#171a23" />

            {/* IDLE */}
            <g className={`${styles.st} ${styles.stIdle}`}>
              <g className={`${styles.gaze} ${styles.anim}`}>
                <rect className={`${styles.eye} ${styles.anim}`} x="106" y="117" width="13" height="30" rx="6.5" fill="#eef2ff" />
                <rect className={`${styles.eye} ${styles.eyeR} ${styles.anim}`} x="141" y="117" width="13" height="30" rx="6.5" fill="#eef2ff" />
              </g>
            </g>

            {/* THINK */}
            <g className={`${styles.st} ${styles.stThink}`}>
              <rect className={`${styles.teye} ${styles.anim}`} x="108" y="105" width="11" height="11" rx="5.5" fill="#eef2ff" />
              <rect className={`${styles.teye} ${styles.anim}`} x="141" y="105" width="11" height="11" rx="5.5" fill="#eef2ff" />
              <g className={`${styles.iris} ${styles.anim}`}>
                <circle cx="130" cy="134" r="30" stroke="#3d4356" strokeWidth="3.5" fill="none" strokeDasharray="9 11" strokeLinecap="round" />
                <circle cx="160" cy="134" r="4.5" fill="var(--ai-accent, #6d28d9)" />
                <circle cx="157.4" cy="145.5" r="3" fill="var(--ai-accent, #6d28d9)" opacity=".45" />
                <circle cx="150.2" cy="154.7" r="2" fill="var(--ai-accent, #6d28d9)" opacity=".2" />
              </g>
              <rect className={`${styles.scan} ${styles.anim}`} x="112" y="156" width="36" height="5" rx="2.5" fill="#8f7bd9" />
            </g>

            {/* BUILD */}
            <g className={`${styles.st} ${styles.stBuild}`}>
              <rect className={`${styles.beye} ${styles.anim}`} x="108" y="102" width="11" height="15" rx="5.5" fill="#eef2ff" />
              <rect className={`${styles.beye} ${styles.anim}`} x="141" y="102" width="11" height="15" rx="5.5" fill="#eef2ff" />
              <rect className={`${styles.blk} ${styles.anim}`} x="98" y="126" width="18" height="14" rx="3.5" fill="#3d4356" />
              <rect className={`${styles.blk} ${styles.blk2} ${styles.anim}`} x="121" y="126" width="18" height="14" rx="3.5" fill="#3d4356" />
              <rect className={`${styles.blk} ${styles.blk3} ${styles.anim}`} x="144" y="126" width="18" height="14" rx="3.5" fill="#3d4356" />
              <rect x="100" y="150" width="60" height="6.5" rx="3.25" fill="#2a2f3d" />
              <rect className={`${styles.prog} ${styles.anim}`} x="100" y="150" width="60" height="6.5" rx="3.25" fill="var(--ai-accent, #6d28d9)" />
            </g>

            {/* DONE */}
            <g className={`${styles.st} ${styles.stDone}`}>
              <circle className={`${styles.pulse} ${styles.anim}`} cx="130" cy="132" r="40" stroke="var(--ai-success, #1f9d61)" strokeWidth="3" fill="none" />
              <path className={`${styles.arcL} ${styles.anim}`} d="M101 128 q11.5 -15 23 0" stroke="#eef2ff" strokeWidth="6.5" strokeLinecap="round" />
              <path className={`${styles.arcR} ${styles.anim}`} d="M136 128 q11.5 -15 23 0" stroke="#eef2ff" strokeWidth="6.5" strokeLinecap="round" />
              <g className={`${styles.chk} ${styles.anim}`}>
                <circle cx="130" cy="152" r="7.5" fill="var(--ai-success, #1f9d61)" />
                <path d="M126.4 152 l2.7 3 l4.8 -5.9" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </g>
            </g>

            {/* ERROR */}
            <g className={`${styles.st} ${styles.stError}`}>
              <rect x="103" y="124" width="21" height="6.5" rx="3.25" fill="#eef2ff" />
              <rect x="136" y="124" width="21" height="6.5" rx="3.25" fill="#eef2ff" />
              <g className={`${styles.badge} ${styles.anim}`}>
                <circle cx="130" cy="152" r="8.5" fill="#d97706" />
                <rect x="128.7" y="146.2" width="2.7" height="7.6" rx="1.35" fill="#fff" />
                <circle cx="130" cy="157.8" r="1.6" fill="#fff" />
              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}

/** The head alone, for avatar slots — same drawing, cropped viewBox. */
export function OttoAvatar({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="70 72 120 120" width={size} height={size} aria-hidden="true">
      <circle cx="130" cy="132" r="58" fill="var(--ai-surface, #fbfbfd)" stroke="var(--ai-border, #dfe2ec)" strokeWidth="4" />
      <circle cx="130" cy="132" r="45" fill="#171a23" />
      <rect x="106" y="116" width="14" height="32" rx="7" fill="#eef2ff" />
      <rect x="140" y="116" width="14" height="32" rx="7" fill="#eef2ff" />
    </svg>
  );
}
