/**
 * Field Extractor plugin — descriptor + registration.
 *
 * Defaults come from the SHARED descriptor at
 * `aspect-agent-server/builder/addons/fieldExtractor.addon.json`.
 * The same file is read by the server runtime, the client, and
 * Alfred's patch generator — one source of truth.
 */

import type { PluginDescriptor } from '../../registry/plugins';
import { registerPlugin } from '../../registry/plugins';
import type { FieldExtractorConfig } from '../../types';
import { FieldExtractorConfigComponent } from './FieldExtractorConfig';
import descriptor from '@addons/fieldExtractor.addon.json';

export const FIELD_EXTRACTOR_PLUGIN_ID = descriptor.pluginId;

export const fieldExtractorPlugin: PluginDescriptor<FieldExtractorConfig> = {
  id:                   descriptor.pluginId,
  name:                 descriptor.displayName,
  description:          descriptor.description,
  icon:                 descriptor.icon,
  color:                descriptor.color,
  defaultLane:          descriptor.defaultLane as PluginDescriptor<FieldExtractorConfig>['defaultLane'],
  fieldMode:            descriptor.fieldMode as PluginDescriptor<FieldExtractorConfig>['fieldMode'],
  allowedFieldSources:  descriptor.allowedFieldSources as PluginDescriptor<FieldExtractorConfig>['allowedFieldSources'],
  speaks:               descriptor.speaks,
  allowedOutputTypes:   descriptor.allowedOutputTypes as PluginDescriptor<FieldExtractorConfig>['allowedOutputTypes'],
  defaultOutputType:    descriptor.defaultOutputType as PluginDescriptor<FieldExtractorConfig>['defaultOutputType'],
  defaultContext:       descriptor.defaultContext as PluginDescriptor<FieldExtractorConfig>['defaultContext'],
  defaultPromptTemplate: descriptor.defaultPromptTemplate,
  defaultConfig: (): FieldExtractorConfig => structuredClone(descriptor.defaultConfig) as FieldExtractorConfig,
  ConfigComponent: FieldExtractorConfigComponent,
};

registerPlugin(fieldExtractorPlugin);
