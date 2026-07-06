import {
  IconMenu, IconNewChat, IconProfiler, IconBrain, IconSettings, IconBuilder, IconSite, IconExpand,
} from '../icons';
import type { Dict } from '../i18n';

interface Props {
  t: Dict;
  /** Logo image (brand data URL or client logo); null → show the name mark. */
  logo: string | null;
  brandName: string;
  /** True for the built-in Lybi logo (gets a dark-mode colour filter). */
  logoFilterable: boolean;
  debug: boolean;
  /** True when rendered inside the on-site widget iframe (hides the
   *  "view as embed" button so there's no embed-inside-embed). */
  embed: boolean;
  brainOpen: boolean;
  profilerOpen: boolean;
  onHistory: () => void;
  onNewChat: () => void;
  onToggleBrain: () => void;
  onToggleProfiler: () => void;
  onSettings: (e: React.MouseEvent) => void;
  onOpenBuilder: () => void;
  onViewEmbed: () => void;
  /** Embed mode only — break out of the widget iframe back to the full
   *  desktop chat, carrying the current conversation. */
  onOpenFull: () => void;
  settingsBtnRef: React.RefObject<HTMLButtonElement | null>;
}

export function TopBar({
  t, logo, brandName, logoFilterable, debug, embed, brainOpen, profilerOpen,
  onHistory, onNewChat, onToggleBrain, onToggleProfiler, onSettings, onOpenBuilder, onViewEmbed, onOpenFull,
  settingsBtnRef,
}: Props) {
  return (
    <header className="topbar">
      <button className="icon-btn" onClick={onHistory} aria-label="history" title={t.history}>
        <IconMenu />
      </button>
      <div className="brand" data-logofilter={logoFilterable ? 'on' : 'off'}>
        {logo
          ? <img src={logo} alt={brandName} />
          : <span className="client-mark"><span className="dot" />{brandName}</span>}
      </div>
      <span className="mode-tag">DEBUG</span>
      <div className="spacer" />

      {debug && (
        <button className="icon-btn" onClick={onOpenBuilder} aria-label="builder" title={t.openInBuilder}>
          <IconBuilder />
        </button>
      )}
      {!embed && (
        <button className="icon-btn" onClick={onViewEmbed} aria-label="embed" title={t.viewOnSite}>
          <IconSite />
        </button>
      )}
      {embed && (
        <button className="icon-btn" onClick={onOpenFull} aria-label="open full chat" title={t.openFullChat}>
          <IconExpand />
        </button>
      )}
      <button className="icon-btn" onClick={onNewChat} aria-label="new chat" title={t.newChat}>
        <IconNewChat />
      </button>
      <span className="divider" />
      <button className={`icon-btn ${profilerOpen ? 'active' : ''}`} onClick={onToggleProfiler} aria-label="profiler" title={t.profiler}>
        <IconProfiler />
      </button>
      <button className={`icon-btn ${brainOpen ? 'active' : ''}`} onClick={onToggleBrain} aria-label="brain" title={t.brain}>
        <IconBrain />
      </button>
      {!embed && (
        <>
          <span className="divider" />
          <button ref={settingsBtnRef} className="icon-btn" onClick={onSettings} aria-label="settings" title={t.settings}>
            <IconSettings />
          </button>
        </>
      )}
    </header>
  );
}
