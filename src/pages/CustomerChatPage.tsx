/** Thin wrapper so the customer chat follows the `src/pages/*`
 *  convention and can be lazy-loaded from App.tsx without pulling the
 *  live-chat subtree into the eager bundle. */
export { CustomerChatPage } from '../live-chat/CustomerChatPage';
