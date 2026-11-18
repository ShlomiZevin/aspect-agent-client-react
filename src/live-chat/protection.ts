/**
 * Data protection in the browser (task #986) — the check that runs BEFORE
 * a customer message is sent, so sensitive text never leaves the device.
 *
 * Same rules as the server gate: the detectors, the agent + current-crew
 * merge and the message all come from the ONE shared file
 * (aspect-agent-server/builder/protection/detectors.mjs, via @protection).
 * The server still checks every message — this is the first line, not the
 * only one.
 */

import { checkMessage, DETECTORS } from '@protection/detectors.mjs';
import type { AgentDoc, AgentBody, CrewBody } from '../builder/types';

/** The bodies a check needs: the agent's and each crew's, for ONE version. */
export interface ProtectionSource {
  agentBody: Pick<AgentBody, 'dataProtection' | 'defaultCrewId'> | null;
  crewBodies: Record<string, Pick<CrewBody, 'dataProtection'>>;
}

export interface ProtectionBlock {
  detectors: string[];
  message: string;
}

/**
 * The PUBLISHED bodies of a hydrated agent — what the customer chat runs.
 * Same pointer rule as the server (`pickVersionId('published')`):
 * published, else active, else viewing.
 */
export function publishedSource(agent: AgentDoc | null | undefined): ProtectionSource | null {
  if (!agent) return null;
  const pick = (row: { publishedVersionId?: string | null; activeVersionId?: string; viewingVersionId?: string }) =>
    row.publishedVersionId || row.activeVersionId || row.viewingVersionId;
  const agentVid = pick(agent);
  const agentBody = agent.versions.find(v => v.id === agentVid)?.body ?? null;
  const crewBodies: ProtectionSource['crewBodies'] = {};
  for (const crew of agent.crews ?? []) {
    const vid = pick(crew);
    const body = crew.versions.find(v => v.id === vid)?.body;
    if (body) crewBodies[crew.id] = body;
  }
  return { agentBody, crewBodies };
}

/**
 * Check one outgoing message. `crewId` = the conversation's current crew
 * (null → the agent's default crew, like the server).
 * @returns null = send it; otherwise the detectors and the fixed message.
 */
export function checkOutgoing(
  text: string,
  source: ProtectionSource | null,
  crewId: string | null,
  lang: string,
): ProtectionBlock | null {
  if (!source || !source.agentBody) return null;
  const id = (crewId && source.crewBodies[crewId]) ? crewId : (source.agentBody.defaultCrewId ?? null);
  const crewBody = id ? source.crewBodies[id] ?? null : null;
  return checkMessage(text, source.agentBody, crewBody, lang);
}

/** "Israeli ID number, credit card number" in the chat's language. */
export function detectorNames(ids: readonly string[], lang: string): string {
  const names = ids
    .map(id => DETECTORS.find(d => d.id === id))
    .filter((d): d is (typeof DETECTORS)[number] => !!d)
    .map(d => (lang === 'en' ? d.name.en : d.name.he));
  return names.join(', ');
}
