/**
 * Agent registry — single source of truth mapping URL slug to agent config.
 *
 * Used by:
 *  - DashboardPage      → /:agent/dashboard, /:agent/admin
 *  - AgentLoginPage     → /:agent/login
 *  - AgentChatPage      → /:agent/chat
 *
 * The slug is also the tenant value stamped on users created by the admin,
 * so the same slug must be used everywhere for the same agent.
 *
 * To enable a new agent end-to-end (admin + login + restricted chat),
 * add an entry here.
 */
import type { AgentConfig } from '../types';
import {
  aspectConfig,
  bankingOnboarderConfig,
  bankingOnboarderV2Config,
  bylineConfig,
  compassConfig,
  foremanConfig,
  freedaConfig,
  newdeliConfig,
  thestockConfig,
  tiktokConfig,
  zer4uConfig,
} from './index';

export const AGENT_REGISTRY: Record<string, AgentConfig> = {
  aspect: aspectConfig,
  banking: bankingOnboarderConfig,
  'banking-v2': bankingOnboarderV2Config,
  byline: bylineConfig,
  compass: compassConfig,
  foreman: foremanConfig,
  freeda: freedaConfig,
  newdeli: newdeliConfig,
  thestock: thestockConfig,
  tiktok: tiktokConfig,
  zer4u: zer4uConfig,
};

export function getAgentConfig(slug: string | undefined): AgentConfig | null {
  if (!slug) return null;
  return AGENT_REGISTRY[slug.toLowerCase()] ?? null;
}
