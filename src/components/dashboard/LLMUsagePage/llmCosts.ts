/**
 * Single source of truth for client-side cost estimation on the LLM
 * Usage dashboard ($/1M tokens, provider list prices, verified July
 * 2026). The server logs raw token counts only — cost is derived here.
 *
 * Keys must match the `model` values as they appear in llm_usage rows
 * (config model ids and legacy dated snapshots alike).
 */
export const COST_PER_M: Record<string, { input: number; output: number }> = {
  // ── Anthropic ──
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  'claude-opus-4-6': { input: 5, output: 25 },
  'claude-opus-4-7': { input: 5, output: 25 },

  // ── OpenAI ──
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-5': { input: 1.25, output: 10 },
  'gpt-5-chat-latest': { input: 1.25, output: 10 },
  'gpt-5.4-mini': { input: 0.75, output: 4.5 },
  'gpt-5.5': { input: 5, output: 30 },
  'gpt-5.6': { input: 5, output: 30 },
  'gpt-5.6-terra': { input: 2.5, output: 15 },
  'gpt-5.6-luna': { input: 1, output: 6 },

  // ── Google ──
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.5-pro': { input: 1.25, output: 10 },
};

/** $ cost of one call; 0 for models missing from the table. */
export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_M[model];
  if (!rates) return 0;
  return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
}
