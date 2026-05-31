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
import { Modal } from '../Modal/Modal';
import { getPlugin } from '../../registry/plugins';
import { useBuilder } from '../../state/BuilderContext';
import { useConfirm } from '../Confirm/Confirm';
import { useBuilderSettings } from '../TopBar/BuilderSettings';
import { ExportToLibraryModal } from '../ExportToLibraryModal/ExportToLibraryModal';
import { AddonContextSection } from '../AddonContext/AddonContextSection';
import { AddonOutputSection } from '../AddonOutput/AddonOutputSection';
import { PromptTemplateModal } from '../PromptTemplateModal/PromptTemplateModal';
import type { AddonContext, AddonInstance, ID, OutputType } from '../../types';
import styles from './AddonModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  agentId: ID;
  crewId: ID;
  instance: AddonInstance | null;
}

interface Snapshot {
  config:     unknown;
  context:    AddonContext;
  outputType: OutputType;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function AddonModal({ open, onClose, agentId, crewId, instance }: Props) {
  const {
    updateAddonConfig,
    updateAddonContext,
    setAddonOutputType,
    removeAddon,
    saveCrewVersion,
  } = useBuilder();
  const confirm = useConfirm();
  const [settings] = useBuilderSettings();
  const [exportOpen, setExportOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

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
    const ok = await confirm({
      title: `Remove ${desc.name}?`,
      message: 'This removes the addon from this crew. You can re-add it any time.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (ok) {
      removeAddon(agentId, crewId, instance.instanceId);
      // Persist immediately when auto-save is on; otherwise the
      // removal sits as dirty state until the user clicks Save.
      if (settings.autoSave) saveCrewVersion(agentId, crewId);
      onClose();
    }
  };

  const handleDone = () => {
    // With auto-save ON, Done is the moment changes become durable.
    // With auto-save OFF, Done just closes — the edits stay dirty
    // until the user clicks Save in the version menu.
    if (settings.autoSave) saveCrewVersion(agentId, crewId);
    snapshotRef.current = null;
    onClose();
  };

  const handleCancel = async () => {
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
      // Restore via the existing setters — same code path inverse edits
      // would have gone through, so the doc lands back exactly where it
      // started without touching unrelated state.
      updateAddonConfig(agentId, crewId, instance.instanceId, s.config);
      updateAddonContext(agentId, crewId, instance.instanceId, s.context);
      setAddonOutputType(agentId, crewId, instance.instanceId, s.outputType);
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
        badge={instance.lane}
        footer={
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
        }
      >
        <div className={styles.body}>
          <Config
            config={instance.config}
            instance={instance}
            agentId={agentId}
            crewId={crewId}
            onChange={next => updateAddonConfig(agentId, crewId, instance.instanceId, next)}
          />

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
