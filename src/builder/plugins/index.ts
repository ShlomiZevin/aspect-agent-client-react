/**
 * Plugin barrel — importing this file registers every built-in plugin
 * with the registry. The builder imports this once at startup.
 *
 * Each plugin lives in its own folder under `plugins/<id>/` with an
 * entry file named `addon.<id>.ts` (descriptor + side-effect register).
 * Folder coexists with the plugin's UI components (e.g. `TalkerConfig.tsx`).
 */

import './fieldExtractor/addon.fieldExtractor';
import './vibeExtractor/addon.vibeExtractor';
import './fieldReasoner/addon.fieldReasoner';
import './fieldInterviewer/addon.fieldInterviewer';
import './thinker/addon.thinker';
import './talker/addon.talker';
import './transitionRouter/addon.transitionRouter';

export {};
