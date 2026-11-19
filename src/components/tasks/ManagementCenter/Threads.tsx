import type { CSSProperties } from 'react';
import styles from './ManagementCenter.module.css';

/**
 * The background light threads, mirrored from the design (flares at the top
 * and bottom of the agenda side). Two layers drift very slowly. Shared by the
 * center and the action-items page.
 */
export function Threads() {
  const top = [
    'M -60 210 C 180 170, 420 92, 596 62 S 930 -6, 1160 -60',
    'M 210 -60 C 380 10, 500 44, 596 62 S 820 150, 1120 300',
    'M -40 70 C 190 46, 400 74, 596 62 C 720 54, 830 18, 920 -60',
    'M 600 -60 C 760 60, 1060 70, 1600 150',
    'M 420 140 C 500 100, 560 74, 596 62 C 640 46, 700 10, 740 -60',
  ];
  const bottom = [
    'M -60 1010 C 150 994, 330 954, 491 935 S 900 852, 1620 1000',
    'M -40 870 C 180 914, 370 946, 491 935 C 650 920, 770 990, 920 1090',
    'M 180 1090 C 300 1006, 410 958, 491 935 S 630 860, 720 760',
    'M 860 1060 C 1080 962, 1320 936, 1620 972',
    'M -60 640 C 40 760, 120 900, 220 1090',
  ];
  const rays = [[596, 62], [491, 935]].flatMap(([cx, cy]) =>
    [-62, -20, 18, 64, 118, 170, 228].map(a => {
      const r = 70 + ((a + 400) % 50);
      const rad = (a * Math.PI) / 180;
      return `M ${cx} ${cy} L ${cx + Math.cos(rad) * r} ${cy + Math.sin(rad) * r}`;
    }));
  const strand = (d: string, i: number, strong: boolean) => (
    <g key={i}>
      <path d={d} className={styles.threadGlow} style={{ opacity: strong ? 0.16 : 0.07 } as CSSProperties} />
      <path d={d} className={styles.threadCore} style={{ opacity: strong ? 0.42 : 0.17 } as CSSProperties} />
    </g>
  );
  return (
    <svg className={styles.threads} viewBox="0 0 1536 1024" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="mcFlare" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="0.1" stopColor="#f1e6ff" stopOpacity="0.6" />
          <stop offset="0.28" stopColor="#ae80ff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#7b39c5" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mcHalo" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#9e50ef" stopOpacity="0.13" />
          <stop offset="1" stopColor="#7b39c5" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mcRay" x1="0" x2="1">
          <stop offset="0" stopColor="#d8beff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#d8beff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="596" cy="62" r="260" fill="url(#mcHalo)" />
      <circle cx="491" cy="935" r="260" fill="url(#mcHalo)" />
      <g className={styles.driftA}>{top.map((d, i) => strand(d, i, i < 2))}</g>
      <g className={styles.driftB}>{bottom.map((d, i) => strand(d, i, i < 2))}</g>
      <g className={styles.rays}>{rays.map((d, i) => <path key={i} d={d} />)}</g>
      <circle className={styles.flare} cx="596" cy="62" r="22" fill="url(#mcFlare)" />
      <circle className={styles.flare} cx="491" cy="935" r="20" fill="url(#mcFlare)" />
    </svg>
  );
}
