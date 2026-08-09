/**
 * HQ — the Ask tab.
 *
 * The full-screen home for the conversation. It renders the *same* thread as
 * the floating panel (both read AskContext), so moving between them is
 * seamless and clicking a citation never costs you the conversation.
 */

import { useEffect, useRef } from 'react';

import { useAsk } from '../ask/AskContext';
import { Conversation } from '../ask/Conversation';
import { Composer } from '../ask/Composer';
import styles from './AskScreen.module.css';

export function AskScreen() {
  const { turns } = useAsk();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  return (
    <div className={styles.screen}>
      <div className={styles.scroll} ref={scrollRef}>
        <div className={styles.inner}>
          {turns.length === 0 ? (
            <div className={styles.hero}>
              <div className={styles.heroIntro}>
                <span className={styles.heroMark}>
                  <img src="/img/lybi-spiral.png" alt="" />
                </span>
                <span className={styles.heroTitle}>Ask HQ anything</span>
              </div>
              <p className={styles.heroSub}>
                Everything we've put in — meetings, docs, decisions. Answers come with their source.
              </p>
            </div>
          ) : (
            <Conversation />
          )}
        </div>
      </div>

      <div className={styles.composerWrap}>
        <div className={styles.composerInner}>
          <Composer />
        </div>
      </div>
    </div>
  );
}
