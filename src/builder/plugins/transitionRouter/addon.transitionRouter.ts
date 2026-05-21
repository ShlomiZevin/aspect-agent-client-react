/**
 * Transition Router plugin — client descriptor.
 *
 * Drops into the Cortex chain. Where it sits decides when it
 * evaluates. When all conditions match it tells the engine to
 * route the next turn to a different crew (and optionally break
 * the rest of this turn's chain). See BUILDER_V2.md → "Crew
 * Transitions" for the full spec.
 *
 * This plugin doesn't call an LLM directly. It evaluates against
 * the conversation memory blob. No prompt template needed — the
 * runtime ignores it. We still snapshot a placeholder so the
 * AddonInstance contract holds.
 */

import type { PluginDescriptor } from '../../registry/plugins';
import { registerPlugin } from '../../registry/plugins';
import type { TransitionRouterConfig } from '../../types';
import { TransitionRouterConfigComponent } from './TransitionRouterConfig';

export const TRANSITION_ROUTER_PLUGIN_ID = 'transition-router';

const TRANSITION_PROMPT_TEMPLATE = '';

export const transitionRouterPlugin: PluginDescriptor<TransitionRouterConfig> = {
  id: TRANSITION_ROUTER_PLUGIN_ID,
  name: 'Transition Router',
  description: 'Sends the next turn to a different crew when conditions match.',
  icon: '🔀',
  color: '#0ea5e9',
  defaultLane: 'main',
  fieldMode: 'none',
  speaks: false,
  allowedOutputTypes: ['transition'],
  defaultOutputType: 'transition',
  defaultContext: {
    history: { mode: 'none' },
    persona: false,
    memoryReads: [],
  },
  defaultPromptTemplate: TRANSITION_PROMPT_TEMPLATE,
  defaultConfig: (): TransitionRouterConfig => ({
    conditions: [],
    target: '',
    reason: '',
    onMatch: 'continue',
  }),
  ConfigComponent: TransitionRouterConfigComponent,
  // No LLM call, no prompt, no reads — and the target crew is a
  // per-agent reference so cross-project export wouldn't make sense.
  hideStandardSections: {
    context: true,
    output: true,
    promptTemplate: true,
    repository: true,
  },
};

registerPlugin(transitionRouterPlugin);
