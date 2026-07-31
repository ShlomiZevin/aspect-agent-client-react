import { useLayoutEffect, useRef, type ReactNode } from 'react';
import type { LiveTurn } from '../useLiveChat';
import type { Dict, Lang } from '../i18n';
import { MessageBubble } from './MessageBubble';
import { WelcomeBoxes } from './WelcomeBoxes';

interface Props {
  turns: LiveTurn[];
  t: Dict;
  lang: Lang;
  debug: boolean;
  showWelcome: boolean;
  /** The composer card rendered inside the welcome (empty state only). */
  welcomeComposer?: ReactNode;
  /** Brand/agent name for the bot eyebrow. */
  botLabel: string;
  crewNames: Record<string, string>;
  defaultCrewName: string;
  onPick: (text: string) => void;
  onExpandThink: (turn: LiveTurn) => void;
  onReport: (messageText: string) => void;
  onDelete: (turn: LiveTurn) => void;
  onDeleteFromHere: (turn: LiveTurn) => void;
}

export function MessageStream({
  turns, t, lang, debug, showWelcome, welcomeComposer, botLabel, crewNames, defaultCrewName, onPick, onExpandThink, onReport, onDelete, onDeleteFromHere,
}: Props) {
  const streamRef = useRef<HTMLDivElement>(null);
  const wasAtBottom = useRef(true);

  const onScroll = () => {
    const el = streamRef.current;
    if (!el) return;
    wasAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // Keep pinned to the bottom while the user is following along — token
  // streaming mutates the last bubble on almost every frame.
  useLayoutEffect(() => {
    const el = streamRef.current;
    if (el && wasAtBottom.current) el.scrollTop = el.scrollHeight;
  }, [turns]);

  return (
    <div className="stream" ref={streamRef} onScroll={onScroll}>
      <div className="stream-inner">
        {showWelcome && <WelcomeBoxes t={t} lang={lang} composer={welcomeComposer} onPick={onPick} />}
        {turns.map(turn => (
          <MessageBubble
            key={turn.id}
            turn={turn}
            t={t}
            debug={debug}
            botLabel={botLabel}
            crewNames={crewNames}
            defaultCrewName={defaultCrewName}
            onExpandThink={() => onExpandThink(turn)}
            onReport={onReport}
            onDelete={() => onDelete(turn)}
            onDeleteFromHere={() => onDeleteFromHere(turn)}
          />
        ))}
      </div>
    </div>
  );
}
