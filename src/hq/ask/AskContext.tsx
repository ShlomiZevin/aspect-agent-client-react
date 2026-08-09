/**
 * HQ — one Ask conversation, shared by every surface.
 *
 * The thread lives here rather than inside a screen, so asking from the Ask tab
 * and asking from the floating panel are the *same* conversation. Clicking a
 * citation navigates away from whichever screen you were on — if the thread
 * lived in that screen's state it would die on the way, which is exactly the
 * problem this solves.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { ask as askApi } from '../services/hqApi';
import type { AskResult } from '../types';

export interface Turn {
  question: string;
  result?: AskResult;
  error?: string;
  loading: boolean;
}

interface AskContextValue {
  turns: Turn[];
  submit: (question: string) => Promise<void>;
  clear: () => void;
  /** Floating panel — only relevant when you're not on the Ask tab. */
  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
}

const AskCtx = createContext<AskContextValue | null>(null);

const THREAD_KEY = 'lybi_hq_thread';

/** Anything mid-flight when the tab closed is dead on return — drop it. */
function loadThread(): Turn[] {
  try {
    const raw = sessionStorage.getItem(THREAD_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as Turn[]).filter(t => !t.loading);
  } catch {
    return [];
  }
}

export function AskProvider({ children }: { children: ReactNode }) {
  const [turns, setTurns] = useState<Turn[]>(loadThread);
  const [panelOpen, setPanelOpen] = useState(false);

  // Survives a reload too, not just navigation.
  useEffect(() => {
    try {
      sessionStorage.setItem(THREAD_KEY, JSON.stringify(turns.filter(t => !t.loading)));
    } catch { /* private mode / quota — the thread just won't persist */ }
  }, [turns]);

  const submit = useCallback(async (question: string) => {
    const q = question.trim();
    if (!q) return;

    let index = 0;
    setTurns(prev => { index = prev.length; return [...prev, { question: q, loading: true }]; });

    try {
      const result = await askApi(q);
      setTurns(prev => prev.map((t, i) => (i === index ? { ...t, result, loading: false } : t)));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setTurns(prev => prev.map((t, i) => (i === index ? { ...t, error: message, loading: false } : t)));
    }
  }, []);

  const clear = useCallback(() => {
    setTurns([]);
    try { sessionStorage.removeItem(THREAD_KEY); } catch { /* ignore */ }
  }, []);

  const value = useMemo<AskContextValue>(() => ({
    turns, submit, clear,
    panelOpen,
    openPanel: () => setPanelOpen(true),
    closePanel: () => setPanelOpen(false),
    togglePanel: () => setPanelOpen(v => !v),
  }), [turns, submit, clear, panelOpen]);

  return <AskCtx.Provider value={value}>{children}</AskCtx.Provider>;
}

export function useAsk(): AskContextValue {
  const ctx = useContext(AskCtx);
  if (!ctx) throw new Error('useAsk must be used inside <AskProvider>');
  return ctx;
}
