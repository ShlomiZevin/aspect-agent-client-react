/**
 * Field Reasoner plugin — descriptor + registration.
 *
 * Defaults come from the SHARED descriptor at
 * `aspect-agent-server/builder/addons/fieldReasoner.addon.json`. The
 * same file is read by the server runtime, the client, and Alfred's
 * patch generator — one source of truth.
 */

import type { PluginDescriptor } from '../../registry/plugins';
import { registerPlugin } from '../../registry/plugins';
import type { FieldReasonerConfig } from '../../types';
import { FieldReasonerConfigComponent } from './FieldReasonerConfig';
import descriptor from '@addons/fieldReasoner.addon.json';

export const FIELD_REASONER_PLUGIN_ID = descriptor.pluginId;

export const fieldReasonerPlugin: PluginDescriptor<FieldReasonerConfig> = {
  id:                   descriptor.pluginId,
  name:                 descriptor.displayName,
  description:          descriptor.description,
  icon:                 descriptor.icon,
  color:                descriptor.color,
  defaultLane:          descriptor.defaultLane as PluginDescriptor<FieldReasonerConfig>['defaultLane'],
  fieldMode:            descriptor.fieldMode as PluginDescriptor<FieldReasonerConfig>['fieldMode'],
  allowedFieldSources:  descriptor.allowedFieldSources as PluginDescriptor<FieldReasonerConfig>['allowedFieldSources'],
  speaks:               descriptor.speaks,
  allowedOutputTypes:   descriptor.allowedOutputTypes as PluginDescriptor<FieldReasonerConfig>['allowedOutputTypes'],
  defaultOutputType:    descriptor.defaultOutputType as PluginDescriptor<FieldReasonerConfig>['defaultOutputType'],
  defaultContext:       descriptor.defaultContext as PluginDescriptor<FieldReasonerConfig>['defaultContext'],
  defaultPromptTemplate: descriptor.defaultPromptTemplate,
  defaultConfig: (): FieldReasonerConfig => structuredClone(descriptor.defaultConfig) as FieldReasonerConfig,
  ConfigComponent: FieldReasonerConfigComponent,
};

registerPlugin(fieldReasonerPlugin);
