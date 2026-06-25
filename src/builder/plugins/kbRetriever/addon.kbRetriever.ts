/**
 * KB Retriever plugin — descriptor + registration (client mirror).
 *
 * Adaptive RAG retrieval as a chain step. Searches the selected KBs and
 * writes the result to a named slot injected via {{kb:NAME}}. Defaults
 * come from the SHARED descriptor at
 * `aspect-agent-server/builder/addons/kbRetriever.addon.json`.
 * See docs/guides/KB_V2_RETRIEVER.md.
 */

import type { PluginDescriptor } from '../../registry/plugins';
import { registerPlugin } from '../../registry/plugins';
import type { KbRetrieverConfig } from '../../types';
import { KbRetrieverConfigComponent } from './KbRetrieverConfig';
import descriptor from '@addons/kbRetriever.addon.json';

export const KB_RETRIEVER_PLUGIN_ID = descriptor.pluginId;

export const kbRetrieverPlugin: PluginDescriptor<KbRetrieverConfig> = {
  id:                   descriptor.pluginId,
  name:                 descriptor.displayName,
  description:          descriptor.description,
  icon:                 descriptor.icon,
  color:                descriptor.color,
  defaultLane:          descriptor.defaultLane          as PluginDescriptor<KbRetrieverConfig>['defaultLane'],
  fieldMode:            descriptor.fieldMode            as PluginDescriptor<KbRetrieverConfig>['fieldMode'],
  speaks:               descriptor.speaks,
  allowedOutputTypes:   descriptor.allowedOutputTypes   as PluginDescriptor<KbRetrieverConfig>['allowedOutputTypes'],
  defaultOutputType:    descriptor.defaultOutputType    as PluginDescriptor<KbRetrieverConfig>['defaultOutputType'],
  defaultContext:       descriptor.defaultContext       as PluginDescriptor<KbRetrieverConfig>['defaultContext'],
  hideStandardSections: descriptor.hideStandardSections as PluginDescriptor<KbRetrieverConfig>['hideStandardSections'],
  defaultPromptTemplate: descriptor.defaultPromptTemplate,
  defaultConfig: (): KbRetrieverConfig => structuredClone(descriptor.defaultConfig) as KbRetrieverConfig,
  ConfigComponent: KbRetrieverConfigComponent,
};

registerPlugin(kbRetrieverPlugin);
