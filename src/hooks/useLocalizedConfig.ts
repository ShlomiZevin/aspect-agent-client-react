import { useMemo } from 'react';
import { useAgentConfig } from '../context/AgentContext';
import { useLanguage } from '../context/LanguageContext';
import type { AgentConfig } from '../types';

/**
 * Hook to get localized agent config values
 * Returns the agent config with localized text based on current language
 */
export function useLocalizedConfig() {
  const config = useAgentConfig();
  const { t, language } = useLanguage();

  const localizedConfig = useMemo(() => {
    // Detect agent name from storage prefix or agent name
    const agentKey = config.storagePrefix.replace('_', '').toLowerCase();

    // Return config with localized values
    return {
      ...config,
      headerTitle: t(`agent.${agentKey}.headerTitle`) !== `agent.${agentKey}.headerTitle`
        ? t(`agent.${agentKey}.headerTitle`)
        : config.headerTitle,
      headerSubtitle: t(`agent.${agentKey}.headerSubtitle`) !== `agent.${agentKey}.headerSubtitle`
        ? t(`agent.${agentKey}.headerSubtitle`)
        : config.headerSubtitle,
      welcomeTitle: t(`agent.${agentKey}.welcomeTitle`) !== `agent.${agentKey}.welcomeTitle`
        ? t(`agent.${agentKey}.welcomeTitle`)
        : config.welcomeTitle,
      welcomeMessage: t(`agent.${agentKey}.welcomeMessage`) !== `agent.${agentKey}.welcomeMessage`
        ? t(`agent.${agentKey}.welcomeMessage`)
        : config.welcomeMessage,
      inputPlaceholder: t(`agent.${agentKey}.inputPlaceholder`) !== `agent.${agentKey}.inputPlaceholder`
        ? t(`agent.${agentKey}.inputPlaceholder`)
        : config.inputPlaceholder,
    } as AgentConfig;
  }, [config, t, language]);

  return localizedConfig;
}
