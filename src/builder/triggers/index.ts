/**
 * Side-effect imports — register every built-in trigger type.
 * Adding a type is three files plus one line here.
 */
import './silence/trigger.silence';
import './schedule/trigger.schedule';

export * from './registry';
