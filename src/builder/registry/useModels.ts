/**
 * useModels — React hook over the providerModels registry.
 *
 * Subscribes to the module-scoped cache so components re-render
 * exactly once after the server registry loads (and on later
 * reloads if we ever add invalidation). Triggers the load lazily —
 * the first hook caller starts the fetch.
 */

import { useEffect, useState } from 'react';
import {
  getProviders,
  getProvider,
  getModel,
  loadModelsFromServer,
  subscribeModels,
  type ModelInfo,
  type ProviderInfo,
} from './providerModels';
import type { ModelRef } from '../types';

export interface UseModelsResult {
  providers: ProviderInfo[];
  loading: boolean;
  getProvider: (providerId: string) => ProviderInfo | undefined;
  getModel: (ref: ModelRef) => ModelInfo | undefined;
}

export function useModels(): UseModelsResult {
  const [providers, setProviders] = useState<ProviderInfo[]>(getProviders());

  useEffect(() => {
    if (providers.length === 0) {
      loadModelsFromServer().then(p => setProviders(p));
    }
    const unsub = subscribeModels(() => setProviders(getProviders()));
    return unsub;
  }, [providers.length]);

  return {
    providers,
    loading: providers.length === 0,
    getProvider,
    getModel,
  };
}
