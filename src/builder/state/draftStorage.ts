/**
 * Local draft persistence for the in-progress builder document.
 *
 * Why: the whole builder works on a single JSON document. While the
 * user edits it (before any "save to server" action exists), we want
 * an accidental refresh to not lose their work. localStorage is fine
 * for this — the doc is small and per-browser.
 *
 * One draft per agent slug, keyed by `builder:draft:<slug>`.
 */

import type { ProjectDoc } from '../types';

const PREFIX = 'builder:draft:';

const TALKER_PLUGIN_ID = 'talker';
const FIELD_EXTRACTOR_PLUGIN_ID = 'field-extractor';

// Current default templates (frozen copies — these mirror the plugin
// files exactly). Used to seed addons missing a template, and to
// refresh addons whose templates still contain the dropped
// `{{history}}` / `{{user_message}}` placeholders (those are no
// longer part of the prompt; history is a separate runtime param).
const CURRENT_TALKER_TEMPLATE = `{{persona}}

{{prompt}}

{{memory}}`;

const CURRENT_FIELD_EXTRACTOR_TEMPLATE = `{{prompt}}

## Field schema
{{fields_schema}}

## Already collected
{{fields_current}}

{{memory}}`;

function defaultTemplateForPlugin(pluginId: string): string {
  if (pluginId === TALKER_PLUGIN_ID) return CURRENT_TALKER_TEMPLATE;
  if (pluginId === FIELD_EXTRACTOR_PLUGIN_ID) return CURRENT_FIELD_EXTRACTOR_TEMPLATE;
  return '';
}

function templateNeedsRefresh(t: string): boolean {
  return t.includes('{{history}}') || t.includes('{{user_message}}');
}

export function draftKey(agentSlug: string): string {
  return `${PREFIX}${agentSlug}`;
}

function rand(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Bring a stored draft up to the current schema. Cheap forward-only
 * migrations live here so old localStorage drafts don't crash the UI
 * when we add required fields. Each step is idempotent.
 */
function migrateDraft(raw: unknown): ProjectDoc {
  const doc = raw as ProjectDoc;
  if (!doc?.agents) return doc;
  for (const a of doc.agents) {
    for (const c of a.crews ?? []) {
      const addons = c.addons ?? [];

      // Step 1 — add lane to old addons that pre-date per-instance lane.
      for (const ad of addons) {
        if (!(ad as { lane?: string }).lane) {
          (ad as { lane: string }).lane = 'main';
        }
      }

      // Step 1b — add a default context to addons that pre-date the
      // universal reading-knobs envelope.
      for (const ad of addons) {
        const adAny = ad as { context?: unknown };
        if (!adAny.context || typeof adAny.context !== 'object') {
          adAny.context = {
            history: { mode: 'last_n', n: 5 },
          };
        }
      }

      // Step 1c — add a default prompt template to addons that pre-date
      // the in-JSON template. Pulled from a frozen copy of the plugin's
      // current default so both client + server agree on the string.
      // Also refresh templates that still contain dropped placeholders
      // (`{{history}}` / `{{user_message}}`) — those are now sent as
      // a separate runtime param.
      for (const ad of addons) {
        const adAny = ad as { promptTemplate?: unknown; pluginId?: string };
        if (typeof adAny.promptTemplate !== 'string') {
          adAny.promptTemplate = defaultTemplateForPlugin(adAny.pluginId ?? '');
        } else if (templateNeedsRefresh(adAny.promptTemplate)) {
          adAny.promptTemplate = defaultTemplateForPlugin(adAny.pluginId ?? '');
        }
      }

      // Step 1d — add a default outputType to addons that pre-date the
      // configurable output. Speakers default to text-to-user;
      // everyone else to json-to-memory.
      for (const ad of addons) {
        const adAny = ad as { outputType?: unknown; pluginId?: string };
        if (typeof adAny.outputType !== 'string') {
          adAny.outputType =
            adAny.pluginId === TALKER_PLUGIN_ID ? 'text-to-user' : 'json-to-memory';
        }
      }

      // Step 2 — fold old crew.prompt into a Talker addon. The crew
      // shape no longer has a prompt of its own.
      const legacy = c as unknown as { prompt?: string };
      if (typeof legacy.prompt === 'string') {
        const hasTalker = addons.some(a => a.pluginId === TALKER_PLUGIN_ID);
        if (!hasTalker) {
          addons.push({
            instanceId: rand('addon'),
            pluginId: TALKER_PLUGIN_ID,
            lane: 'main',
            enabled: true,
            config: {
              prompt: legacy.prompt,
              model: { providerId: 'google', modelId: 'gemini-2.5-flash' },
            },
            context: {
              history: { mode: 'last_n', n: 5 },
            },
            outputType: 'text-to-user',
            promptTemplate: CURRENT_TALKER_TEMPLATE,
            // Cast is fine — `addons` is typed wide on the doc.
          } as unknown as typeof addons[number]);
        }
        delete legacy.prompt;
      }

      c.addons = addons;

      // Step 3 — give the crew an initial version if it doesn't have one yet.
      const versioned = c as unknown as {
        versions?: unknown[];
        activeVersionId?: string;
        viewingVersionId?: string;
      };
      if (!Array.isArray(versioned.versions) || versioned.versions.length === 0) {
        const versionId = rand('ver');
        versioned.versions = [
          {
            id: versionId,
            number: 1,
            description: 'Initial',
            createdAt: new Date().toISOString(),
            body: {
              name: c.name,
              description: c.description,
              spec: c.spec,
              persona: c.persona,
              addons: c.addons,
            },
          },
        ];
        versioned.activeVersionId = versionId;
        versioned.viewingVersionId = versionId;
      }

      // Step 4 — split active vs viewing. Old crews only had
      // activeVersionId — start viewing on the active version.
      if (!versioned.viewingVersionId && versioned.activeVersionId) {
        versioned.viewingVersionId = versioned.activeVersionId;
      }
    }

    // Step 5 — wrap agents into the versioned shape. Snapshot body
    // captures shell fields (name, slug, spec, persona, defaultCrewId)
    // — crews stay outside the version body.
    const agentAny = a as unknown as {
      versions?: unknown[];
      activeVersionId?: string;
      viewingVersionId?: string;
    };
    if (!Array.isArray(agentAny.versions) || agentAny.versions.length === 0) {
      const versionId = rand('ver');
      agentAny.versions = [
        {
          id: versionId,
          number: 1,
          description: 'Initial',
          createdAt: new Date().toISOString(),
          body: {
            name: a.name,
            slug: a.slug,
            spec: a.spec,
            persona: a.persona,
            defaultCrewId: a.defaultCrewId,
          },
        },
      ];
      agentAny.activeVersionId = versionId;
      agentAny.viewingVersionId = versionId;
    }

    // Step 6 — seed viewingVersionId from active for agents that
    // pre-date the active/viewing split.
    if (!agentAny.viewingVersionId && agentAny.activeVersionId) {
      agentAny.viewingVersionId = agentAny.activeVersionId;
    }
  }
  return doc;
}

export function loadDraft(agentSlug: string): ProjectDoc | null {
  try {
    const raw = localStorage.getItem(draftKey(agentSlug));
    if (!raw) return null;
    return migrateDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveDraft(agentSlug: string, doc: ProjectDoc): void {
  try {
    localStorage.setItem(draftKey(agentSlug), JSON.stringify(doc));
  } catch {
    // Quota exceeded or private mode — ignore; in-memory state is still authoritative.
  }
}

export function clearDraft(agentSlug: string): void {
  try {
    localStorage.removeItem(draftKey(agentSlug));
  } catch {
    /* noop */
  }
}
