import { useState } from 'react';
import { MarkdownBody } from '../../builder/components/ChatPanel/MarkdownBody';
import type { LiveTurn } from '../useLiveChat';
import type { Dict } from '../i18n';
import { ThinkingProcess } from './ThinkingProcess';
import { IconBug, IconChevron, IconTrash, IconTrashDown } from '../icons';

interface Props {
  turn: LiveTurn;
  t: Dict;
  debug: boolean;
  /** Brand/agent name — the bot eyebrow ("LYBI"). Falls back to the crew. */
  botLabel: string;
  /** crewId → display name, for the bubble label fallback. */
  crewNames: Record<string, string>;
  /** Shown when the turn's crew is unknown (e.g. single-crew agents). */
  defaultCrewName: string;
  onExpandThink: () => void;
  onReport: (messageText: string) => void;
  onDelete: () => void;
  onDeleteFromHere: () => void;
}

/**
 * A full turn. The customer (user) sits on the reading START side, Lybi
 * (bot) on the END side — both via `.lybi-chat` CSS that follows the PAGE
 * direction. The bubble itself carries no `dir` (so its pointer-corner
 * tracks the page/avatar side); text direction is handled by `dir="auto"`
 * on the inner content so a Hebrew message right-aligns and an English one
 * left-aligns regardless of UI language.
 */
export function MessageBubble({ turn, t, debug, botLabel, crewNames, defaultCrewName, onExpandThink, onReport, onDelete, onDeleteFromHere }: Props) {
  const [thinkOpen, setThinkOpen] = useState(false);
  const canDelete = turn.userMessageId !== null || turn.assistantMessageId !== null;
  const thinking = turn.assistantText === '' && turn.thinkingLabel !== null;
  const showBot = turn.assistantText !== '' || turn.assistantMessageId !== null || thinking;
  const crewName = (turn.crewId && crewNames[turn.crewId]) || defaultCrewName;
  // Customer-facing identity: the brand ("LYBI"), not the internal crew name.
  const label = botLabel || crewName;

  const toggleThink = () => {
    const next = !thinkOpen;
    setThinkOpen(next);
    if (next && !turn.thinkLoaded) onExpandThink();
  };

  return (
    <>
      {turn.userText && (
        <div className="msg user">
          <div className="bubble-wrap">
            <div className="sender-label">Customer</div>
            <div className="bubble"><div className="bubble-text" dir="auto">{turn.userText}</div></div>
          </div>
        </div>
      )}
      {showBot && (
        <div className="msg bot">
          <div className="bubble-wrap">
            {label && <div className="crew-label">{label}</div>}
            {thinking ? (
              // Customer-facing: just the dots — no addon names, even in
              // debug (the builder's chat is where per-addon progress
              // belongs). thinkingLabel still drives the thinking STATE.
              <div className="bubble thinking" dir="ltr">
                <span className="dots"><i /><i /><i /></span>
              </div>
            ) : (
              <div className="bubble"><div className="bubble-md" dir="auto"><MarkdownBody text={turn.assistantText} /></div></div>
            )}

            {debug && !thinking && (
              <>
                <div className="msg-actions">
                  <button className={`mini-btn think-toggle ${thinkOpen ? 'open' : ''}`} onClick={toggleThink}>
                    <IconChevron />
                    <span>{t.think}</span>
                  </button>
                  <button className="mini-btn" onClick={() => onReport(turn.assistantText)} title={t.report}>
                    <IconBug />
                    <span>{t.report}</span>
                  </button>
                  {canDelete && (
                    <>
                      <button className="mini-btn" onClick={onDelete} title={t.deleteMsg}><IconTrash /></button>
                      <button className="mini-btn" onClick={onDeleteFromHere} title={t.deleteFromHere}><IconTrashDown /></button>
                    </>
                  )}
                </div>
                <ThinkingProcess turn={turn} open={thinkOpen} />
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
