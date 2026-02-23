import { translations } from './translations';
import type { Language } from '../types';

/**
 * Get translation key prefix for a crew member
 * Converts agent name to lowercase and removes spaces/special chars
 */
function getCrewKeyPrefix(agentName: string): string {
  // Convert agent name to the format used in translation keys
  // "Banking Onboarder" -> "banking"
  // "Aspect" -> "aspect"
  // Take only the first word and convert to lowercase
  const firstWord = agentName.split(/\s+/)[0];
  return firstWord.toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * Convert crew member name to camelCase for translation key
 * "entry-introduction" -> "entryIntroduction"
 * "kyc" -> "kyc"
 */
function crewNameToKey(crewName: string): string {
  // Handle special cases
  if (crewName === 'auto') return 'auto';

  // Convert kebab-case to camelCase
  return crewName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

/**
 * Get translated crew display name
 */
export function getTranslatedCrewName(
  agentName: string,
  crewName: string,
  language: Language,
  fallback: string
): string {
  const prefix = getCrewKeyPrefix(agentName);
  const key = crewNameToKey(crewName);
  const translationKey = `crew.${prefix}.${key}` as keyof typeof translations.en;

  const translation = translations[language]?.[translationKey];
  return translation || fallback;
}

/**
 * Get translated crew description
 */
export function getTranslatedCrewDescription(
  agentName: string,
  crewName: string,
  language: Language,
  fallback: string
): string {
  const prefix = getCrewKeyPrefix(agentName);
  const key = crewNameToKey(crewName);
  const translationKey = `crew.${prefix}.${key}Description` as keyof typeof translations.en;

  const translation = translations[language]?.[translationKey];
  return translation || fallback;
}
