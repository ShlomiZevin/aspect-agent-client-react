import type { AgentConfig } from '../types';
import { freedaConfig } from './freeda.config';

/**
 * FreedaNext — the customer-facing web chat for the Freeda 1.0 engine.
 * Same branding as Freeda, but with message/history management hidden
 * (the Freeda 1.0 backend has no message-deletion functionality).
 */
export const freedaNextConfig: AgentConfig = {
  ...freedaConfig,
  storagePrefix: 'freedanext_',
  features: {
    ...freedaConfig.features,
    hideMessageActions: true,
    hideHistoryManagement: true,
  },
};
