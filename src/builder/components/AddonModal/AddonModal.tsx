/**
 * AddonModal — hosts a plugin's ConfigComponent for a specific
 * AddonInstance. Footer offers Remove, Export to Library, and Done.
 */

import { useState } from 'react';
import { Modal } from '../Modal/Modal';
import { getPlugin } from '../../registry/plugins';
import { useBuilder } from '../../state/BuilderContext';
import { useConfirm } from '../Confirm/Confirm';
import { ExportToLibraryModal } from '../ExportToLibraryModal/ExportToLibraryModal';
import { AddonContextSection } from '../AddonContext/AddonContextSection';
import { AddonOutputSection } from '../AddonOutput/AddonOutputSection';
import { PromptTemplateModal } from '../PromptTemplateModal/PromptTemplateModal';
import type { AddonInstance, ID } from '../../types';
import styles from './AddonModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  agentId: ID;
  crewId: ID;
  instance: AddonInstance | null;
}

export function AddonModal({ open, onClose, agentId, crewId, instance }: Props) {
  const { updateAddonConfig, removeAddon } = useBuilder();
  const confirm = useConfirm();
  const [exportOpen, setExportOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

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

  const handleRemove = async () => {
    const ok = await confirm({
      title: `Remove ${desc.name}?`,
      message: 'This removes the addon from this crew. You can re-add it any time.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (ok) {
      removeAddon(agentId, crewId, instance.instanceId);
      onClose();
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
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
            <button type="button" className={styles.secondaryBtn} onClick={onClose}>
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
