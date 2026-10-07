import { useCallback, useState } from 'react';
import { uploadAttachment, type ChatAttachmentRef } from '../../../services/chatAttachmentsService';

export interface PendingAttachment {
  localId: string;
  filename: string;
  status: 'uploading' | 'ready' | 'error';
  ref?: ChatAttachmentRef;
  error?: string;
}

/**
 * Files picked for the NEXT message. Each uploads (and is read server-side)
 * the moment it is picked, so by the time the user hits send the file is
 * already a digest the model can use — sending never waits on a big upload.
 */
export function useChatAttachments(opts: { agentName: string; conversationId?: string | null; userId?: string | null; baseURL?: string }) {
  const [pending, setPending] = useState<PendingAttachment[]>([]);

  const add = useCallback((files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const localId = crypto.randomUUID();
      setPending(p => [...p, { localId, filename: file.name, status: 'uploading' }]);
      uploadAttachment(file, opts)
        .then(ref => setPending(p => p.map(x => (x.localId === localId ? { ...x, status: 'ready', ref } : x))))
        .catch(err => setPending(p => p.map(x => (x.localId === localId ? { ...x, status: 'error', error: err instanceof Error ? err.message : String(err) } : x))));
    }
  }, [opts.agentName, opts.conversationId, opts.userId, opts.baseURL]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = useCallback((localId: string) => setPending(p => p.filter(x => x.localId !== localId)), []);
  const clear = useCallback(() => setPending([]), []);

  const ready = pending.filter(p => p.status === 'ready' && p.ref).map(p => p.ref as ChatAttachmentRef);
  const uploading = pending.some(p => p.status === 'uploading');

  return { pending, ready, uploading, add, remove, clear };
}
