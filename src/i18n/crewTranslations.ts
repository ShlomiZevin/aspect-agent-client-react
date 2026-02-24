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
 * "IDENTITY VERIFICATION" -> "identityVerification"
 * "ACCOUNT TERMS & OFFERS" -> "accountTermsOffers"
 * "WELCOME" -> "welcome"
 * "kyc" -> "kyc"
 */
function crewNameToKey(crewName: string): string {
  // Convert to lowercase first to handle uppercase crew names
  let lowerName = crewName.toLowerCase();

  // Handle special cases
  if (lowerName === 'auto') return 'auto';

  // Remove special characters (keep only letters, numbers, spaces, and dashes)
  lowerName = lowerName.replace(/[^a-z0-9\s-]/g, '');

  // Replace spaces with dashes
  const dashedName = lowerName.replace(/\s+/g, '-');

  // Convert kebab-case to camelCase
  return dashedName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
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
