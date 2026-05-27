/**
 * Thinker plugin — descriptor + registration.
 *
 * The brain's prefrontal cortex. Produces strategic guidance for the
 * Talker to consume. Output is a free-form JSON object whose keys are
 * defined by the prompt; the server writes whatever lands under the
 * configured `domain` inside the brain's `thinking` section.
 *
 * Defaults come from the SHARED descriptor at
 * `aspect-agent-server/builder/addons/thinker.addon.json`.
 */

import type { PluginDescriptor } from '../../registry/plugins';
import { registerPlugin } from '../../registry/plugins';
import type { ThinkerConfig } from '../../types';
import { ThinkerConfigComponent } from './ThinkerConfig';
import descriptor from '@addons/thinker.addon.json';

export const THINKER_PLUGIN_ID = descriptor.pluginId;

export const thinkerPlugin: PluginDescriptor<ThinkerConfig> = {
  id:                   descriptor.pluginId,
  name:                 descriptor.displayName,
  description:          descriptor.description,
  icon:                 descriptor.icon,
  color:                descriptor.color,
  defaultLane:          descriptor.defaultLane          as PluginDescriptor<ThinkerConfig>['defaultLane'],
  fieldMode:            descriptor.fieldMode            as PluginDescriptor<ThinkerConfig>['fieldMode'],
  speaks:               descriptor.speaks,
  allowedOutputTypes:   descriptor.allowedOutputTypes   as PluginDescriptor<ThinkerConfig>['allowedOutputTypes'],
  defaultOutputType:    descriptor.defaultOutputType    as PluginDescriptor<ThinkerConfig>['defaultOutputType'],
  defaultContext:       descriptor.defaultContext       as PluginDescriptor<ThinkerConfig>['defaultContext'],
  defaultPromptTemplate: descriptor.defaultPromptTemplate,
  defaultConfig: (): ThinkerConfig => structuredClone(descriptor.defaultConfig) as ThinkerConfig,
  ConfigComponent: ThinkerConfigComponent,
};

registerPlugin(thinkerPlugin);
