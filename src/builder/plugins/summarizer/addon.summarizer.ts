/**
 * Summarizer plugin — descriptor + registration.
 *
 * Offline-lane addon. Distils chat history into a compact checkpoint
 * under `brain.summary[NAME]`. Pairs naturally with the
 * `since_summarizer` history mode — a downstream Thinker / Talker can
 * read just the messages added since this checkpoint last fired.
 *
 * Defaults come from the SHARED descriptor at
 * `aspect-agent-server/builder/addons/summarizer.addon.json` — one
 * source of truth across server runtime, client builder, and Alfred's
 * patch generator.
 */

import type { PluginDescriptor } from '../../registry/plugins';
import { registerPlugin } from '../../registry/plugins';
import type { SummarizerConfig } from '../../types';
import { SummarizerConfigComponent } from './SummarizerConfig';
import descriptor from '@addons/summarizer.addon.json';

export const SUMMARIZER_PLUGIN_ID = descriptor.pluginId;

export const summarizerPlugin: PluginDescriptor<SummarizerConfig> = {
  id:                   descriptor.pluginId,
  name:                 descriptor.displayName,
  description:          descriptor.description,
  icon:                 descriptor.icon,
  color:                descriptor.color,
  defaultLane:          descriptor.defaultLane as PluginDescriptor<SummarizerConfig>['defaultLane'],
  fieldMode:            descriptor.fieldMode as PluginDescriptor<SummarizerConfig>['fieldMode'],
  speaks:               descriptor.speaks,
  allowedOutputTypes:   descriptor.allowedOutputTypes as PluginDescriptor<SummarizerConfig>['allowedOutputTypes'],
  defaultOutputType:    descriptor.defaultOutputType as PluginDescriptor<SummarizerConfig>['defaultOutputType'],
  defaultContext:       descriptor.defaultContext as PluginDescriptor<SummarizerConfig>['defaultContext'],
  defaultPromptTemplate: descriptor.defaultPromptTemplate,
  defaultConfig: (): SummarizerConfig => structuredClone(descriptor.defaultConfig) as SummarizerConfig,
  ConfigComponent: SummarizerConfigComponent,
};

registerPlugin(summarizerPlugin);
