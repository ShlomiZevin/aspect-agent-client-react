import { useCallback, useState } from 'react';
import { api } from '../api';

/**
 * A translation of one piece of text, fetched on demand and kept beside the
 * original rather than replacing it.
 *
 * Non-destructive on purpose: the text in a task is what someone wrote, and a
 * machine translation is a reading aid. Writing one back over the original
 * would lose the only authoritative version.
 *
 * Cached per hook instance, so toggling the view back and forth does not bill a
 * model call each time.
 */
export function useTranslation() {
  const [text, setText] = useState<string | null>(null);
  const [showing, setShowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback(async (source: string) => {
    if (showing) { setShowing(false); return; }
    if (text !== null) { setShowing(true); return; }

    setBusy(true);
    setError(null);
    try {
      const { translated } = await api.translate(source);
      setText(translated);
      setShowing(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [showing, text]);

  /** Drops the cache — call when the source text changes underneath. */
  const reset = useCallback(() => {
    setText(null);
    setShowing(false);
    setError(null);
  }, []);

  return { text, showing, busy, error, toggle, reset };
}
