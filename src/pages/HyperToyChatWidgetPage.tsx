/**
 * Compact hypertoy chat for embedding in the Aspect Intelligence floating
 * widget (see components/intelligence/ChatWidget.tsx). Same provider stack,
 * same storagePrefix, and therefore the exact same conversation/history as
 * the full /hypertoy page — just without the AppLayout chrome (top header,
 * conversation-history sidebar) around it. HyperToyPage itself is untouched.
 *
 * PrefillSender: the widget's own bespoke welcome tiles (ChatWelcome.tsx)
 * hand off the clicked question via sessionStorage (set right before
 * navigating here, read+cleared once on mount) rather than a `?prefill=`
 * URL param — an earlier query-param + immediate-effect version raced with
 * React StrictMode's double-mount in dev and hung a request. Reading from
 * sessionStorage instead of `useSearchParams()` avoids that extra reactive
 * dependency. Gated on `userId` from UserContext (not a blind fixed delay):
 * a fixed-delay version sent the message before the anon user finished being
 * created, so the request went out with `userId: null` — the conversation
 * got persisted but under no real user, invisible to the history panel's
 * per-user lookup forever after. Waiting for `userId` to actually exist
 * before sending fixes that at the source.
 */
import { useEffect, useState } from 'react';
import { ChatProvider, useChatContext } from '../context';
import { ThemeProvider } from '../context/ThemeContext';
import { UserProvider, useUserContext } from '../context/UserContext';
import { AgentProvider } from '../context/AgentContext';
import { LanguageProvider } from '../context/LanguageContext';
import { ChatContainer } from '../components/chat';
import { hypertoyConfig } from '../agents';
import { useDocumentMeta } from '../hooks';
import { ensureIntelligenceFontsLoaded } from '../components/intelligence/fonts';

export const PREFILL_STORAGE_KEY = 'aspect_intelligence_prefill';

function PrefillSender({ onSent }: { onSent: () => void }) {
  const { sendMessage } = useChatContext();
  const { userId } = useUserContext();

  useEffect(() => {
    // Deliberately re-reads sessionStorage fresh on every effect run rather
    // than guarding with a ref set *before* the timer fires: React
    // StrictMode's dev-mode mount→cleanup→mount double-invoke would cancel
    // the first pass's timer via cleanup, and a ref flipped early would then
    // make the second (real) pass see "already sent" and skip scheduling
    // entirely - net result, it never fires. Removing the key only inside
    // the timeout, once the send is actually happening, makes the *first*
    // real mount whose timer isn't cancelled the one that sends - exactly
    // once - regardless of how many times StrictMode re-invokes this effect.
    // Also waits for `userId` to be non-null (re-runs when it flips from
    // null to a real id) rather than sending on a fixed timer that could
    // race ahead of anon-user creation - see file header comment.
    const prefill = sessionStorage.getItem(PREFILL_STORAGE_KEY);
    if (!prefill || !userId) return;
    const timer = setTimeout(() => {
      if (sessionStorage.getItem(PREFILL_STORAGE_KEY) !== prefill) return;
      sessionStorage.removeItem(PREFILL_STORAGE_KEY);
      sendMessage(prefill);
      onSent();
    }, 300);
    return () => clearTimeout(timer);
  }, [userId, sendMessage, onSent]);

  return null;
}

