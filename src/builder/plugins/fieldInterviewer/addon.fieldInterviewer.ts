/**
 * Field Interviewer plugin — descriptor + registration.
 *
 * Hybrid of Thinker and Field Reasoner. The atomic "decide what to ask
 * next AND extract the value if the user just answered" case. One LLM
 * call writes both a free-form thinking blob (under `config.domain`)
 * and the bound field — splitting them risks the two calls disagreeing
 * about the same exchange.
 *
 * Defaults come from the SHARED descriptor at
 * `aspect-agent-server/builder/addons/fieldInterviewer.addon.json` —
 * one source of truth across server runtime, client builder, and
 * Alfred's patch generator.
 */

import type { PluginDescriptor } from '../../registry/plugins';
import { registerPlugin } from '../../registry/plugins';
import type { FieldInterviewerConfig } from '../../types';
import { FieldInterviewerConfigComponent } from './FieldInterviewerConfig';
import descriptor from '@addons/fieldInterviewer.addon.json';

export const FIELD_INTERVIEWER_PLUGIN_ID = descriptor.pluginId;

export const fieldInterviewerPlugin: PluginDescriptor<FieldInterviewerConfig> = {
  id:                   descriptor.pluginId,
  name:                 descriptor.displayName,
  description:          descriptor.description,
  icon:                 descriptor.icon,
  color:                descriptor.color,
  defaultLane:          descriptor.defaultLane as PluginDescriptor<FieldInterviewerConfig>['defaultLane'],
  fieldMode:            descriptor.fieldMode as PluginDescriptor<FieldInterviewerConfig>['fieldMode'],
  allowedFieldSources:  descriptor.allowedFieldSources as PluginDescriptor<FieldInterviewerConfig>['allowedFieldSources'],
  speaks:               descriptor.speaks,
  allowedOutputTypes:   descriptor.allowedOutputTypes as PluginDescriptor<FieldInterviewerConfig>['allowedOutputTypes'],
  defaultOutputType:    descriptor.defaultOutputType as PluginDescriptor<FieldInterviewerConfig>['defaultOutputType'],
  defaultContext:       descriptor.defaultContext as PluginDescriptor<FieldInterviewerConfig>['defaultContext'],
  defaultPromptTemplate: descriptor.defaultPromptTemplate,
  defaultConfig: (): FieldInterviewerConfig => structuredClone(descriptor.defaultConfig) as FieldInterviewerConfig,
  ConfigComponent: FieldInterviewerConfigComponent,
};

registerPlugin(fieldInterviewerPlugin);
