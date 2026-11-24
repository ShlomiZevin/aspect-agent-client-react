/**
 * Sends the question the demo screens handed over (askAgent in ./shared) as
 * the first message of the /realestate chat. Same shape as the Intelligence
 * widget's PrefillSender (AgentChatWidgetPage): callbacks through refs, keyed
 * on userId alone, the storage key removed only when the send happens — see
 * the comments there for why each of those matters.
 */
import { useEffect, useRef } from 'react';
import { useChatContext, useUserContext } from '../../context';
import { ASK_STORAGE_KEY } from './shared';

export function AskHandoff() {
  const { sendMessage } = useChatContext();
  const { userId } = useUserContext();
  const sendRef = useRef(sendMessage);
  useEffect(() => { sendRef.current = sendMessage; });

  useEffect(() => {
    const question = sessionStorage.getItem(ASK_STORAGE_KEY);
    if (!question || !userId) return;
    const timer = setTimeout(() => {
      if (sessionStorage.getItem(ASK_STORAGE_KEY) !== question) return;
      sessionStorage.removeItem(ASK_STORAGE_KEY);
      sendRef.current(question);
    }, 300);
    return () => clearTimeout(timer);
  }, [userId]);

  return null;
}
