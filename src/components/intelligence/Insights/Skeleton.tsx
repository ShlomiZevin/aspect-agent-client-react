import styles from './Skeleton.module.css';

/** A single shimmering placeholder block — compose these into skeleton layouts matching the real content's shape. */
export function Skeleton({ width, height, radius = 8 }: { width: string | number; height: string | number; radius?: number }) {
  return <div className={styles.shimmer} style={{ width, height, borderRadius: radius }} />;
}
