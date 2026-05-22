/**
 * Field Extractor plugin — descriptor + registration.
 *
 * The runtime side (actually calling the LLM to extract fields from
 * messages) lands in a later slice. For now this plugin just provides
 * a config blob that lives inside the crew JSON.
 */

import type { PluginDescriptor } from '../../registry/plugins';
import { registerPlugin } from '../../registry/plugins';
import { DEFAULT_FAST_MODEL } from '../../registry/providerModels';
import type { FieldExtractorConfig } from '../../types';
import { FieldExtractorConfigComponent } from './FieldExtractorConfig';

export const FIELD_EXTRACTOR_PLUGIN_ID = 'field-extractor';

/**
 * Template used to assemble this extractor's *prompt* parameter at
 * runtime. Source of truth — the server reads this same string from
 * the AddonInstance and substitutes placeholders identically.
 *
 * Note: conversation history and the latest user message are NOT in
 * this template. They are sent to the LLM as a separate
 * message-history parameter (varies per provider).
 */
const FIELD_EXTRACTOR_PROMPT_TEMPLATE = `{{prompt}}

## Field schema
{{fields_schema}}

## Already collected
{{fields_current}}

{{memory}}`;

export const fieldExtractorPlugin: PluginDescriptor<FieldExtractorConfig> = {
  id: FIELD_EXTRACTOR_PLUGIN_ID,
  name: 'Field Extractor',
  description: 'Extract structured fields from the conversation — explicit or inferred.',
  icon: '📥',
  color: '#f59e0b',
  defaultLane: 'main',
  fieldMode: 'extractor',
  allowedFieldSources: ['explicit', 'inferred'],
  speaks: false,
  allowedOutputTypes: ['json-to-memory'],
  defaultOutputType: 'json-to-memory',
  defaultContext: {
    history: { mode: 'last_n', n: 3 },
    persona: false,
    memoryReads: [],
  },
  defaultPromptTemplate: FIELD_EXTRACTOR_PROMPT_TEMPLATE,
  defaultConfig: (): FieldExtractorConfig => ({
    prompt:
      "Extract field values from the user's latest message and recent context.\n" +
      "Be precise — only extract what is clearly supported by the conversation.\n" +
      "For 'explicit' fields, capture only what the user literally said.\n" +
      "For 'inferred' fields, you may conclude based on patterns.",
    model: DEFAULT_FAST_MODEL,
    name: '',
    extractsFields: [],
  }),
  ConfigComponent: FieldExtractorConfigComponent,
};

registerPlugin(fieldExtractorPlugin);
