/**
 * Data protection (task #986) — the Builder's controls. Built ONLY from
 * existing Builder pieces (Shlomi, 2026-11-18: no new visual language):
 *
 *   DataProtectionRow       the agent setting, next to "Model route" in the
 *                           agent page's Setup card — same segmented Off/On,
 *                           a summary, and the Web-search "Edit" button.
 *   DataProtectionModal     the settings: the switch, one toggle per detector,
 *                           the blocked message he/en (agent) — or the crew's
 *                           exception: follow the agent / on / off per detector.
 *   DataProtectionGateCard  a fixed first card in the Cortex (the Agent combo
 *                           chip's card style): "this runs before everything,
 *                           in code". Click → the settings above.
 *
 * Edits go to the working copy (Save in the top bar makes the version), like
 * the Model route switch. The detector list and every rule come from the
 * shared file the server gate runs (builder/protection/detectors.mjs, via
 * the @protection alias), so what this shows is exactly what runs.
 */

import { useMemo, useState } from 'react';
import {
  DETECTORS,
  DEFAULT_BLOCKED_MESSAGE,
  MAX_MESSAGE_LENGTH,
  resolveSettings,
} from '@protection/detectors.mjs';
import type { DetectorId } from '@protection/detectors.mjs';
import { useBuilder } from '../../state/BuilderContext';
import { Modal } from '../Modal/Modal';
import type { AgentDoc, CrewDoc, DataProtectionSettings, CrewDataProtection } from '../../types';
import rowStyles from '../Canvas/AgentSetupArea.module.css';
import ws from '../WebSearch/WebSearchSetting.module.css';
import cardStyles from '../ChainCanvas/AgentComboChip.module.css';

const SHIELD = '🛡';
const GATE_COLOR = '#0f766e';

/** Short names for the one-line summaries. */
const SHORT: Record<DetectorId, string> = {
  il_id: 'ID', credit_card: 'card', iban: 'IBAN', bank_account: 'account',
  passport: 'passport', phone: 'phone', email: 'email',
};

const ROW_TIP = 'Stops a customer message holding sensitive personal data before it is saved or reaches any model — in code, no model. Runs in the browser and on the server.';

function summaryOf(ids: readonly DetectorId[]): string {
  return ids.length ? ids.map(id => SHORT[id]).join(' · ') : 'no detectors on';
}

/** Off with nothing else set == absent (empty == absent, no phantom "unsaved"). */
function tidyAgent(dp: DataProtectionSettings): DataProtectionSettings | undefined {
  const out: DataProtectionSettings = { enabled: dp.enabled };
  if (dp.detectors && Object.keys(dp.detectors).length) out.detectors = dp.detectors;
  const msg = Object.fromEntries(Object.entries(dp.blockedMessage ?? {}).filter(([, v]) => typeof v === 'string' && v.trim()));
  if (Object.keys(msg).length) out.blockedMessage = msg;
  if (!out.enabled && !out.detectors && !out.blockedMessage) return undefined;
  return out;
}

// ─── Agent row (Setup card) ──────────────────────────────────────────

