import { useEffect, useRef } from 'react';

/**
 * Hands a route over to a self-contained static page in public/.
 *
 * The public Lybi site (Hila & Noa's handoff, public/lybi-site/index.html) and
 * its immersive team page are standalone HTML, not React. Firebase serves them
 * at their clean URLs directly (rewrites in firebase.json) and vite.config.ts
 * does the same in dev, so React only renders this after a client-side
 * <Link to="/lybi"> (or on lybi.ai's bare root, which passes url="/lybi"). A
 * full page load of that URL then lets the server answer.
 *
 * If the document itself was loaded at that URL, the server did NOT rewrite it
 * (another hosting config, a preview build) — loading it again would loop, so
 * go straight to the file instead.
 */
export function StaticPageRedirect({ file, url }: { file: string; url?: string }) {
  // StrictMode runs the effect twice; navigate once.
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const target = url || window.location.pathname;
    const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const documentPath = entry ? new URL(entry.name).pathname : null;
    if (documentPath === target) {
      window.location.replace(file + window.location.hash);
    } else if (target === window.location.pathname) {
      // Replacing with an identical URL that has a #hash is a same-document
      // jump and never reaches the server; reload() does.
      window.location.reload();
    } else {
      window.location.replace(target + window.location.hash);
    }
  }, [file, url]);

  return <div style={{ minHeight: '100vh', background: '#100B1B' }} />;
}
