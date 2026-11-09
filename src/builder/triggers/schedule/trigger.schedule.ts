/**
 * Schedule trigger — registration (#950).
 *
 * The descriptor comes from the SAME JSON the server reads
 * (`@triggers/schedule.trigger.json`), so the two halves can never
 * disagree about the name, the icon, the defaults or the guide.
 */

import { registerTriggerType } from '../registry';
import { ScheduleConfigComponent } from './ScheduleConfig';
import { formatNextSchedule, summarizeSchedule, type ScheduleConfig } from './scheduleShape';
import descriptor from '@triggers/schedule.trigger.json';

registerTriggerType<ScheduleConfig>({
  typeId:        descriptor.typeId,
  displayName:   descriptor.displayName,
  description:   descriptor.description,
  purpose:       descriptor.purpose,
  icon:          descriptor.icon,
  color:         descriptor.color,
  defaultConfig: descriptor.defaultConfig as ScheduleConfig,
  ConfigComponent: ScheduleConfigComponent,
  summarize:     summarizeSchedule,
  guide:         descriptor.guide,
  calendar:      true,
  formatNext:    formatNextSchedule,
  timingHelp:
    'Every conversation where the customer has written at least once gets one try per scheduled time — '
    + 'use “Only if…” conditions to narrow that. A time more than an hour late (the clock was paused) is '
    + 'skipped, never sent late. A conversation that starts after a time joins from the next one, and '
    + 'switching on never sends a time that already passed.',
  briefPlaceholder: 'It is the scheduled morning check-in. Decide whether a short message fits this conversation, and if so, send one.',
});

export type { ScheduleConfig };
