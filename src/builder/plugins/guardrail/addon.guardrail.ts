/**
 * Guardrail plugin — descriptor + registration (task #963).
 *
 * A model-based check of the reply ({{reply}}) or the customer's message.
 * "Hold the answer" off = flag only; on = the Talker before it runs held
 * and approve / replace / block apply. Defaults come from the SHARED
 * descriptor at `aspect-agent-server/builder/addons/guardrail.addon.json`.
 */

import type { PluginDescriptor } from '../../registry/plugins';
import { registerPlugin } from '../../registry/plugins';
import type { GuardrailConfig } from '../../types';
import { GuardrailConfigComponent } from './GuardrailConfig';
import descriptor from '@addons/guardrail.addon.json';

export const GUARDRAIL_PLUGIN_ID = descriptor.pluginId;

export const guardrailPlugin: PluginDescriptor<GuardrailConfig> = {
  id:                   descriptor.pluginId,
  name:                 descriptor.displayName,
  description:          descriptor.description,
  icon:                 descriptor.icon,
  color:                descriptor.color,
  defaultLane:          descriptor.defaultLane          as PluginDescriptor<GuardrailConfig>['defaultLane'],
  fieldMode:            descriptor.fieldMode            as PluginDescriptor<GuardrailConfig>['fieldMode'],
  speaks:               descriptor.speaks,
  allowedOutputTypes:   descriptor.allowedOutputTypes   as PluginDescriptor<GuardrailConfig>['allowedOutputTypes'],
  defaultOutputType:    descriptor.defaultOutputType    as PluginDescriptor<GuardrailConfig>['defaultOutputType'],
  defaultContext:       descriptor.defaultContext       as PluginDescriptor<GuardrailConfig>['defaultContext'],
  defaultPromptTemplate: descriptor.defaultPromptTemplate,
  defaultConfig: (): GuardrailConfig => structuredClone(descriptor.defaultConfig) as GuardrailConfig,
  ConfigComponent: GuardrailConfigComponent,
};

registerPlugin(guardrailPlugin);
