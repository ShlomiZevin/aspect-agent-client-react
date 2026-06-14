/**
 * SnippetCreator — global mount point for the "+ New snippet…" flow
 * from inside any MentionTextarea.
 *
 * The picker shows a quick-add row when `useMentionOptions` is called
 * with `onCreateSnippet`. That callback comes from this provider — any
 * component that authors prompt text can call `useSnippetCreator()`
 * and wire `openCreateFor(agentId)` into its MentionTextarea options.
 *
 * Why a global mount: a per-plugin SnippetModal would need its own
 * agent lookup, its own `useConfirm` access, its own state — and the
 * quick-add flow doesn't add a snippet to one plugin's config, it adds
 * one to the AGENT, which any later picker invocation should see. One
 * provider, one modal, one consistent flow.
 *
 * Usage:
 *   const create = useSnippetCreator();
 *   const options = useMentionOptions(agentId, {
 *     onCreateSnippet: () => create(agentId),
 *   });
 */

import {
  createContext, useCallback, useContext, useMemo, useState,
  type ReactNode,
} from 'react';
import { SnippetModal } from './SnippetModal';
import type { ID } from '../../types';

type CreateFn = (agentId: ID) => void;

const SnippetCreatorCtx = createContext<CreateFn | null>(null);

export function useSnippetCreator(): CreateFn {
  const fn = useContext(SnippetCreatorCtx);
  if (!fn) {
    throw new Error('useSnippetCreator must be used inside <SnippetCreatorProvider>');
  }
  return fn;
}

interface ProviderProps {
  children: ReactNode;
}

export function SnippetCreatorProvider({ children }: ProviderProps) {
  const [openFor, setOpenFor] = useState<ID | null>(null);

  const open = useCallback<CreateFn>(agentId => {
    setOpenFor(agentId);
  }, []);

  const value = useMemo(() => open, [open]);

  return (
    <SnippetCreatorCtx.Provider value={value}>
      {children}
      {openFor && (
        <SnippetModal
          open
          onClose={() => setOpenFor(null)}
          agentId={openFor}
          initial={null}
        />
      )}
    </SnippetCreatorCtx.Provider>
  );
}
