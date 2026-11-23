#!/usr/bin/env node
/**
 * Offline battery for src/builder/state/entityBody.ts — the one definition
 * of a version body and of "unsaved changes" (BUILDER_V2.md #69).
 *
 *   node scripts/test-entity-body.mjs
 *
 * Transpiles the module with the esbuild Vite already ships, then checks:
 *   - saved bodies written outside the Builder (tags: [], no personas,
 *     modelRoute 'direct', empty liveBrain, …) are NOT dirty against the
 *     working copy the server's hydration builds from them;
 *   - real edits ARE dirty;
 *   - the save projection is byte-identical to the old save copy
 *     (useProjectSync.bodyOfAgent / bodyOfCrew) except that tags now persist.
 * No network, no DB.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transform } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '../src/builder/state/entityBody.ts'), 'utf8');
const { code } = await transform(src, { loader: 'ts', format: 'esm' });
const dir = mkdtempSync(join(tmpdir(), 'entity-body-'));
const file = join(dir, 'entityBody.mjs');
writeFileSync(file, code);
const eb = await import(pathToFileURL(file).href);
rmSync(dir, { recursive: true, force: true });

let pass = 0, fail = 0;
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}

// ─── Mirrors of the server's load (builderProjects.hydrateProject) ──
function withPersonas(body) {
  if (Array.isArray(body.personas)) return body;
  return { ...body, personas: [{ id: 'persona_main', name: 'main', content: typeof body.persona === 'string' ? body.persona : '', appliesTo: ['*'] }] };
}
const arr = v => (Array.isArray(v) ? v : []);
/** Working-copy agent + its version list, exactly as the server hydrates. */
function hydrateAgent(raw, slug = 'zz-test') {
  const b = withPersonas(raw);
  return {
    id: 'agent_1', slug,
    name: b.name || slug, spec: b.spec || '', persona: b.persona || '',
    personas: arr(b.personas), defaultCrewId: b.defaultCrewId,
    fields: arr(b.fields), domains: arr(b.domains), tags: arr(b.tags),
    parameters: arr(b.parameters), enums: arr(b.enums), snippets: arr(b.snippets), cortex: arr(b.cortex),
    liveBrain: b.liveBrain, profiler: b.profiler, triggers: b.triggers, crewTree: b.crewTree,
    modelRoute: b.modelRoute, dataProtection: b.dataProtection,
    crews: [], versions: [{ id: 'ver_1', number: 1, createdAt: '', body: withPersonas(raw) }],
    activeVersionId: 'ver_1', viewingVersionId: 'ver_1',
  };
}
function hydrateCrew(raw) {
  const vb = raw;
  return {
    id: 'crew_1',
    name: raw.name || '', description: raw.description || '', spec: raw.spec || '',
    persona: raw.persona, addons: arr(raw.addons), fields: arr(raw.fields),
    dataProtection: raw.dataProtection,
    versions: [{ id: 'cv_1', number: 1, createdAt: '', body: {
      ...vb, name: vb.name || '', description: vb.description || '', spec: vb.spec || '',
      persona: vb.persona, addons: arr(vb.addons), fields: arr(vb.fields),
    } }],
    activeVersionId: 'cv_1', viewingVersionId: 'cv_1',
  };
}
const viewingBody = e => e.versions.find(v => v.id === e.viewingVersionId).body;
/** What isAgentDirty / isCrewDirty now compute. */
const agentDirty = a => !eb.agentBodiesEqual(a, viewingBody(a));
const crewDirty = c => !eb.crewBodiesEqual(c, viewingBody(c));
/** What they computed before (raw saved body). */
const oldAgentDirty = a => eb.stableStringify(eb.bodyOfAgent(a)) !== eb.stableStringify(viewingBody(a));
const oldCrewDirty = c => eb.stableStringify(eb.bodyOfCrew(c)) !== eb.stableStringify(viewingBody(c));

// ─── A clean, Builder-shaped saved agent body ──────────────────────
const persona = { id: 'persona_a', name: 'main', content: 'You are kind.', appliesTo: ['*'] };
const field = { name: 'age', type: 'number', description: 'Age' };
const clean = {
  name: 'Test', slug: 'zz-test', spec: 'spec', persona: '', personas: [persona],
  defaultCrewId: 'crew_1', fields: [field], domains: [], parameters: [], enums: [], cortex: [], snippets: [],
};

