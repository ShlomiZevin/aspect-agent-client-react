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
 * The textarea on the AgentView page edits the same field; both
 * surfaces stay in sync because they read the live doc.
 *
 * `readOnly` mirrors AddonModal's read-only mode: disabled fieldset,
 * banner, footer collapses to a Close button + "Edit at agent level"
 * link. Used by the agent-cortex strip rendered in CrewView.
 */

import { Link } from 'react-router-dom';
import { Modal } from '../Modal/Modal';
import { useBuilder } from '../../state/BuilderContext';
import { useBuilderSettings } from '../TopBar/BuilderSettings';
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
  const mentionOptions = useMentionOptions(agentId);

  const handleDone = () => {
    if (readOnly) { onClose(); return; }
    if (settings.autoSave) saveAgentVersion(agentId);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
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
            <button type="button" className={addonStyles.secondaryBtn} onClick={onClose}>
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
            // Persist the textarea's resized height across modal opens.
            // One key for all personas — same editor type, same shape.
            storageKey="persona"
          />
        </div>
      </fieldset>
    </Modal>
  );
}
