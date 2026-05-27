/**
 * Triggered Context plugin — descriptor + registration.
 *
 * The hard alternative to KB. Evaluates user-authored rules against
 * memory and writes pre-scripted guidance into the brain's `triggered`
 * section. Downstream Talker / Thinker addons read via their
 * `triggeredReads` config — same mechanism as memory / thinking.
 *
 * Defaults come from the SHARED descriptor at
 * `aspect-agent-server/builder/addons/triggeredContext.addon.json`.
 */

import type { PluginDescriptor } from '../../registry/plugins';
import { registerPlugin } from '../../registry/plugins';
import type { TriggeredContextConfig } from '../../types';
import { TriggeredContextConfigComponent } from './TriggeredContextConfig';
import descriptor from '@addons/triggeredContext.addon.json';

export const TRIGGERED_CONTEXT_PLUGIN_ID = descriptor.pluginId;

export const triggeredContextPlugin: PluginDescriptor<TriggeredContextConfig> = {
  id:                   descriptor.pluginId,
  name:                 descriptor.displayName,
  description:          descriptor.description,
  icon:                 descriptor.icon,
  color:                descriptor.color,
  defaultLane:          descriptor.defaultLane          as PluginDescriptor<TriggeredContextConfig>['defaultLane'],
  fieldMode:            descriptor.fieldMode            as PluginDescriptor<TriggeredContextConfig>['fieldMode'],
  speaks:               descriptor.speaks,
  allowedOutputTypes:   descriptor.allowedOutputTypes   as PluginDescriptor<TriggeredContextConfig>['allowedOutputTypes'],
  defaultOutputType:    descriptor.defaultOutputType    as PluginDescriptor<TriggeredContextConfig>['defaultOutputType'],
  defaultContext:       descriptor.defaultContext       as PluginDescriptor<TriggeredContextConfig>['defaultContext'],
  defaultPromptTemplate: descriptor.defaultPromptTemplate,
  defaultConfig: (): TriggeredContextConfig => structuredClone(descriptor.defaultConfig) as TriggeredContextConfig,
  ConfigComponent: TriggeredContextConfigComponent,
  hideStandardSections: descriptor.hideStandardSections as PluginDescriptor<TriggeredContextConfig>['hideStandardSections'],
};

registerPlugin(triggeredContextPlugin);
