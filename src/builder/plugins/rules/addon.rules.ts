/**
 * Rules plugin — client descriptor.
 *
 * Deterministic if/then rules over conversation memory. No LLM.
 * WHEN = the shared condition vocabulary (empty = always fires),
 * THEN = actions: set/clear fields, transition, stop chain, fixed
 * reply. Where it sits in the chain decides when it evaluates —
 * place it after extractors so it sees fresh values.
 *
 * Defaults come from the SHARED descriptor at
 * `aspect-agent-server/builder/addons/rules.addon.json`.
 */

import type { PluginDescriptor } from '../../registry/plugins';
import { registerPlugin } from '../../registry/plugins';
import type { RulesAddonConfig } from '../../types';
import { RulesConfigComponent } from './RulesConfig';
import descriptor from '@addons/rules.addon.json';

export const RULES_PLUGIN_ID = descriptor.pluginId;

export const rulesPlugin: PluginDescriptor<RulesAddonConfig> = {
  id:                   descriptor.pluginId,
  name:                 descriptor.displayName,
  description:          descriptor.description,
  icon:                 descriptor.icon,
  color:                descriptor.color,
  defaultLane:          descriptor.defaultLane as PluginDescriptor<RulesAddonConfig>['defaultLane'],
  fieldMode:            descriptor.fieldMode as PluginDescriptor<RulesAddonConfig>['fieldMode'],
  speaks:               descriptor.speaks,
  allowedOutputTypes:   descriptor.allowedOutputTypes as PluginDescriptor<RulesAddonConfig>['allowedOutputTypes'],
  defaultOutputType:    descriptor.defaultOutputType as PluginDescriptor<RulesAddonConfig>['defaultOutputType'],
  defaultContext:       descriptor.defaultContext as PluginDescriptor<RulesAddonConfig>['defaultContext'],
  defaultPromptTemplate: descriptor.defaultPromptTemplate,
  defaultConfig: (): RulesAddonConfig => structuredClone(descriptor.defaultConfig) as RulesAddonConfig,
  ConfigComponent: RulesConfigComponent,
  // No LLM, no prompt, no history — rules read memory only.
  hideStandardSections: descriptor.hideStandardSections as PluginDescriptor<RulesAddonConfig>['hideStandardSections'],
};

registerPlugin(rulesPlugin);
