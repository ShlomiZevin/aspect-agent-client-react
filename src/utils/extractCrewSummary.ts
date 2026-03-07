/**
 * Client-side extraction of crew member summary from source code.
 * Mirrors the server's _extractCrewSummary() for the Prompts tab.
 */

export interface CrewSummary {
  guidance: string | null;
  fields: Array<{ name: string; description: string }>;
  transitionTo: string | null;
  isThinker: boolean;
  thinkingPrompt: string | null;
}

export function extractCrewSummary(source: string): CrewSummary {
  const result: CrewSummary = {
    guidance: null,
    fields: [],
    transitionTo: null,
    isThinker: false,
    thinkingPrompt: null
  };

  // Extract guidance — getter or constructor property
  const guidanceGetterMatch = source.match(/get\s+guidance\s*\(\)\s*\{[\s\S]*?return\s+`([\s\S]*?)`\s*;?\s*\}/);
  if (guidanceGetterMatch) {
    result.guidance = guidanceGetterMatch[1].trim();
  } else {
    const guidancePropMatch = source.match(/guidance:\s*`([\s\S]*?)`/);
    if (guidancePropMatch) result.guidance = guidancePropMatch[1].trim();
  }

  // Extract fields
  const fieldsMatch = source.match(/(?:get\s+)?fieldsToCollect[\s\S]*?\[[\s\S]*?\]/);
  if (fieldsMatch) {
    const fieldEntries = [...fieldsMatch[0].matchAll(/\{\s*name:\s*['"]([^'"]+)['"][\s\S]*?description:\s*['"`]([\s\S]*?)['"`]\s*(?:,|\})/g)];
    result.fields = fieldEntries.map(m => ({ name: m[1], description: m[2].trim() }));
  }

  // Extract transitionTo
  const transitionMatch = source.match(/transitionTo:\s*['"]([^'"]+)['"]/);
  if (transitionMatch) result.transitionTo = transitionMatch[1];

  // Detect thinker
  result.isThinker = /usesThinker\s*=\s*true/.test(source);

  // Extract thinking prompt
  if (result.isThinker) {
    const thinkingMatch = source.match(/(?:const|let|var)\s+THINKING_PROMPT\s*=\s*`([\s\S]*?)`;/);
    if (thinkingMatch) result.thinkingPrompt = thinkingMatch[1].trim();
  }

  return result;
}
