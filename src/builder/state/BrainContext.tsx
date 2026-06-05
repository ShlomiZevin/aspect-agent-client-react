/**
 * BrainContext — posture + activity signal for the Brain panel.
 *
 * The Brain panel is a *view* onto data BuilderContext already holds
 * (`conversationMemory`, `agent.dynamicContexts`). This context owns
 * only the panel's own UI state:
 *
 *   • posture — `collapsed | docked | fullscreen`. Persisted to
 *     localStorage so the user's choice survives reloads.
 *   • hasUnseen — `true` when memory changed within the current
 *     conversation while the panel was collapsed. Lights the dot on
 *     the dock bar so the author knows something happened without
 *     popping the panel open uninvited. Session-scoped; cleared the
 *     moment the panel opens.
 *   • expandedBodies — which umbrella / section / fallback bodies are
 *     expanded inside the panel. Session-scoped, keyed by
 *     `${dcId}/${sectionName | '__umbrella__' | '__fallback__'}`.
 *
 * Why a separate context (vs. extending BuilderContext): the Brain
 * panel is a runtime-monitor surface, BuilderContext is the
 * authoring surface. Different mental modes; keeping them
 * structurally distinct stops monitor concerns from creeping into
 * setup code (and vice versa) as both grow.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { useBuilder } from './BuilderContext';

export type BrainPosture = 'collapsed' | 'docked' | 'fullscreen';

interface BrainState {
  posture: BrainPosture;
  setPosture: (p: BrainPosture) => void;
  /** "Something happened while the panel was closed" — lights the dot. */
  hasUnseen: boolean;
  /** Per-body expand/collapse state. Key format documented above. */
  expandedBodies: Set<string>;
  toggleBody: (key: string) => void;
}

const Ctx = createContext<BrainState | null>(null);

const POSTURE_KEY = 'builder:brain:posture';

function loadPosture(): BrainPosture {
  try {
    const raw = localStorage.getItem(POSTURE_KEY);
    if (raw === 'docked' || raw === 'fullscreen' || raw === 'collapsed') return raw;
  } catch { /* private mode / unavailable */ }
  return 'collapsed';
}

function savePosture(p: BrainPosture): void {
  try { localStorage.setItem(POSTURE_KEY, p); } catch { /* ignore */ }
}

/** Cheap-but-correct equality for memory blobs. The blob is small
 *  (per-conversation), JSON-friendly, and refetched per turn — a
 *  stringify compare is the right trade. */
function blobEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}

export function BrainProvider({ children }: { children: ReactNode }) {
  const { conversationMemory, previewConversationId } = useBuilder();
  const [posture, setPostureRaw] = useState<BrainPosture>(loadPosture);
  const [hasUnseen, setHasUnseen] = useState(false);
  const [expandedBodies, setExpandedBodies] = useState<Set<string>>(() => new Set());

  // Tracking refs — used by the activity-detection effect below to
  // tell apart "conversation switched" (silent — explicit user
  // navigation) from "memory mutated within the same conversation"
  // (worth signalling).
  const lastConvIdRef = useRef(previewConversationId);
  const lastMemoryRef = useRef(conversationMemory);

  useEffect(() => {
    const convChanged = lastConvIdRef.current !== previewConversationId;
    lastConvIdRef.current = previewConversationId;
    if (convChanged) {
      // Switching conversations is deliberate navigation, not activity.
      // Reset the memory baseline and skip the unseen-dot.
      lastMemoryRef.current = conversationMemory;
      return;
    }
    if (blobEqual(lastMemoryRef.current, conversationMemory)) return;
    lastMemoryRef.current = conversationMemory;
    // Memory changed in the active conversation → something happened.
    // Only signal when the panel is collapsed; if it's already open
    // the user will see the change directly.
    if (posture === 'collapsed') setHasUnseen(true);
  }, [conversationMemory, previewConversationId, posture]);

  const setPosture = useCallback((p: BrainPosture) => {
    setPostureRaw(p);
    savePosture(p);
    // Opening the panel is implicit acknowledgement — clear the dot.
    if (p !== 'collapsed') setHasUnseen(false);
  }, []);

  const toggleBody = useCallback((key: string) => {
    setExpandedBodies(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const value = useMemo<BrainState>(() => ({
    posture, setPosture, hasUnseen, expandedBodies, toggleBody,
  }), [posture, setPosture, hasUnseen, expandedBodies, toggleBody]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBrain(): BrainState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useBrain must be used inside <BrainProvider>');
  return v;
}