console.log('\n── agent: saved from outside the Builder → not dirty ──');
const outside = {
  'tags: []':                        { ...clean, tags: [] },
  'no personas (legacy)':            (() => { const b = { ...clean }; delete b.personas; return b; })(),
  "modelRoute: 'direct'":            { ...clean, modelRoute: 'direct' },
  'liveBrain: { panels: [] }':       { ...clean, liveBrain: { panels: [] } },
  'profiler: { panels: [] }':        { ...clean, profiler: { panels: [] } },
  'triggers: { triggers: [] }':      { ...clean, triggers: { triggers: [] } },
  'crewTree: { parents: {} }':       { ...clean, crewTree: { parents: {} } },
  'dataProtection: null':            { ...clean, dataProtection: null },
  'no spec / persona / fields':      (() => { const b = { ...clean }; delete b.spec; delete b.persona; delete b.fields; return b; })(),
  'no domains / enums / cortex …':   (() => { const b = { ...clean }; for (const k of ['domains', 'parameters', 'enums', 'cortex', 'snippets']) delete b[k]; return b; })(),
  'a key the Builder does not know': { ...clean, somethingNew: 1 },
  'all of the above at once':        { ...clean, tags: [], modelRoute: 'direct', liveBrain: { panels: [] }, profiler: { panels: [] }, triggers: { triggers: [] }, crewTree: { parents: {} }, dataProtection: null, somethingNew: 1 },
};
for (const [name, body] of Object.entries(outside)) check(name, !agentDirty(hydrateAgent(body)));
check('(the old raw compare WAS dirty on tags: [] — the bug)', oldAgentDirty(hydrateAgent({ ...clean, tags: [] })));
check('clean Builder-shaped body → not dirty', !agentDirty(hydrateAgent(clean)));

console.log('\n── agent: real edits → dirty ──');
const edits = {
  'persona text':          a => ({ ...a, personas: [{ ...persona, content: 'You are strict.' }] }),
  'legacy persona string': a => ({ ...a, persona: 'changed' }),
  'spec':                  a => ({ ...a, spec: 'new spec' }),
  'a field added':         a => ({ ...a, fields: [...a.fields, { name: 'city', type: 'text' }] }),
  'a field changed':       a => ({ ...a, fields: [{ ...field, description: 'Age in years' }] }),
  'a tag declared':        a => ({ ...a, tags: ['money'] }),
  'model route → vertex':  a => ({ ...a, modelRoute: 'vertex' }),
  'a live brain panel':    a => ({ ...a, liveBrain: { panels: [{ id: 'p1' }] } }),
  'name':                  a => ({ ...a, name: 'Other' }),
};
for (const [name, edit] of Object.entries(edits)) {
  check(`${name} (from a tags:[] saved body)`, agentDirty(edit(hydrateAgent({ ...clean, tags: [] }))));
  check(`${name} (from a clean saved body)`, agentDirty(edit(hydrateAgent(clean))));
}
check('removing the only tag from a tagged agent → dirty', agentDirty({ ...hydrateAgent({ ...clean, tags: ['money'] }), tags: [] }));

console.log('\n── crew ──');
const addon = { instanceId: 'addon_1', pluginId: 'talker', lane: 'main', enabled: true, config: {}, promptTemplate: 'Hi' };
const crewClean = { name: 'Welcome', description: '', spec: 'crew spec', addons: [addon], fields: [] };
const crewOutside = {
  'dataProtection: null':          { ...crewClean, dataProtection: null },
  'no description':                (() => { const b = { ...crewClean }; delete b.description; return b; })(),
  'no addons / fields':            (() => { const b = { ...crewClean }; delete b.addons; delete b.fields; return b; })(),
  'a key the Builder does not know': { ...crewClean, kbStore: 'x' },
};
for (const [name, body] of Object.entries(crewOutside)) check(`${name} → not dirty`, !crewDirty(hydrateCrew(body)));
check('(the old raw compare WAS dirty on dataProtection: null)', oldCrewDirty(hydrateCrew({ ...crewClean, dataProtection: null })));
check('clean crew → not dirty', !crewDirty(hydrateCrew(crewClean)));
check('crew spec edit → dirty', crewDirty({ ...hydrateCrew(crewClean), spec: 'other' }));
check('addon prompt edit → dirty', crewDirty({ ...hydrateCrew(crewClean), addons: [{ ...addon, promptTemplate: 'Hello' }] }));
check('crew data protection set → dirty', crewDirty({ ...hydrateCrew(crewClean), dataProtection: { detectors: { il_id: false } } }));

console.log('\n── canonical form ──');
for (const [name, body] of Object.entries(outside)) {
  const c1 = eb.canonicalAgentBody(body);
  check(`idempotent: ${name}`, eb.stableStringify(eb.canonicalAgentBody(c1)) === eb.stableStringify(c1));
}
check('canonical(working copy) === canonical(bodyOfAgent(working copy))',
  eb.stableStringify(eb.canonicalAgentBody(hydrateAgent(clean))) === eb.stableStringify(eb.canonicalAgentBody(eb.bodyOfAgent(hydrateAgent(clean)))));

