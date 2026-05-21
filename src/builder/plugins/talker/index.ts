/**
 * Talker plugin — the addon that speaks to the user. The crew has
 * no prompt of its own; the Talker's prompt IS the crew's voice.
 *
 * Every crew has at least one Talker by default; the user can add
 * more (e.g. for multi-voice setups) or remove them.
 */

import type { PluginDescriptor } from '../../registry/plugins';
import { registerPlugin } from '../../registry/plugins';
import { DEFAULT_BALANCED_MODEL } from '../../registry/providerModels';
import type { TalkerConfig } from '../../types';
import { TalkerConfigComponent } from './TalkerConfig';

export const TALKER_PLUGIN_ID = 'talker';

/**
 * Template used to assemble the Talker's *prompt* parameter at
 * runtime. Source of truth — the server reads this same string from
 * the AddonInstance and substitutes placeholders identically.
 *
 * Note: conversation history (including the latest user message) is
 * NOT in this template. It is sent to the LLM as a separate
 * message-history parameter (varies per provider).
 */
const TALKER_PROMPT_TEMPLATE = `{{persona}}

{{prompt}}

{{memory}}`;

export const talkerPlugin: PluginDescriptor<TalkerConfig> = {
  id: TALKER_PLUGIN_ID,
  name: 'Talker',
  description: "Speaks to the user. Owns the response prompt.",
  icon: '💬',
  color: '#8b5cf6',
  defaultLane: 'main',
  fieldMode: 'none',
  speaks: true,
  allowedOutputTypes: ['text-to-user'],
  defaultOutputType: 'text-to-user',
  defaultContext: {
    history: { mode: 'last_n', n: 5 },
    persona: false,   // user opts in
    memoryReads: [],  // user opts in
  },
  defaultPromptTemplate: TALKER_PROMPT_TEMPLATE,
  defaultConfig: (): TalkerConfig => ({
    prompt: '',
    model: DEFAULT_BALANCED_MODEL,
  }),
  ConfigComponent: TalkerConfigComponent,
};

registerPlugin(talkerPlugin);
