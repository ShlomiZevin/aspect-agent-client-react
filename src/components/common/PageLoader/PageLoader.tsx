import styles from './PageLoader.module.css';

/**
 * What a route shows while its code is still downloading.
 *
 * Every lazy route in App.tsx used the same inline `<div>Loading…</div>`, which
 * on a slow connection is a bare word in the top-left corner of a white page -
 * indistinguishable from a broken build. This is deliberately quiet instead: a
 * centred mark that pulses, no text to translate, and nothing that claims to
 * know how long it will take.
 *
 * It renders OUTSIDE every provider - a Suspense fallback sits above the tree
 * it is waiting for - so it uses no context, no `t()`, and no `--ai-*` token
 * that is only defined inside the Intelligence shell.
 */
export function PageLoader() {
  return (
    <div className={styles.wrap} role="status" aria-live="polite" aria-label="Loading">
      <span className={styles.pulse}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </span>
    </div>
  );
}