export function DataProtectionRow({ agent }: { agent: AgentDoc }) {
  const { updateAgent } = useBuilder();
  const [open, setOpen] = useState(false);
  const resolved = useMemo(() => resolveSettings(agent.dataProtection), [agent.dataProtection]);
  const on = resolved.enabled;
  // What it WOULD check — shown dimmed while off, so turning it on moves nothing.
  const wouldCheck = useMemo(
    () => resolveSettings({ ...(agent.dataProtection ?? {}), enabled: true }).detectorIds,
    [agent.dataProtection],
  );
  const exceptions = (agent.crews ?? []).filter(c => Object.keys(c.dataProtection?.detectors ?? {}).length > 0).length;

  const setOn = (next: boolean) => {
    if (next === on) return;
    updateAgent(agent.id, { dataProtection: tidyAgent({ ...(agent.dataProtection ?? { enabled: false }), enabled: next }) });
  };

  return (
    <div className={rowStyles.route}>
      <span className={rowStyles.routeLabel} title={ROW_TIP}>Data protection</span>
      <div className={rowStyles.routeSeg} role="radiogroup" aria-label="Data protection">
        <button
          type="button" role="radio" aria-checked={!on}
          className={`${rowStyles.routeOpt} ${!on ? rowStyles.routeOptOn : ''}`}
          onClick={() => setOn(false)}
          title="No message is stopped (default)"
        >
          Off
        </button>
        <button
          type="button" role="radio" aria-checked={on}
          className={`${rowStyles.routeOpt} ${on ? rowStyles.routeOptOn : ''}`}
          onClick={() => setOn(true)}
          title={`Stop messages with: ${summaryOf(wouldCheck)}`}
        >
          On
        </button>
      </div>
      <span
        className={`${ws.summary} ${on ? '' : ws.summaryOff}`}
        title={exceptions ? `${exceptions} crew exception${exceptions === 1 ? '' : 's'} — see the crew's Data protection card` : undefined}
      >
        {summaryOf(wouldCheck)}{exceptions ? ` · ${exceptions} crew exception${exceptions === 1 ? '' : 's'}` : ''}
      </span>
      <button type="button" className={ws.editBtn} onClick={() => setOpen(true)} title="Detectors and the message the customer sees">
        Edit
      </button>
      {open && <DataProtectionModal agent={agent} crew={null} onClose={() => setOpen(false)} />}
    </div>
  );
}

// ─── Settings modal ──────────────────────────────────────────────────

export function DataProtectionModal({ agent, crew, onClose }: {
  agent: AgentDoc;
  /** null = the agent's settings; a crew = that crew's exception. */
  crew: CrewDoc | null;
  onClose: () => void;
}) {
  return crew
    ? <CrewExceptionModal agent={agent} crew={crew} onClose={onClose} />
    : <AgentSettingsModal agent={agent} onClose={onClose} />;
}

