/**
 * AddonModal — hosts a plugin's ConfigComponent for a specific
 * AddonInstance.
 *
 * Phase B v3: explicit commit / discard model.
 *   - On open, we snapshot the editable slice of the instance
 *     (config / context / outputType).
 *   - The inner ConfigComponent + the standard sections keep editing
 *     the live doc as today — that's what every sub-component already
 *     does and refactoring them all to a local-draft model would be a
 *     much bigger surgery.
 *   - Done   → save the crew version (commits the changes to the
 *              viewing version on the server) and closes the modal.
 *              No keystroke-level auto-save fires in between, so
 *              "Done" really is the moment the change becomes durable.
 *   - Cancel → restore the snapshot via the existing setters and
 *              close. Asks for confirmation when the user has actually
 *              changed something.
 *   - X / overlay click → same as Cancel.
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../Modal/Modal';
import { getPlugin } from '../../registry/plugins';
import { useBuilder } from '../../state/BuilderContext';
import { useAddonMutations } from '../../state/useAddonMutations';
import { useCrewFields } from '../../state/useCrewFields';
import { useConfirm } from '../Confirm/Confirm';
import { useBuilderSettings } from '../TopBar/BuilderSettings';
import { ExportToLibraryModal } from '../ExportToLibraryModal/ExportToLibraryModal';
import { AddonContextSection } from '../AddonContext/AddonContextSection';
import { AddonOutputSection } from '../AddonOutput/AddonOutputSection';
import { AddonTriggerSection } from '../Trigger/AddonTriggerSection';
import { PromptTemplateModal } from '../PromptTemplateModal/PromptTemplateModal';
import { FIELD_REASONER_PLUGIN_ID } from '../../plugins/fieldReasoner/addon.fieldReasoner';
import type { AddonContext, AddonInstance, ID, OutputType } from '../../types';
import styles from './AddonModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  agentId: ID;
  /** null → agent-cortex scope. Otherwise → addon belongs to a crew. */
  crewId: ID | null;
  instance: AddonInstance | null;
  /** View-only mode. Hides Remove/Done/snapshot machinery, disables
   *  the inner ConfigComponent via a fieldset wrapper, and shows a
   *  banner with a link to the editable location (agent page). Used
   *  by the agent-cortex strip shown in CrewView. */
  readOnly?: boolean;
}

