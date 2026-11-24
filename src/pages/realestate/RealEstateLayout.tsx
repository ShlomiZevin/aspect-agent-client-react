/**
 * /aspect/realestate — the real-estate demo's shell: the pages (brief, board,
 * reports) through <Outlet>, and the same chat every Aspect project has — the
 * Intelligence ChatWidget (corner panel, resizable, expands to full screen
 * under the top bar, conversation history) opened from the ✦ orb. The widget
 * runs the real chat in an iframe (/realestate/chat-widget), which this demo
 * opens without a sign-in (AgentChatWidgetPage's PUBLIC_DEMO_AGENTS).
 */
import { useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AgentProvider, ThemeProvider, UserProvider } from '../../context';
import { LanguageProvider, useLanguage } from '../../context/LanguageContext';
import { ChatWidget } from '../../components/intelligence/ChatWidget';
import { ensureIntelligenceFontsLoaded } from '../../components/intelligence/fonts';
import shellStyles from '../../components/intelligence/IntelligenceShell.module.css';
import { realestateConfig } from '../../agents';
import { RealEstateChatContext } from './chatContext';
import styles from './RealEstateLayout.module.css';

const TOP_BAR_HEIGHT = 64; // RealEstateTopbar — the expanded chat sits flush under it

function DemoChat({ open, everOpened, onOpen, onClose, pending, onPendingConsumed }: { open: boolean; everOpened: boolean; onOpen: () => void; onClose: () => void; pending: string | null; onPendingConsumed: () => void }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { ensureIntelligenceFontsLoaded(); }, []);

  return (
    // The widget's look comes from the Intelligence shell's --ai-* tokens (brand
    // colour from this agent's theme); display: contents keeps the tokens without
    // the shell's full-page box.
    <div className={shellStyles.shell} style={{ display: 'contents' }}>
      {everOpened && (
        <ChatWidget
          datasetId="realestate"
          open={open}
          expanded={expanded}
          onExpandedChange={setExpanded}
          onClose={onClose}
          headerHeight={TOP_BAR_HEIGHT}
          pendingQuestion={pending}
          onPendingQuestionConsumed={onPendingConsumed}
        />
      )}
      {!open && (
        <div className={shellStyles.launcherWrap}>
          <div className={shellStyles.teaser}>{t('intel.launcher.teaser')}</div>
          <button className={shellStyles.orb} onClick={onOpen} aria-label="שאל את ה-AI">✦</button>
        </div>
      )}
    </div>
  );
}

export function RealEstateLayout() {
  const [open, setOpen] = useState(false);
  // The widget mounts on first open and then only hides, so a conversation survives close/reopen.
  const [everOpened, setEverOpened] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const chat = useMemo(() => ({
    openChat: (question?: string) => {
      setOpen(true);
      setEverOpened(true);
      if (question?.trim()) setPending(question.trim());
    },
  }), []);

  return (
    <ThemeProvider storagePrefix={realestateConfig.storagePrefix}>
      <LanguageProvider storagePrefix={realestateConfig.storagePrefix}>
        <UserProvider storagePrefix={realestateConfig.storagePrefix} baseURL={realestateConfig.baseURL}>
          <AgentProvider config={realestateConfig}>
            <RealEstateChatContext.Provider value={chat}>
              <div className={styles.shell}>
                <Outlet />
              </div>
              <DemoChat open={open} everOpened={everOpened} onOpen={() => chat.openChat()} onClose={() => setOpen(false)} pending={pending} onPendingConsumed={() => setPending(null)} />
            </RealEstateChatContext.Provider>
          </AgentProvider>
        </UserProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