function AgentSettingsModal({ agent, onClose }: { agent: AgentDoc; onClose: () => void }) {
  const { updateAgent } = useBuilder();
  const start = agent.dataProtection;
  const [enabled, setEnabled] = useState(start?.enabled === true);
  const [switches, setSwitches] = useState<Partial<Record<DetectorId, boolean>>>({ ...(start?.detectors ?? {}) });
  const [he, setHe] = useState(start?.blockedMessage?.he ?? '');
  const [en, setEn] = useState(start?.blockedMessage?.en ?? '');

  const isOn = (id: DetectorId, def: boolean) => (typeof switches[id] === 'boolean' ? switches[id] as boolean : def);
  const flip = (id: DetectorId, def: boolean, next: boolean) => {
    setSwitches(s => {
      const out = { ...s };
      // Back at its default → drop the switch, so the body stays minimal.
      if (next === def) delete out[id]; else out[id] = next;
      return out;
    });
  };
  const tooLong = he.length > MAX_MESSAGE_LENGTH || en.length > MAX_MESSAGE_LENGTH;

  const save = () => {
    updateAgent(agent.id, {
      dataProtection: tidyAgent({ enabled, detectors: switches, blockedMessage: { he, en } }),
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${SHIELD} Data protection`}
      badge="Agent"
      width={620}
      footer={
        <div className={ws.footer}>
          <button type="button" className={ws.cancelBtn} onClick={onClose}>Cancel</button>
          <span className={ws.footerSpacer} />
          <button type="button" className={ws.saveBtn} onClick={save} disabled={tooLong}>Apply</button>
        </div>
      }
    >
      <div className={ws.body}>
        <p className={ws.permLine}>
          Code only, no model. Runs in the customer's browser before sending and on the server for every channel. A stopped message is not saved and no add-on sees it.
        </p>
        <div className={ws.row}>
          <Toggle on={enabled} onChange={setEnabled} label="Data protection on" />
          <span className={`${ws.summary} ${enabled ? '' : ws.summaryOff}`}>{enabled ? 'On' : 'Off — no message is stopped'}</span>
        </div>

        <div className={ws.field}>
          <span className={ws.label} title="A crew can override these for messages that arrive while it is the current crew — open that crew's Data protection card.">
            Detectors
          </span>
          {DETECTORS.map(det => {
            const on = isOn(det.id, det.defaultOn);
            return (
              <div key={det.id} className={ws.row} title={det.matches.en}>
                <Toggle on={on} onChange={v => flip(det.id, det.defaultOn, v)} label={det.name.en} dim={!enabled} />
                <span className={`${ws.summary} ${on && enabled ? '' : ws.summaryOff}`}>
                  {det.name.en}{typeof switches[det.id] === 'boolean' ? '' : ' · default'}
                </span>
              </div>
            );
          })}
        </div>

        <label className={ws.field}>
          <span className={ws.label}>Message the customer sees — Hebrew</span>
          <textarea
            className={ws.textarea} rows={3} dir="rtl" value={he}
            placeholder={DEFAULT_BLOCKED_MESSAGE.he}
            onChange={e => setHe(e.target.value)}
          />
          <span className={`${ws.note} ${he.length > MAX_MESSAGE_LENGTH ? ws.noteBad : ''}`}>
            {he.length > MAX_MESSAGE_LENGTH ? `Too long (${he.length}/${MAX_MESSAGE_LENGTH})` : 'Empty = the built-in text shown in the box.'}
          </span>
        </label>
        <label className={ws.field}>
          <span className={ws.label}>Message the customer sees — English</span>
          <textarea
            className={ws.textarea} rows={3} value={en}
            placeholder={DEFAULT_BLOCKED_MESSAGE.en}
            onChange={e => setEn(e.target.value)}
          />
          <span className={`${ws.note} ${en.length > MAX_MESSAGE_LENGTH ? ws.noteBad : ''}`}>
            {en.length > MAX_MESSAGE_LENGTH ? `Too long (${en.length}/${MAX_MESSAGE_LENGTH})` : 'Empty = the built-in text shown in the box.'}
          </span>
        </label>
      </div>
    </Modal>
  );
}

type CrewChoice = 'follow' | 'on' | 'off';

function CrewExceptionModal({ agent, crew, onClose }: { agent: AgentDoc; crew: CrewDoc; onClose: () => void }) {
  const { updateCrew } = useBuilder();
  const agentResolved = useMemo(() => resolveSettings(agent.dataProtection), [agent.dataProtection]);
  // The agent's switches as if on — what "follow the agent" means per detector.
  const agentWould = useMemo(
    () => new Set(resolveSettings({ ...(agent.dataProtection ?? {}), enabled: true }).detectorIds),
    [agent.dataProtection],
  );
  const [choices, setChoices] = useState<Partial<Record<DetectorId, boolean>>>({ ...(crew.dataProtection?.detectors ?? {}) });
  const choiceOf = (id: DetectorId): CrewChoice => (typeof choices[id] === 'boolean' ? (choices[id] ? 'on' : 'off') : 'follow');
  const setChoice = (id: DetectorId, c: CrewChoice) => {
    setChoices(s => {
      const out = { ...s };
      if (c === 'follow') delete out[id]; else out[id] = c === 'on';
      return out;
    });
  };

  const save = () => {
    const next: CrewDataProtection | undefined = Object.keys(choices).length ? { detectors: choices } : undefined;
    updateCrew(agent.id, crew.id, { dataProtection: next });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${SHIELD} Data protection`}
      badge={`Crew · ${crew.name || 'crew'}`}
      width={620}
      footer={
        <div className={ws.footer}>
          <button type="button" className={ws.cancelBtn} onClick={onClose}>Cancel</button>
          <span className={ws.footerSpacer} />
          <button type="button" className={ws.saveBtn} onClick={save}>Apply</button>
        </div>
      }
    >
      <div className={ws.body}>
        <p className={ws.permLine}>
          Exceptions for messages that arrive while this crew is the current one — e.g. turn the ID off in the crew that collects it.
        </p>
        <span className={`${ws.note} ${agentResolved.enabled ? '' : ws.noteBad}`}>
          {agentResolved.enabled
            ? `Agent: on — checks ${summaryOf(agentResolved.detectorIds)}.`
            : 'Agent: off — nothing is checked in any crew. Exceptions apply once it is on (agent page → Setup).'}
        </span>
        <div className={ws.field}>
          <span className={ws.label}>Detectors in this crew</span>
          {DETECTORS.map(det => {
            const c = choiceOf(det.id);
            const follows = agentWould.has(det.id);
            const effective = c === 'follow' ? follows : c === 'on';
            return (
              <div key={det.id} className={ws.row} title={det.matches.en}>
                <span className={`${ws.summary} ${effective && agentResolved.enabled ? '' : ws.summaryOff}`}>{det.name.en}</span>
                <select
                  className={ws.select}
                  style={{ width: 210, flex: '0 0 auto' }}
                  value={c}
                  onChange={e => setChoice(det.id, e.target.value as CrewChoice)}
                  aria-label={`${det.name.en} in this crew`}
                >
                  <option value="follow">Follow the agent ({follows ? 'on' : 'off'})</option>
                  <option value="on">On in this crew</option>
                  <option value="off">Off in this crew</option>
                </select>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

/** The Web-search switch (same markup + styles). */
function Toggle({ on, onChange, label, dim = false }: { on: boolean; onChange: (v: boolean) => void; label: string; dim?: boolean }) {
  return (
    <span className={`${ws.toggle} ${on ? ws.toggleOn : ''} ${dim ? ws.toggleDisabled : ''}`}>
      <input
        type="checkbox"
        className={ws.toggleInput}
        checked={on}
        onChange={e => onChange(e.target.checked)}
        aria-label={label}
      />
      <span className={ws.toggleKnob} />
    </span>
  );
}

// ─── Cortex gate card ────────────────────────────────────────────────

/**
 * Fixed first card of the Cortex at both scopes: data protection runs
 * before anything else, in code. Agent scope → the agent settings; crew
 * scope → this crew's exception (showing what applies HERE).
 */
export function DataProtectionGateCard({ agent, crew, compact = false }: {
  agent: AgentDoc;
  crew: CrewDoc | null;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const resolved = useMemo(
    () => resolveSettings(agent.dataProtection, crew?.dataProtection),
    [agent.dataProtection, crew?.dataProtection],
  );
  const n = resolved.detectorIds.length;
  const sub = !resolved.enabled
    ? 'off'
    : `${n} check${n === 1 ? '' : 's'}${resolved.crewOverrides.length ? ' · exception' : ''}`;
  const tip = !resolved.enabled
    ? 'Data protection — off. Runs first, in code (no model). Click to set it up.'
    : `Data protection — runs first, in code (no model). Stops: ${summaryOf(resolved.detectorIds)}${resolved.crewOverrides.length ? ` (this crew overrides: ${resolved.crewOverrides.map(id => SHORT[id]).join(', ')})` : ''}. Click to ${crew ? 'set this crew\'s exceptions' : 'edit'}.`;

  return (
    <>
      <div className={cardStyles.wrap}>
        <button
          type="button"
          className={`${cardStyles.combo} ${compact ? cardStyles.comboCompact : ''}`}
          style={{ ['--card-color' as string]: GATE_COLOR, opacity: resolved.enabled ? 1 : 0.6 }}
          onClick={() => setOpen(true)}
          title={tip}
        >
          <span className={cardStyles.comboIcon}>{SHIELD}</span>
          <span className={cardStyles.comboName}>Data protection</span>
          <span className={cardStyles.comboSub}>{sub}</span>
        </button>
      </div>
      {open && <DataProtectionModal agent={agent} crew={crew} onClose={() => setOpen(false)} />}
    </>
  );
}
