/**
 * Silence trigger — registration.
 *
 * The descriptor comes from the SAME JSON the server reads
 * (`@triggers/silence.trigger.json`), so the two halves can never
 * disagree about the name, the icon or the defaults.
 */

import { registerTriggerType } from '../registry';
import { SilenceConfigComponent } from './SilenceConfig';
import { summarizeSilence, type SilenceConfig } from './silenceShape';
import descriptor from '@triggers/silence.trigger.json';

registerTriggerType<SilenceConfig>({
  typeId:        descriptor.typeId,
  displayName:   descriptor.displayName,
  description:   descriptor.description,
  purpose:       descriptor.purpose,
  icon:          descriptor.icon,
  color:         descriptor.color,
  defaultConfig: descriptor.defaultConfig as SilenceConfig,
  ConfigComponent: SilenceConfigComponent,
  summarize:     summarizeSilence,
  guide:         descriptor.guide,
});

export type { SilenceConfig };
