/**
 * Talker plugin — the addon that speaks to the user. The crew has
 * no prompt of its own; the Talker's prompt IS the crew's voice.
 *
 * Every crew has at least one Talker by default; the user can add
 * more (e.g. for multi-voice setups) or remove them.
 *
 * Defaults come from the SHARED descriptor at
 * `aspect-agent-server/builder/addons/talker.addon.json`. The same
 * file is read by the server runtime, the client, and Alfred's
 * patch generator — one source of truth.
 */

import type { PluginDescriptor } from '../../registry/plugins';
import { registerPlugin } from '../../registry/plugins';
import type { TalkerConfig } from '../../types';
import { TalkerConfigComponent } from './TalkerConfig';
import descriptor from '@addons/talker.addon.json';

export const TALKER_PLUGIN_ID = descriptor.pluginId;

export const talkerPlugin: PluginDescriptor<TalkerConfig> = {
  id:                   descriptor.pluginId,
  name:                 descriptor.displayName,
  description:          descriptor.description,
  icon:                 descriptor.icon,
  color:                descriptor.color,
  defaultLane:          descriptor.defaultLane as PluginDescriptor<TalkerConfig>['defaultLane'],
  fieldMode:            descriptor.fieldMode as PluginDescriptor<TalkerConfig>['fieldMode'],
  speaks:               descriptor.speaks,
  allowedOutputTypes:   descriptor.allowedOutputTypes as PluginDescriptor<TalkerConfig>['allowedOutputTypes'],
  defaultOutputType:    descriptor.defaultOutputType as PluginDescriptor<TalkerConfig>['defaultOutputType'],
  defaultContext:       descriptor.defaultContext as PluginDescriptor<TalkerConfig>['defaultContext'],
  defaultPromptTemplate: descriptor.defaultPromptTemplate,
  // Factory wraps the literal so every new instance gets its own
  // object — preserves the existing PluginDescriptor contract.
  defaultConfig: (): TalkerConfig => structuredClone(descriptor.defaultConfig) as TalkerConfig,
  ConfigComponent: TalkerConfigComponent,
};

registerPlugin(talkerPlugin);
