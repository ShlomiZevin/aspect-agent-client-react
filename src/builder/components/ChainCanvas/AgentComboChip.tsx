/**
 * AgentComboChip — fixed first card of every crew's cortex.
 *
 * A compact "Agent" anchor that says "this is the agent's chain — it
 * runs before mine." Hover (or click) opens a popup with:
 *   - one row per addon in `agent.cortex`, clickable → opens that
 *     addon's settings modal in read-only mode (you can't edit at
 *     this scope; the link below takes you somewhere you can)
 *   - an "Open agent ↗" link to navigate to the agent page
 *
 * Designed as a starting point for future moves:
 *   1. dragging the combo to a different position in the crew chain
 *   2. removing the combo entirely from a crew
 *   3. breaking the combo into its constituent addons so each can be
 *      moved/removed independently
 * Those aren't built yet — for now the combo is fixed at the start
 * and always there.
 *
 * Click semantics: hover opens the popup; clicking the chip itself
 * toggles the popup (so touch / keyboard users have a path). Each
 * row in the popup opens the read-only addon modal. The popup
 * auto-closes when the mouse leaves both the chip and the popup,
 * with a short delay to prevent flicker.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPlugin } from '../../registry/plugins';
import { AddonModal } from '../AddonModal/AddonModal';
import type { AgentDoc, ID } from '../../types';
import styles from './AgentComboChip.module.css';

interface Props {
  agent: AgentDoc;
  /** Use the smaller compact card sizing (mirrors ChainCanvas's
   *  `compact` flag). */
  compact?: boolean;
}

const POPUP_CLOSE_DELAY_MS = 200;
/** Stable, universally-rendered emoji for the Agent meta-step. The
 *  previous magic-wand glyph rendered as a blank on Windows fonts. */
const AGENT_ICON = '🤖';
const AGENT_COLOR = '#6366f1';

export function AgentComboChip({ agent, compact = false }: Props) {
  const cortex = useMemo(() => agent.cortex ?? [], [agent.cortex]);
  const [popupOpen, setPopupOpen] = useState(false);
  const [viewingInstanceId, setViewingInstanceId] = useState<ID | null>(null);
  const closeTimer = useRef<number | null>(null);

  const viewingInstance = useMemo(
    () => cortex.find(a => a.instanceId === viewingInstanceId) ?? null,
    [cortex, viewingInstanceId],
  );

  // Clear pending close timer on unmount so we don't try to setState
  // on a torn-down component.
  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      setPopupOpen(false);
      closeTimer.current = null;
    }, POPUP_CLOSE_DELAY_MS);
  };

  return (
    <>
      <div
        className={styles.wrap}
        onMouseEnter={() => { cancelClose(); setPopupOpen(true); }}
        onMouseLeave={scheduleClose}
      >
        {/* Same layout as a real chain card (top accent bar + icon +
            name + sub-line) so the agent meta-step reads as part of
            the same visual family. The pill prop is reserved for a
            future compact variant; not used today. */}
        <button
          type="button"
          className={`${styles.combo} ${compact ? styles.comboCompact : ''}`}
          style={{ ['--card-color' as string]: AGENT_COLOR }}
          onClick={() => setPopupOpen(o => !o)}
          aria-haspopup="true"
          aria-expanded={popupOpen}
          title="Agent — runs before this crew on every turn. Hover for the chain."
        >
          <span className={styles.comboIcon}>{AGENT_ICON}</span>
          <span className={styles.comboName}>Agent</span>
          <span className={styles.comboSub}>
            {cortex.length === 0
              ? 'no steps yet'
              : `${cortex.length} step${cortex.length === 1 ? '' : 's'}`}
          </span>
        </button>

        {popupOpen && (
          <div
            className={styles.popup}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            role="dialog"
            aria-label="Agent chain"
          >
            <div className={styles.popupHeader}>
              <span className={styles.popupTitle}>Agent · runs first</span>
              <Link
                to={`/${agent.slug}/builder`}
                className={styles.popupLink}
                onClick={() => setPopupOpen(false)}
                title="Open the agent page to edit the chain"
              >
                Open agent ↗
              </Link>
            </div>

            {cortex.length === 0 ? (
              <div className={styles.popupEmpty}>
                No agent-level steps yet. Open the agent page to add some.
              </div>
            ) : (
              // Mini chain — mirrors the look of the real ChainCanvas
              // (cards + arrows) so the popup feels like a true preview
              // of the agent's chain, not a list.
              <div className={styles.popupChainScroll}>
                <div className={styles.popupChain}>
                  {cortex.map((inst, i) => {
                    const desc = getPlugin(inst.pluginId);
                    if (!desc) return null;
                    const instanceName =
                      (inst.config && typeof (inst.config as { name?: unknown }).name === 'string'
                        ? ((inst.config as { name?: string }).name || '').trim()
                        : '') || desc.name;
                    return (
                      <div key={inst.instanceId} className={styles.popupChainNode}>
                        {i > 0 && <span className={styles.popupChainArrow}>→</span>}
                        <button
                          type="button"
                          className={styles.popupChainCard}
                          style={{ ['--card-color' as string]: desc.color }}
                          onClick={() => {
                            setViewingInstanceId(inst.instanceId);
                            setPopupOpen(false);
                          }}
                          title="View settings (read-only)"
                        >
                          <span
                            className={styles.popupChainIcon}
                            style={{ background: `${desc.color}22`, color: desc.color }}
                          >
                            {desc.icon}
                          </span>
                          <span className={styles.popupChainName}>{instanceName}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Read-only addon modal opened from a row in the popup. The
          AddonModal already handles the readOnly mode (banner +
          disabled fieldset + "Edit at agent level" link). */}
      <AddonModal
        open={viewingInstance !== null}
        onClose={() => setViewingInstanceId(null)}
        agentId={agent.id}
        crewId={null}
        instance={viewingInstance}
        readOnly
      />
    </>
  );
}
