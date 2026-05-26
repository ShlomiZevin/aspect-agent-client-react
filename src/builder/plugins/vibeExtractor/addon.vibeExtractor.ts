/**
 * Vibe Extractor plugin — descriptor + registration.
 *
 * Behaviorally the same as Field Extractor (writes structured fields
 * to memory via `json-to-memory`). The distinction is in the
 * descriptor: longer default history, Sonnet 4.6 default, prompt
 * tuned for inferred reads, `allowedFieldSources: ['inferred']`
 * (metadata for Alfred + future UI), pink 🧐 chrome.
 *
 * Defaults come from the SHARED descriptor at
 * `aspect-agent-server/builder/addons/vibeExtractor.addon.json`.
 * The same file is read by the server runtime, the client, and
 * Alfred's patch generator — one source of truth.
 */

import type { PluginDescriptor } from '../../registry/plugins';
import { registerPlugin } from '../../registry/plugins';
import type { FieldExtractorConfig } from '../../types';
import { VibeExtractorConfigComponent } from './VibeExtractorConfig';
import descriptor from '@addons/vibeExtractor.addon.json';

export const VIBE_EXTRACTOR_PLUGIN_ID = descriptor.pluginId;

// Vibe Extractor shares the FieldExtractorConfig shape — both addons
// extract structured fields into memory; the difference is in default
// values and intent, not in the config shape. Aliasing the type keeps
// the code honest about that fact.
export type VibeExtractorConfig = FieldExtractorConfig;

export const vibeExtractorPlugin: PluginDescriptor<VibeExtractorConfig> = {
  id:                   descriptor.pluginId,
  name:                 descriptor.displayName,
  description:          descriptor.description,
  icon:                 descriptor.icon,
  color:                descriptor.color,
  defaultLane:          descriptor.defaultLane          as PluginDescriptor<VibeExtractorConfig>['defaultLane'],
  fieldMode:            descriptor.fieldMode            as PluginDescriptor<VibeExtractorConfig>['fieldMode'],
  allowedFieldSources:  descriptor.allowedFieldSources  as PluginDescriptor<VibeExtractorConfig>['allowedFieldSources'],
  speaks:               descriptor.speaks,
  allowedOutputTypes:   descriptor.allowedOutputTypes   as PluginDescriptor<VibeExtractorConfig>['allowedOutputTypes'],
  defaultOutputType:    descriptor.defaultOutputType    as PluginDescriptor<VibeExtractorConfig>['defaultOutputType'],
  defaultContext:       descriptor.defaultContext       as PluginDescriptor<VibeExtractorConfig>['defaultContext'],
  defaultPromptTemplate: descriptor.defaultPromptTemplate,
  defaultConfig: (): VibeExtractorConfig => structuredClone(descriptor.defaultConfig) as VibeExtractorConfig,
  ConfigComponent: VibeExtractorConfigComponent,
};

registerPlugin(vibeExtractorPlugin);