console.log('\n── save body (projection) unchanged ──');
// The previous save copies, verbatim from useProjectSync.ts before #69.
function oldSaveAgent(agent) {
  return {
    name: agent.name, slug: agent.slug, spec: agent.spec, persona: agent.persona,
    personas: agent.personas ?? [], defaultCrewId: agent.defaultCrewId, fields: agent.fields,
    domains: agent.domains ?? [], parameters: agent.parameters ?? [], enums: agent.enums ?? [],
    cortex: agent.cortex ?? [], snippets: agent.snippets ?? [],
    ...((agent.liveBrain?.panels?.length || agent.liveBrain?.frame || agent.liveBrain?.enabled === false) ? { liveBrain: agent.liveBrain } : {}),
    ...((agent.profiler?.panels?.length || agent.profiler?.frame || agent.profiler?.ask || agent.profiler?.enabled === false) ? { profiler: agent.profiler } : {}),
    ...((agent.triggers?.triggers?.length || agent.triggers?.enabled === false) ? { triggers: agent.triggers } : {}),
    ...(Object.keys(agent.crewTree?.parents ?? {}).length ? { crewTree: agent.crewTree } : {}),
    ...(agent.modelRoute === 'vertex' ? { modelRoute: 'vertex' } : {}),
    ...(agent.dataProtection ? { dataProtection: agent.dataProtection } : {}),
  };
}
function oldSaveCrew(crew) {
  return {
    name: crew.name, description: crew.description, spec: crew.spec, persona: crew.persona,
    addons: crew.addons, fields: crew.fields,
    ...(crew.dataProtection ? { dataProtection: crew.dataProtection } : {}),
  };
}
const rich = hydrateAgent({ ...clean, modelRoute: 'vertex', liveBrain: { panels: [{ id: 'p' }] }, dataProtection: { enabled: true }, crewTree: { parents: { a: 'b' } } });
for (const [name, a] of [['clean agent', hydrateAgent(clean)], ['agent with every section', rich], ['tags: [] agent', hydrateAgent({ ...clean, tags: [] })]]) {
  check(`byte-identical save: ${name}`, JSON.stringify(eb.bodyOfAgent(a)) === JSON.stringify(oldSaveAgent(a)));
}
const tagged = hydrateAgent({ ...clean, tags: ['money'] });
check('tags now persist on save (old save copy dropped them)',
  JSON.stringify(eb.bodyOfAgent(tagged).tags) === '["money"]' && oldSaveAgent(tagged).tags === undefined);
for (const [name, c] of [['clean crew', hydrateCrew(crewClean)], ['crew with protection', hydrateCrew({ ...crewClean, dataProtection: { detectors: { il_id: false } } })]]) {
  check(`byte-identical save: ${name}`, JSON.stringify(eb.bodyOfCrew(c)) === JSON.stringify(oldSaveCrew(c)));
}

console.log('\n── discard = the inverse (applyAgentBody / applyCrewBody) ──');
const BODY_KEYS_A = ['name', 'slug', 'spec', 'persona', 'defaultCrewId', 'fields', 'domains', 'tags', 'parameters', 'enums', 'cortex', 'snippets', 'personas', 'liveBrain', 'profiler', 'triggers', 'crewTree', 'modelRoute', 'dataProtection'];
const BODY_KEYS_C = ['name', 'description', 'spec', 'persona', 'addons', 'fields', 'dataProtection'];
/** Same as a fresh load: every body key AND everything else (id, versions, pointers). */
const sameAsLoad = (a, b) => eb.stableStringify(a) === eb.stableStringify(b);
/** Simulate what discardAgentChanges / discardCrewChanges now do. */
const discardA = a => eb.applyAgentBody(a, viewingBody(a));
const discardC = c => eb.applyCrewBody(c, viewingBody(c));

