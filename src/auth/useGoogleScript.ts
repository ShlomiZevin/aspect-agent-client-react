import { useEffect, useState } from 'react';

/**
 * Loads Google Identity Services, once per page.
 *
 * Not an npm package: GIS is a hosted script that must come from Google's own
 * origin to work, so installing a wrapper would add a dependency that still
 * loads this same URL at runtime.
 *
 * Loaded only when a client actually offers Google sign-in — a third-party
 * script on every page for a button most clients never draw is a cost and a
 * tracking surface for nothing.
 */
const SRC = 'https://accounts.google.com/gsi/client';

type State = 'idle' | 'loading' | 'ready' | 'failed';

export function useGoogleScript(enabled: boolean): State {
  const [state, setState] = useState<State>(() => (isLoaded() ? 'ready' : 'idle'));

  useEffect(() => {
    // Already there, or not wanted: nothing to load and nothing to set. The
    // initialiser above has already reported 'ready' for a script another
    // component loaded before this one mounted.
    if (!enabled || isLoaded()) return;

    let cancelled = false;

    // Reused if another component already started it, so two buttons on one
    // page do not race two script tags.
    let el = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    if (!el) {
      el = document.createElement('script');
      el.src = SRC;
      el.async = true;
      el.defer = true;
      document.head.appendChild(el);
    }

    const onLoad = () => { if (!cancelled) setState(isLoaded() ? 'ready' : 'failed'); };
    const onError = () => { if (!cancelled) setState('failed'); };

    el.addEventListener('load', onLoad);
    el.addEventListener('error', onError);

    // A tag added by an earlier mount may have finished before these listeners
    // were attached, in which case 'load' will never fire again for us.
    if (isLoaded()) onLoad();

    return () => {
      cancelled = true;
      el?.removeEventListener('load', onLoad);
      el?.removeEventListener('error', onError);
      // The tag is left in place: it is shared, and removing it would break any
      // other component still using it.
    };
  }, [enabled]);

  return state;
}

function isLoaded(): boolean {
  return typeof window !== 'undefined'
    && Boolean((window as unknown as { google?: { accounts?: { id?: unknown } } })
      .google?.accounts?.id);
}
