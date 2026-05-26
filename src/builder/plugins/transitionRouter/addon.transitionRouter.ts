/**
 * Transition Router plugin — client descriptor.
 *
 * Drops into the Cortex chain. Where it sits decides when it
 * evaluates. When all conditions match it tells the engine to
 * route the next turn to a different crew (and optionally break
 * the rest of this turn's chain). See BUILDER_V2.md → "Crew
 * Transitions" for the full spec.
 *
 * This plugin doesn't call an LLM directly. It evaluates against
 * the conversation memory blob. No prompt template needed — the
 * runtime ignores it. We still snapshot a placeholder so the
 * AddonInstance contract holds.
 *
 * Defaults come from the SHARED descriptor at
 * `aspect-agent-server/builder/addons/transitionRouter.addon.json`.
 */

import type { PluginDescriptor } from '../../registry/plugins';
import { registerPlugin } from '../../registry/plugins';
import type { TransitionRouterConfig } from '../../types';
import { TransitionRouterConfigComponent } from './TransitionRouterConfig';
import descriptor from '@addons/transitionRouter.addon.json';

export const TRANSITION_ROUTER_PLUGIN_ID = descriptor.pluginId;

export const transitionRouterPlugin: PluginDescriptor<TransitionRouterConfig> = {
  id:                   descriptor.pluginId,
  name:                 descriptor.displayName,
  description:          descriptor.description,
  icon:                 descriptor.icon,
  color:                descriptor.color,
  defaultLane:          descriptor.defaultLane as PluginDescriptor<TransitionRouterConfig>['defaultLane'],
  fieldMode:            descriptor.fieldMode as PluginDescriptor<TransitionRouterConfig>['fieldMode'],
  speaks:               descriptor.speaks,
  allowedOutputTypes:   descriptor.allowedOutputTypes as PluginDescriptor<TransitionRouterConfig>['allowedOutputTypes'],
  defaultOutputType:    descriptor.defaultOutputType as PluginDescriptor<TransitionRouterConfig>['defaultOutputType'],
  defaultContext:       descriptor.defaultContext as PluginDescriptor<TransitionRouterConfig>['defaultContext'],
  defaultPromptTemplate: descriptor.defaultPromptTemplate,
  defaultConfig: (): TransitionRouterConfig => structuredClone(descriptor.defaultConfig) as TransitionRouterConfig,
  ConfigComponent: TransitionRouterConfigComponent,
  // No LLM call, no prompt, no reads — and the target crew is a
  // per-agent reference so cross-project export wouldn't make sense.
  hideStandardSections: descriptor.hideStandardSections as PluginDescriptor<TransitionRouterConfig>['hideStandardSections'],
};

registerPlugin(transitionRouterPlugin);
