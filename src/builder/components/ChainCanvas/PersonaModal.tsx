/**
 * PersonaModal — addon-shaped config modal for the hardcoded Persona
 * card in the agent cortex.
 *
 * Mimics AddonModal's frame (title icon + name, badge, footer with
 * Cancel + Done) so the experience matches every other addon's
 * settings popup. The body is just the persona prompt MentionTextarea
 * — no model picker, no history, no Output, no Remove.
 *
 * Source of truth is still `agent.persona` (edited via `updateAgent`).
 * Edits write through on every keystroke, mirroring how AddonModal's
 * ConfigComponents work. To preserve Cancel-as-revert semantics we
 * snapshot the persona on open and restore via the same setter on
 * Cancel — same pattern AddonModal uses for config/context/outputType.
 *
 * `readOnly` mirrors AddonModal's read-only mode: disabled fieldset,
 * banner, footer collapses to a Close button + "Edit at agent level"
 * link. Used by the agent-cortex strip rendered in CrewView.
 */

import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../Modal/Modal';
import { useBuilder } from '../../state/BuilderContext';
import { useBuilderSettings } from '../TopBar/BuilderSettings';
import { useConfirm } from '../Confirm/Confirm';
import { MentionTextarea } from '../MentionTextarea/MentionTextarea';
import { useMentionOptions } from '../MentionTextarea/useMentionOptions';
import type { ID } from '../../types';
import addonStyles from '../AddonModal/AddonModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  agentId: ID;
  agentSlug: string;
  persona: string;
  readOnly?: boolean;
}

export function PersonaModal({
  open, onClose, agentId, agentSlug, persona, readOnly = false,
}: Props) {
  const { updateAgent, saveAgentVersion } = useBuilder();
  const [settings] = useBuilderSettings();
  const confirm = useConfirm();
  const mentionOptions = useMentionOptions(agentId);

  // Snapshot the persona on open so Cancel can restore it. We use a
  // ref (not state) because the snapshot should never trigger a
  // re-render — only event handlers read it. Captured on the first
  // render where `open` flips to true, cleared when the modal closes.
  const snapshotRef = useRef<string | null>(null);
  if (open && !readOnly && snapshotRef.current === null) {
    snapshotRef.current = persona;
  }
  useEffect(() => {
    if (!open) snapshotRef.current = null;
  }, [open]);

  const handleDone = () => {
    if (readOnly) { onClose(); return; }
    if (settings.autoSave) saveAgentVersion(agentId);
    snapshotRef.current = null;
    onClose();
  };

  const handleCancel = async () => {
    if (readOnly) { onClose(); return; }
    const snap = snapshotRef.current;
    const dirty = snap !== null && snap !== persona;
    if (dirty) {
      const ok = await confirm({
        title:        'Discard changes?',
        message:      'Your edits to the persona will be lost.',
        confirmLabel: 'Discard',
        danger:       true,
      });
      if (!ok) return;
      // Restore via the existing setter — same path inverse edits
      // would take, so the doc lands back exactly where it started
      // and isAgentDirty flips back to false if nothing else changed.
      updateAgent(agentId, { persona: snap });
    }
    snapshotRef.current = null;
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleCancel}
      width={720}
      title={
        <>
          <span className={addonStyles.titleIcon}>🎭</span>
          Persona
        </>
      }
      badge={readOnly ? 'read-only · agent' : 'agent · always runs first'}
      footer={
        readOnly ? (
          <>
            <Link
              to={`/${agentSlug}/builder`}
              onClick={onClose}
              className={addonStyles.secondaryBtn}
              title="Open the agent page to edit the persona"
            >
              Edit at agent level ↗
            </Link>
            <span className={addonStyles.spacer} />
            <button type="button" className={addonStyles.primaryBtn} onClick={onClose}>
              Close
            </button>
          </>
        ) : (
          <>
            <span className={addonStyles.spacer} />
            <button type="button" className={addonStyles.secondaryBtn} onClick={handleCancel}>
              Cancel
            </button>
            <button type="button" className={addonStyles.primaryBtn} onClick={handleDone}>
              Done
            </button>
          </>
        )
      }
    >
      <fieldset
        disabled={readOnly}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
        <div className={addonStyles.body}>
          {readOnly && (
            <div className={addonStyles.readOnlyBanner}>
              The persona runs from the <strong>agent</strong> before every crew on every turn.
              To edit, open the agent page.
            </div>
          )}
          <MentionTextarea
            value={persona}
            onChange={next => updateAgent(agentId, { persona: next })}
            options={mentionOptions}
            placeholder="Describe how the agent sounds, the tone, and what it never does…"
            rows={14}
            // Per-agent key so resize-height AND the Ctrl+Shift R/L
            // direction override are remembered per persona — a Hebrew
            // persona on one agent and an English persona on another
            // don't share the same pin.
            storageKey={`persona:${agentId}`}
          />
        </div>
      </fieldset>
    </Modal>
  );
}