const agentEdits = {
  'personas':                 a => ({ ...a, personas: [{ ...persona, content: 'changed' }, { id: 'p2', name: 'x', content: 'y', appliesTo: ['*'] }] }),
  'tags added':               a => ({ ...a, tags: ['money', 'risk'] }),
  'liveBrain set':            a => ({ ...a, liveBrain: { panels: [{ id: 'p1' }], frame: 'f' } }),
  'profiler set':             a => ({ ...a, profiler: { panels: [{ id: 'q' }] } }),
  'triggers set':             a => ({ ...a, triggers: { triggers: [{ id: 't' }] } }),
  'model route → vertex':     a => ({ ...a, modelRoute: 'vertex' }),
  'data protection on':       a => ({ ...a, dataProtection: { enabled: true } }),
  'domains / enums / params': a => ({ ...a, domains: ['d'], enums: [{ name: 'e' }], parameters: [{ name: 'p' }] }),
  'spec, name, persona':      a => ({ ...a, spec: 'x', name: 'y', persona: 'z' }),
};
// Every section edited at once, from each "outside" saved shape.
const allEdits = a => Object.values(agentEdits).reduce((acc, f) => f(acc), a);
for (const [savedName, savedBody] of [['clean body', clean], ['tags: [] body', { ...clean, tags: [] }],
  ['body with sections', { ...clean, tags: ['old'], liveBrain: { panels: [{ id: 'keep' }] }, modelRoute: 'vertex' }],
  ['outside-shaped body', outside['all of the above at once']]]) {
  const fresh = hydrateAgent(savedBody);
  for (const [editName, edit] of Object.entries(agentEdits)) {
    const back = discardA(edit(fresh));
    check(`${savedName} · ${editName} → discard → clean & same as a fresh load`, !agentDirty(back) && sameAsLoad(back, fresh),
      sameAsLoad(back, fresh) ? 'still dirty' : `diff in ${BODY_KEYS_A.filter(k => eb.stableStringify(back[k]) !== eb.stableStringify(fresh[k])).join(',')}`);
  }
  const back = discardA(allEdits(fresh));
  check(`${savedName} · EVERY section edited → discard → clean & same as a fresh load`, !agentDirty(back) && sameAsLoad(back, fresh));
}
// An empty==absent section the saved body doesn't have must come back absent.
{
  const fresh = hydrateAgent(clean);
  const back = discardA({ ...fresh, liveBrain: { panels: [{ id: 'p' }] }, triggers: { triggers: [{ id: 't' }] }, modelRoute: 'vertex', dataProtection: { enabled: true }, crewTree: { parents: { a: 'b' } } });
  check('sections absent in the saved body are cleared (keys gone, not left over)',
    ['liveBrain', 'triggers', 'modelRoute', 'dataProtection', 'crewTree'].every(k => !(k in back)));
  check('non-body keys kept (id, crews, versions, pointers)',
    back.id === fresh.id && back.versions === fresh.versions && back.viewingVersionId === fresh.viewingVersionId && Array.isArray(back.crews));
  check('applyAgentBody(doc, body) equals the body canonically', eb.agentBodiesEqual(back, viewingBody(fresh)));
}

const crewEdits = {
  'dataProtection set':     c => ({ ...c, dataProtection: { detectors: { il_id: false } } }),
  'addon prompt':           c => ({ ...c, addons: [{ ...addon, promptTemplate: 'Changed' }] }),
  'spec / description':     c => ({ ...c, spec: 'x', description: 'y' }),
  'persona':                c => ({ ...c, persona: 'crew persona' }),
  'fields':                 c => ({ ...c, fields: [{ name: 'f' }] }),
};
for (const [savedName, savedBody] of [['clean crew', crewClean], ['crew with protection', { ...crewClean, dataProtection: { detectors: { phone: true } } }],
  ['crew dataProtection: null', { ...crewClean, dataProtection: null }]]) {
  const fresh = hydrateCrew(savedBody);
  for (const [editName, edit] of Object.entries(crewEdits)) {
    const back = discardC(edit(fresh));
    check(`${savedName} · ${editName} → discard → clean & same as a fresh load`, !crewDirty(back) && sameAsLoad(back, fresh),
      `diff in ${BODY_KEYS_C.filter(k => eb.stableStringify(back[k]) !== eb.stableStringify(fresh[k])).join(',')}`);
  }
}
{
  const fresh = hydrateCrew(crewClean);
  const back = discardC({ ...fresh, dataProtection: { detectors: { il_id: false } } });
  check('crew dataProtection absent in the saved body → cleared', !('dataProtection' in back));
}
// The old discard (hand-picked keys) left these dirty — the bug.
{
  const fresh = hydrateAgent(clean);
  const edited = { ...fresh, tags: ['money'], liveBrain: { panels: [{ id: 'p' }] } };
  const b = viewingBody(edited);
  const oldDiscard = { ...edited, name: b.name, slug: b.slug, spec: b.spec, persona: b.persona, defaultCrewId: b.defaultCrewId, fields: Array.isArray(b.fields) ? b.fields : [] };
  check('(the old agent discard stayed dirty — the bug)', agentDirty(oldDiscard));
  const cf = hydrateCrew(crewClean);
  const ce = { ...cf, dataProtection: { detectors: { il_id: false } } };
  const cb = viewingBody(ce);
  const oldCrewDiscard = { ...ce, name: cb.name, description: cb.description, spec: cb.spec, persona: cb.persona, addons: cb.addons, fields: cb.fields };
  check('(the old crew discard stayed dirty — the bug)', crewDirty(oldCrewDiscard));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
