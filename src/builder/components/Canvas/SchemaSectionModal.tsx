/**
 * SchemaSectionModal — opens a single SchemaPanel section in a larger
 * modal frame than the side rail provides.
 *
 * Setup-zone chips on the agent page (Parameters, Dynamic Context,
 * Domains, Fields) target this modal. The body just embeds the
 * existing `SchemaPanel` with its `sections` filter set to one entry —
 * so add/edit flows reuse the same modals (ParameterModal,
 * DomainModal, SchemaFieldModal, etc.) that the side panel already
 * uses. No new authoring UI; just a wider stage for the existing one.
 *
 * Sub-modals stack naturally on top: clicking "+ Add" or a row in,
 * say, ParametersSection still opens ParameterModal above this one.
 */

import { Modal } from '../Modal/Modal';
import { SchemaPanel, type SchemaSectionKind } from '../SchemaPanel/SchemaPanel';
import type { ID } from '../../types';
import addonStyles from '../AddonModal/AddonModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  agentId: ID;
  kind: SchemaSectionKind;
}

const TITLE: Record<SchemaSectionKind, string> = {
  'parameters': 'Parameters',
  'enums':      'Targeted KB',
  'pinned':     'Pinned Fields',
  'domains':    'Domains',
  'fields':     'Fields',
  'snippets':   'Snippets',
};

export function SchemaSectionModal({ open, onClose, agentId, kind }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={720}
      title={TITLE[kind]}
      badge="agent setup"
      footer={
        <>
          <span className={addonStyles.spacer} />
          <button type="button" className={addonStyles.primaryBtn} onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <div className={addonStyles.body}>
        <SchemaPanel agentId={agentId} sections={[kind]} embedded />
      </div>
    </Modal>
  );
}
