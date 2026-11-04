/**
 * Add-ons this environment no longer offers (#955) — Lybi Staging retired
 * Vibe Extractor, Transition Router and Field Interviewer. The server
 * decides per environment (builder/environments.js); this asks once.
 *
 * Only the "add" pickers use it: an agent that already has one of these
 * still shows and runs it.
 */

import { useEffect, useState } from 'react';
import { fetchBuilderEnvironment } from './builderApi';

const NONE: ReadonlySet<string> = new Set();
let asked: Promise<ReadonlySet<string>> | null = null;

export function useRetiredAddons(): ReadonlySet<string> {
  const [retired, setRetired] = useState<ReadonlySet<string>>(NONE);
  useEffect(() => {
    let cancelled = false;
    asked ??= fetchBuilderEnvironment()
      .then(env => new Set(env.retiredAddons))
      .catch(() => { asked = null; return NONE; });
    void asked.then(set => { if (!cancelled) setRetired(set); });
    return () => { cancelled = true; };
  }, []);
  return retired;
}
