/** Thin wrapper so the Live chat follows the `src/pages/*` convention
 *  and can be lazy-loaded from App.tsx without pulling the live-chat
 *  subtree into the eager bundle. */
export { LiveChatPage } from '../live-chat/LiveChatPage';
