/**
 * useSlotRenameCascade — keep `{{kb:NAME}}` / `{{thinking:NAME}}` tokens
 * in sync when an addon's free-text "writes-to" slot is renamed.
 *
 * Several addons own a slot via a plain text input rather than a managed
 * rename flow:
 *   - KB Retriever  → `config.domain` → `{{kb:NAME}}`        (kind 'kbDomain')
 *   - Thinker       → `config.domain` → `{{thinking:NAME}}`  (kind 'thinkingDomain')
 *   - Field Interviewer (non-field keys) → same as Thinker
 *
 * Editing that input character-by-character makes "the old name" hard to
 * recover, so we snapshot it on focus and, on blur, fire the cascade once
 * for the whole edit (old → new). The slot value itself is committed by
 * the input's own onChange; this hook only rewrites the *references*.
 *
 * Spread the returned handlers onto the slot <input>. No-op on an
 * unchanged or empty edit, so it's safe to attach unconditionally.
 */

import { useRef } from 'react';
import { useBuilder } from './BuilderContext';

type SlotKind = 'kbDomain' | 'thinkingDomain';

export function useSlotRenameCascade(agentId: string, kind: SlotKind) {
  const { applyTokenRenameCascade } = useBuilder();
  // The slot value at the moment editing began. Null when not focused.
  const beforeRef = useRef<string | null>(null);

  return {
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      beforeRef.current = e.target.value;
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      const before = (beforeRef.current ?? '').trim();
      const after = e.target.value.trim();
      beforeRef.current = null;
      // Only a genuine rename (non-empty old AND new, and different)
      // cascades. A first-time fill (empty → name) has no old token to
      // rewrite; clearing the slot leaves tokens visibly broken on
      // purpose, matching the rest of the rename system.
      if (before && after && before !== after) {
        applyTokenRenameCascade(agentId, kind, before, after);
      }
    },
  };
}
