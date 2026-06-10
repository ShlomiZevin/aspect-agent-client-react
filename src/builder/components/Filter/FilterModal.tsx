/**
 * FilterModal — focused modal for editing one addon's run filter.
 *
 * The filter is a "different and unique" concern from the rest of an
 * addon's config — it changes WHEN the addon runs, not what it
 * does. Keeping it out of the main AddonModal form keeps that form
 * small; surfacing it behind a button (in the AddonModal header AND
 * on the chain chip) lets the author reach it from wherever they
 * spotted the need.
 *
 * The body re-uses `AddonFilterSection` so the editing experience is
 * identical regardless of entry point.
 */

import { Modal } from '../Modal/Modal';
import { AddonFilterSection } from './AddonFilterSection';
import type { AddonInstance, ID } from '../../types';
import addonStyles from '../AddonModal/AddonModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  agentId: ID;
  /** null → agent-cortex scope. */
  crewId: ID | null;
  instance: AddonInstance | null;
}

export function FilterModal({ open, onClose, agentId, crewId, instance }: Props) {
  if (!instance) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={620}
      title="Run filter"
      badge={instance.config && (instance.config as { name?: string }).name
        ? (instance.config as { name?: string }).name!
        : instance.pluginId}
      footer={
        <>
          <span className={addonStyles.spacer} />
          <button type="button" className={addonStyles.primaryBtn} onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <div className={addonStyles.body}>
        <AddonFilterSection
          agentId={agentId}
          crewId={crewId}
          instance={instance}
        />
      </div>
    </Modal>
  );
}
