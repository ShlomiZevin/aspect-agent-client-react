/**
 * Admin → Conversations: open a task / bug straight from a conversation (#979).
 *
 * Reuses the board's Quick Add modal and API as they are: the description
 * starts with a link to this conversation in Admin, and the opener is the
 * person's board name. The modal renders in a portal, and its events stop
 * here, so typing or clicking in it never reaches the row underneath.
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { QuickBugModal } from '../../../components/tasks/QuickBugModal/QuickBugModal';
import { createTask } from '../../../services/taskService';

export function ConversationTaskButton({ agentSlug, conversationId, className }: {
  agentSlug: string;
  conversationId: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const url = `${window.location.origin}/${agentSlug}/builder/admin/conversations?c=${conversationId}`;

  return (
    <>
      <button type="button" className={className}
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        onKeyDown={e => { if (e.key === 'Enter') e.stopPropagation(); }}
        title="Open a task or bug linked to this conversation">
        + Task
      </button>
      {open && createPortal(
        // React events bubble out of a portal to the row: clicks and Enter stop here (Escape still closes the modal).
        <div onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Enter') e.stopPropagation(); }}>
          <QuickBugModal
            isOpen
            onClose={() => setOpen(false)}
            onSubmit={async data => { await createTask(data); }}
            currentDomain="general"
            conversationUrl={url}
            conversationLabel={`${agentSlug} #${conversationId}`}
          />
        </div>,
        document.body,
      )}
    </>
  );
}
