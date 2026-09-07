/**
 * Smart Tune — the scoped chat transport.
 *
 * Posts one turn to POST /api/finance-assistant/turn — the server's buffered
 * JSON chat entry (same pipeline and DB writes as the SSE /stream the main
 * data chat uses; the legacy path name serves every agent) — with the
 * standard body PLUS `moduleScope`, which tells the dispatcher to run the
 * module-scoped crew with the scope's tools only (fetch_replenishment +
 * propose_group_change) and inject the Smart Tune prompt fragment.
 *
 * The turn response carries `toolResults` — structured tool payloads surfaced
 * exactly for JSON clients like this panel; a result carrying `proposal` is
 * the PREVIEW of a change: the panel renders it as a card with Process/Cancel
 * buttons, and nothing moves until Process posts to the module's own
 * /proposals/:id/execute route (replenishmentService) — never through chat.
 *
 * Parsed defensively all the same: a server predating the wiring answers with
 * an ordinary un-scoped reply (moduleScope is inert there), and 404/405/501
 * report as TuneChatUnavailableError so the panel says so honestly.
 */

import { getBaseURL } from './api';
import { getSuperAdminKey } from './superAdminService';
import type { ProcurementGroup, TuneProposal } from '../types/replenishment';

export interface TuneModuleScope {
  moduleId: 'replenishment';
  scopeId: 'tune';
  context: {
    group: ProcurementGroup;
    datasetId: string;
  };
}

export interface TuneChatRequest {
  agentName: string;
  baseURL?: string;
  message: string;
  conversationId: string;
  userId: string | null;
  language?: string;
  moduleScope: TuneModuleScope;
}

export interface TuneChatReply {
  /** The assistant's prose, possibly empty when the turn was pure tool work. */
  text: string;
  /** A previewed change, when the model called propose_group_change. */
  proposal: TuneProposal | null;
}

/** Thrown when the server does not (yet) serve the scoped-chat endpoint. */
export class TuneChatUnavailableError extends Error {
  constructor(status: number) {
    super(`Tune chat endpoint unavailable (${status})`);
    this.name = 'TuneChatUnavailableError';
  }
}

/** Statuses that mean "this server does not serve tune chat", not "this turn failed". */
const UNAVAILABLE_STATUSES = new Set([404, 405, 501]);

/**
 * Walk the reply payload for the first object carrying a `proposal` with the
 * fields the card needs. The payload shape is the server's to evolve
 * (toolResults / tools / a bare `proposal` at the top) — the card's contract
 * is only "a tool result in the reply contains `proposal`".
 */
function findProposal(node: unknown, depth = 0): TuneProposal | null {
  if (!node || typeof node !== 'object' || depth > 6) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findProposal(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const p = obj.proposal;
  if (p && typeof p === 'object' && !Array.isArray(p)) {
    const cand = p as Record<string, unknown>;
    if (cand.proposalId !== undefined && cand.targetGroup !== undefined && Array.isArray(cand.sample)) {
      return cand as unknown as TuneProposal;
    }
  }
  for (const value of Object.values(obj)) {
    const found = findProposal(value, depth + 1);
    if (found) return found;
  }
  return null;
}

/** The assistant's prose, whichever field the server put it in. */
function findText(body: Record<string, unknown>): string {
  for (const key of ['reply', 'response', 'message', 'text', 'answer']) {
    const v = body[key];
    if (typeof v === 'string' && v.trim()) return v;
    // { message: { content: '…' } } — the raw-assistant-message shape.
    if (v && typeof v === 'object' && typeof (v as Record<string, unknown>).content === 'string') {
      return (v as Record<string, string>).content;
    }
  }
  return '';
}

export const tuneChatService = {
  /**
   * One tune-chat turn. Throws TuneChatUnavailableError when the server does
   * not serve the endpoint; any other failure throws with the server's own
   * message (same contract as apiRequest).
   */
  send: async (req: TuneChatRequest): Promise<TuneChatReply> => {
    // fetch rather than apiRequest, for the same reason chatService does it:
    // the chat transport needs the raw STATUS to tell "this server has no tune
    // chat" (404/405/501 → the honest not-enabled bubble) from "this turn
    // failed" — apiRequest collapses both into one thrown message.
    const url = `${req.baseURL || getBaseURL()}/api/finance-assistant/turn`;
    const superKey = getSuperAdminKey();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(superKey ? { 'X-Super-Admin-Key': superKey } : {}),
      },
      body: JSON.stringify({
        message: req.message,
        conversationId: req.conversationId,
        userId: req.userId,
        agentName: req.agentName,
        ...(req.language ? { language: req.language } : {}),
        moduleScope: req.moduleScope,
      }),
    });

    if (UNAVAILABLE_STATUSES.has(response.status)) {
      throw new TuneChatUnavailableError(response.status);
    }
    if (!response.ok) {
      let detail: string | null = null;
      try {
        const parsed = JSON.parse(await response.text()) as { error?: string; message?: string };
        detail = parsed.error || parsed.message || null;
      } catch { /* non-JSON error body */ }
      throw new Error(detail || `Tune chat failed: ${response.status}`);
    }

    const body = (await response.json()) as Record<string, unknown>;
    // A server that answers 200 but ignored moduleScope entirely (the general
    // chat took the turn) still parses here — the text is whatever it said.
    return {
      text: findText(body),
      proposal: findProposal(body),
    };
  },
};