interface Snapshot {
  config:     unknown;
  context:    AddonContext;
  outputType: OutputType;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function AddonModal({ open, onClose, agentId, crewId, instance, readOnly = false }: Props) {
  const { saveCrewVersion, saveAgentVersion, doc } = useBuilder();
  const muts = useAddonMutations(agentId, crewId);
  const isAgentScope = crewId === null;
  const agent = doc.agents.find(a => a.id === agentId);
  const confirm = useConfirm();
  const [settings] = useBuilderSettings();
  const [exportOpen, setExportOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  // For Field Reasoner cascade-delete — the linked field is owned by
  // this addon, so removing the addon also removes the field. Pulled
  // unconditionally; the helpers no-op when the plugin isn't a
  // reasoner. Uses '' as a sentinel crewId for agent-scope so
  // useCrewFields still resolves the agent field pool.
  const { allFields, removeField } = useCrewFields(agentId, crewId ?? '');

  const persistVersion = () => {
    if (isAgentScope) saveAgentVersion(agentId);
    else if (crewId)  saveCrewVersion(agentId, crewId);
  };

  // Snapshot the editable slice on open. The ref pattern is used over
  // useState because the snapshot should never trigger a re-render —
  // it's compared against current values inside event handlers.
  const snapshotRef = useRef<{ instanceId: string; snap: Snapshot } | null>(null);
  if (open && instance && snapshotRef.current?.instanceId !== instance.instanceId) {
    snapshotRef.current = {
      instanceId: instance.instanceId,
      snap: {
        config:     structuredClone(instance.config),
        context:    structuredClone(instance.context),
        outputType: instance.outputType,
      },
    };
  }
  // Drop the snapshot when the modal closes so the next open captures
  // a fresh one from whatever the addon looks like then.
  useEffect(() => {
    if (!open) snapshotRef.current = null;
  }, [open]);

  if (!instance) return null;
  const desc = getPlugin(instance.pluginId);
  if (!desc) {
    return (
      <Modal open={open} onClose={onClose} title={`Unknown plugin: ${instance.pluginId}`}>
        <p>This addon references a plugin that's not registered.</p>
      </Modal>
    );
  }

  const Config = desc.ConfigComponent;

  const isDirty = (): boolean => {
    const s = snapshotRef.current?.snap;
    if (!s) return false;
    return !deepEqual(s.config,     instance.config)
        || !deepEqual(s.context,    instance.context)
        ||  s.outputType !== instance.outputType;
  };

  const handleRemove = async () => {
    if (readOnly) return;
    // Field Reasoner cascade — the linked FieldDef is owned by this
    // addon, so deleting the addon also deletes the field.
    const isReasoner = instance.pluginId === FIELD_REASONER_PLUGIN_ID;
    const linkedFieldId = isReasoner
      ? ((instance.config as { extractsFields?: ID[] }).extractsFields ?? [])[0]
      : undefined;
    const linkedField = linkedFieldId
      ? allFields.find(cf => cf.field.id === linkedFieldId)
      : null;

    const ok = await confirm({
      title: linkedField
        ? `Delete "${linkedField.field.name}"?`
        : `Remove ${desc.name}?`,
      message: linkedField
        ? `This removes the Field Reasoner AND the field declaration it owns. Dynamic Context cases or prompts referencing "${linkedField.field.name}" will stop resolving.`
        : isAgentScope
          ? 'This removes the addon from the agent cortex. You can re-add it any time.'
          : 'This removes the addon from this crew. You can re-add it any time.',
      confirmLabel: linkedField ? 'Delete' : 'Remove',
      danger: true,
    });
    if (ok) {
      muts.remove(instance.instanceId);
      if (linkedField) {
        removeField(linkedField.scope, linkedField.ownerCrewId, linkedField.field.id);
      }
      if (settings.autoSave) persistVersion();
      onClose();
    }
  };

  const handleDone = () => {
    if (readOnly) { onClose(); return; }
    if (settings.autoSave) persistVersion();
    snapshotRef.current = null;
    onClose();
  };

  const handleCancel = async () => {
    if (readOnly) { onClose(); return; }
    if (isDirty()) {
      const ok = await confirm({
        title:        'Discard changes?',
        message:      'Your edits to this addon will be lost.',
        confirmLabel: 'Discard',
        danger:       true,
      });
      if (!ok) return;
    }
    const s = snapshotRef.current?.snap;
    if (s) {
      muts.updateConfig(instance.instanceId, s.config);
      muts.updateContext(instance.instanceId, s.context);
      muts.setOutputType(instance.instanceId, s.outputType);
    }
    snapshotRef.current = null;
    onClose();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={handleCancel}
        width={720}
        title={
          <>
            <span className={styles.titleIcon}>{desc.icon}</span>
            {desc.name}
          </>
        }
        badge={readOnly ? 'read-only · agent cortex' : instance.lane}
        footer={
          readOnly ? (
            <>
              {agent && (
                <Link
                  to={`/${agent.slug}/builder`}
                  onClick={onClose}
                  className={styles.secondaryBtn}
                  title="Open the agent page to edit the agent cortex"
                >
                  Edit at agent level ↗
                </Link>
              )}
              <span className={styles.spacer} />
              <button type="button" className={styles.primaryBtn} onClick={onClose}>
                Close
              </button>
            </>
          ) : (
            <>
              <button type="button" className={styles.dangerBtn} onClick={handleRemove}>
                Remove
              </button>
              <span className={styles.spacer} />
              {!desc.hideStandardSections?.promptTemplate && (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setTemplateOpen(true)}
                  title="View the prompt template the runtime uses for this addon"
                >
                  📄 Prompt template
                </button>
              )}
              {!desc.hideStandardSections?.repository && (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setExportOpen(true)}
                  title="Save this config to the shared Addon Repository"
                >
                  ⬆️ Export to repository
                </button>
              )}
              <button type="button" className={styles.secondaryBtn} onClick={handleCancel}>
                Cancel
              </button>
              <button type="button" className={styles.primaryBtn} onClick={handleDone}>
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
          <div className={styles.body}>
            {readOnly && (
              <div className={styles.readOnlyBanner}>
                This addon runs from the <strong>agent cortex</strong> before
                every crew. To edit it, open the agent page.
              </div>
            )}
            <Config
              config={instance.config}
              instance={instance}
              agentId={agentId}
              crewId={crewId ?? ''}
              onChange={next => muts.updateConfig(instance.instanceId, next)}
            />

            {/* Trigger config — only meaningful for offline-lane
                addons (the lane that fires per event, not per turn).
                Rendered ABOVE history so "when does this run?" reads
                before "what does it see when it runs?". */}
            {instance.lane === 'offline' && (
              <AddonTriggerSection
                agentId={agentId}
                crewId={crewId}
                instance={instance}
              />
            )}

            {!desc.hideStandardSections?.context && (
              <AddonContextSection
                agentId={agentId}
                crewId={crewId}
                instance={instance}
              />
            )}

            {!desc.hideStandardSections?.output && (
              <AddonOutputSection
                agentId={agentId}
                crewId={crewId}
                instance={instance}
              />
            )}
          </div>
        </fieldset>
      </Modal>

      <ExportToLibraryModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        instance={instance}
      />

      <PromptTemplateModal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        agentId={agentId}
        instance={instance}
      />
    </>
  );
}