/** Shown instead of ChatContainer while a prefilled question is in flight — see the `pendingPrefill` comment below. */
function PrefillLoading() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#8B80A0', fontSize: 13, fontFamily: "'Public Sans', system-ui, sans-serif" }}>
      <span style={{ width: 15, height: 15, borderRadius: '50%', border: '2px solid #F1EAFA', borderTopColor: '#7C3AED', animation: 'aspect-prefill-spin .7s linear infinite', flexShrink: 0 }} />
      Asking Aspect…
      <style>{'@keyframes aspect-prefill-spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}

export function HyperToyChatWidgetPage() {
  useDocumentMeta({
    title: hypertoyConfig.pageTitle,
    favicon: hypertoyConfig.favicon,
    description: hypertoyConfig.metaDescription,
  });

  // A prefilled question (see PrefillSender above) is about to be sent into
  // this brand-new, still-empty conversation — until then, ChatContainer
  // would render the REAL hypertoy chat's own native welcome screen (Hebrew
  // "היפר טוי" branding, its own colored icon set), visibly different from
  // this widget's bespoke ChatWelcome the user just saw a moment ago. That
  // mismatched flash is exactly what a brief loading state avoids. Read
  // once, synchronously, at mount — before PrefillSender's effect has had a
  // chance to remove the key — so this is true for the very first paint.
  const [pendingPrefill, setPendingPrefill] = useState(() => !!sessionStorage.getItem(PREFILL_STORAGE_KEY));

  // This page is its own document (loaded in an iframe) — it does NOT
  // inherit the parent Aspect Intelligence page's <link> font tags, so the
  // real chat rendered here was falling back to its native "Heebo" font
  // stack instead of the design's Public Sans/Schibsted Grotesk. Load them
  // here too, same as IntelligenceShell does for the parent page.
  useEffect(() => { ensureIntelligenceFontsLoaded(); }, []);

  return (
    <ThemeProvider storagePrefix={hypertoyConfig.storagePrefix}>
      <LanguageProvider storagePrefix={hypertoyConfig.storagePrefix}>
        <UserProvider storagePrefix={hypertoyConfig.storagePrefix} baseURL={hypertoyConfig.baseURL}>
          <AgentProvider config={hypertoyConfig}>
            <ChatProvider>
              <PrefillSender onSent={() => setPendingPrefill(false)} />
              {/* Scoped visual tweaks to match the design, without touching
                  ChatContainer/Message's own CSS modules — substring class
                  matches on their hashed module classnames, only in effect
                  on this page:
                  - body font/color: the real chat's native stack is Heebo /
                    #1a1a1a; overridden to the design's Public Sans + #241A38
                    so this page's text matches the rest of the widget
                    (ChatWelcome, ChatHistoryPanel) instead of visibly
                    switching fonts once a conversation starts.
                  - crewHeader: hides the "Hyper Toy" + online-dot pill,
                    redundant since the widget's own header shows "Data Chat".
                  - _bot_: assistant reply bubble recolored to the design's
                    light-lavender card (#F8F5FC) instead of plain white — but
                    the descendant text-color override only reaches PLAIN
                    prose, not table headers or the "view/download table"
                    button, both of which keep their own purple background
                    from the real chat's styles and need white text for
                    contrast (the blanket `*` selector was overriding those
                    too, leaving near-black text on a purple background).
                  - _crewLabel_: hides the "HYPER TOY" text above replies,
                    not present in the design.
                  - _bar_dz658_ (DataStatusBar's own hashed class, exact
                    match not a substring — ImportingBanner uses the same
                    source class name "bar" and must stay visible): hides
                    its own "Last sync / Data from / Data through" line,
                    redundant with the widget's expanded-mode header and the
                    Aspect Intelligence page's own breadcrumb row, both of
                    which already show the same sync info above this iframe. */}
              <style>{`
                body { font-family: 'Public Sans', system-ui, sans-serif !important; color: #241A38 !important; }
                [class*="crewHeader"] { display: none !important; }
                [class*="_bot_"] { background: #F8F5FC !important; border: none !important; border-radius: 4px 14px 14px 14px !important; }
                [class*="_bot_"], [class*="_bot_"] * { color: #241A38 !important; }
                /* ...except anything that carries its own colored
                   background (table headers, the download/view-table
                   button) — those still need white text for contrast, the
                   line above was clobbering them too. */
                [class*="_bot_"] th, [class*="_bot_"] th *,
                [class*="_bot_"] button, [class*="_bot_"] button * {
                  color: #fff !important;
                }
                [class*="_crewLabel_"] { display: none !important; }
                [class^="_bar_dz658_"] { display: none !important; }
              `}</style>
              <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
                {pendingPrefill
                  ? <PrefillLoading />
                  : <ChatContainer crewMode="tabs" crewPosition="right" />}
              </div>
            </ChatProvider>
          </AgentProvider>
        </UserProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
