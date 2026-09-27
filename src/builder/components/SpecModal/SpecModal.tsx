/**
 * SpecModal — hosts the existing SpecEditor inside a modal so the spec
 * stays first-class data without dominating the canvas. Used by every
 * level's "doc" button.
 */

import { Modal } from '../Modal/Modal';
import { SpecEditor } from '../SpecEditor/SpecEditor';
import { SpecFiles } from './SpecFiles';

interface Props {
  open: boolean;
  onClose: () => void;
  level: 'project' | 'agent' | 'crew';
  /** Display name of the thing this spec belongs to. */
  ownerName: string;
  value: string;
  onChange: (next: string) => void;
  /** The agent whose Spec files show below the text (#870). Project and
   *  agent levels pass it — for one agent they are the same files; crews
   *  don't. */
  agentId?: string;
}

const LEVEL_LABEL: Record<Props['level'], string> = {
  project: 'Project',
  agent: 'Agent',
  crew: 'Crew',
};

export function SpecModal({ open, onClose, level, ownerName, value, onChange, agentId }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={720}
      title={<>📖 Spec — {ownerName}</>}
      badge={LEVEL_LABEL[level]}
    >
      <SpecEditor level={level} value={value} onChange={onChange} />
      {agentId && <SpecFiles agentId={agentId} />}
    </Modal>
  );
}
