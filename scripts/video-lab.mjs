// Video Lab: the same scene, the same start frame and the same prompt through every Leonardo video model.
// Each clip goes to public/lybi-site/marketing/social/clips/; results.json keeps the model, params, prompt, quoted cost and timing.
// Re-runnable: a clip already in results.json with status "done" is skipped.
//   node scripts/video-lab.mjs [--cap 28] [--only veo-3.1-lite,kling-3.0] [--scene couple] [--jobs 3]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'lybi-site', 'marketing', 'social');
const ENV = 'C:\\workspace\\aspect\\aspect-agent-server\\.env';
const KEY = process.env.LEONARDO_API_KEY || fs.readFileSync(ENV, 'utf8').split(/\r?\n/).find((l) => l.startsWith('LEONARDO_API_KEY=')).slice(17).trim();
const API = 'https://cloud.leonardo.ai/api/rest';
const headers = () => ({ authorization: `Bearer ${KEY}`, accept: 'application/json', 'content-type': 'application/json' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt; };
const CAP = Number(arg('cap', '28'));
const ONLY = arg('only', '')?.split(',').filter(Boolean);
const SCENE = arg('scene', '');
const JOBS = Number(arg('jobs', '3'));

const SCENES = {
  couple: {
    frame: 'frames/couple.jpg',
    prompt: 'A couple sit on a sofa in a warm living room in the evening. The woman on the left, in the cream knit sweater, is looking at her phone. '
      + 'The man on the right, in the navy henley, looks up from his laptop and asks her casually: "Is it done?" '
      + 'She answers calmly, still looking at the phone: "Not yet. Can we look at a couple of other banks first?" '
      + 'Then she lowers the phone to her lap and they share a quiet beat. Natural, warm, understated performances. '
      + 'Restrained camera, a very slow gentle push-in. Quiet room tone, no music.',
  },
  cafe: {
    frame: 'frames/cafe.jpg',
    prompt: 'Two women friends sit at a small wooden table in a quiet café by the window. '
      + 'The friend on the left, with curly auburn hair and a mustard cardigan, asks warmly: "Did you start taking what the doctor prescribed?" '
      + 'The woman on the right, in the olive-green shirt, holding a small plain white medication box, answers candidly: "I was about to, but then I read the leaflet and got scared." '
      + 'She glances at the box and puts it back into her bag. Natural, understated performances, no panic. '
      + 'Restrained camera. Quiet café ambience, no music.',
  },
};

// Cheapest first, so the cap only ever blocks the expensive end. guide: how the start frame is passed.
const W = 1280, H = 720, SECS = 8;
const MODELS = [
  { key: 'seedance-2.0-mini', label: 'Seedance 2.0 Mini', maker: 'ByteDance', params: {} },
  { key: 'veo-3.1-lite', label: 'Veo 3.1 Lite', maker: 'Google', params: {} },
  { key: 'grok-imagine-1.5', label: 'Grok Imagine 1.5', maker: 'xAI', params: {} },
  { key: 'alibaba/wan-3.0', label: 'Wan 3.0', maker: 'Alibaba', params: {} },
  { key: 'seedance-2.0-fast', label: 'Seedance 2.0 Fast', maker: 'ByteDance', params: {} },
  { key: 'veo-3.1-fast-generate-001', label: 'Veo 3.1 Fast', maker: 'Google', params: {} },
  { key: 'kling-3.0-turbo', label: 'Kling 3.0 Turbo', maker: 'Kuaishou', params: {} },
  { key: 'kling-3.0', label: 'Kling 3.0', maker: 'Kuaishou', params: { mode: 'RESOLUTION_720' } },
  { key: 'happy-horse-1.1', label: 'Happy Horse 1.1', maker: 'Alibaba', params: {} },
  { key: 'gemini-omni-flash', label: 'Gemini Omni Flash', maker: 'Google', params: {}, guide: 'image_reference' },
  { key: 'seedance-2.0', label: 'Seedance 2.0', maker: 'ByteDance', params: {} },
  { key: 'bytedance/seedance-2.5', label: 'Seedance 2.5', maker: 'ByteDance', params: {} },
  { key: 'veo-3.1-generate-001', label: 'Veo 3.1', maker: 'Google', params: {}, scenes: ['couple'] },
];

const RESULTS = path.join(ROOT, 'results.json');
const results = fs.existsSync(RESULTS) ? JSON.parse(fs.readFileSync(RESULTS, 'utf8')) : { clips: [] };
const save = () => fs.writeFileSync(RESULTS, JSON.stringify({ ...results, updated: new Date().toISOString(), scenes: SCENES, models: MODELS }, null, 2));
const slug = (s) => s.replace(/[^a-z0-9.]+/gi, '-');

async function upload(file) {
  const extension = path.extname(file).slice(1).toLowerCase();
  const init = await fetch(`${API}/v1/init-image`, { method: 'POST', headers: headers(), body: JSON.stringify({ extension }) });
  const { uploadInitImage } = await init.json();
  if (!uploadInitImage) throw new Error('frame upload refused');
  const form = new FormData();
  for (const [k, v] of Object.entries(JSON.parse(uploadInitImage.fields))) form.append(k, v);
  form.append('file', new Blob([fs.readFileSync(file)]), `frame.${extension}`);
  const put = await fetch(uploadInitImage.url, { method: 'POST', body: form });
  if (!put.ok) throw new Error(`frame upload failed (${put.status})`);
  return uploadInitImage.id;
}

function findUrl(o, re, depth = 0) {
  if (!o || depth > 6) return null;
  if (typeof o === 'string') return re.test(o) ? o : null;
  if (typeof o !== 'object') return null;
  for (const k of Object.keys(o)) { const u = findUrl(o[k], re, depth + 1); if (u) return u; }
  return null;
}

async function run(model, sceneKey, frameId, clip) {
  const scene = SCENES[sceneKey];
  const image = { id: frameId, type: 'UPLOADED' };
  const guidances = model.guide === 'image_reference'
    ? { image_reference: [{ image, strength: 'HIGH' }] }
    : { start_frame: [{ image }] };
  const parameters = { prompt: scene.prompt, quantity: 1, duration: SECS, width: W, height: H, motion_has_audio: true, ...model.params, guidances };
  Object.assign(clip, { status: 'queued', parameters: { ...parameters, guidances: Object.keys(guidances)[0] }, started: Date.now() });
  const res = await fetch(`${API}/v2/generations`, { method: 'POST', headers: headers(), body: JSON.stringify({ public: false, model: model.key, parameters }) });
  const json = await res.json().catch(() => null);
  const id = json?.generate?.generationId;
  if (!res.ok || !id) throw new Error(`rejected (HTTP ${res.status}): ${JSON.stringify(json).slice(0, 600)}`);
  clip.generationId = id;
  clip.costUsd = parseFloat(json.generate.cost?.amount ?? '0') || 0;
  clip.costRaw = json.generate.cost ?? null;
  save();
  console.log(`queued ${model.label} / ${sceneKey}  $${clip.costUsd}`);
  for (let i = 0; i < 300; i++) {
    await sleep(5000);
    const p = await fetch(`${API}/v1/generations/${id}`, { headers: headers() });
    const j = await p.json().catch(() => null);
    const gen = j && (j.generations_by_pk || j.generation || j);
    if (gen?.status === 'FAILED') throw new Error(`failed: ${JSON.stringify(gen).slice(0, 500)}`);
    if (gen?.status !== 'COMPLETE') continue;
    const url = findUrl(gen, /^https?:\/\/\S+\.(mp4|webm|mov)(\?\S*)?$/i);
    if (!url) throw new Error('complete but no video url');
    const a = await fetch(encodeURI(decodeURI(url)), { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!a.ok) throw new Error(`download failed (${a.status})`);
    const buf = Buffer.from(await a.arrayBuffer());
    if (buf.length < 20000) throw new Error('download was empty');
    fs.writeFileSync(path.join(ROOT, clip.file), buf);
    // a still for the page: iPhones show nothing until a video plays
    fs.mkdirSync(path.join(ROOT, 'posters'), { recursive: true });
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', '0.3', '-i', path.join(ROOT, clip.file), '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '4',
      path.join(ROOT, clip.file.replace(/^clips\//, 'posters/').replace(/\.mp4$/, '.jpg'))]);
    Object.assign(clip, { status: 'done', seconds: Math.round((Date.now() - clip.started) / 1000), bytes: buf.length, url });
    return;
  }
  throw new Error('timed out after 25 min');
}

const frameIds = {};
const queue = [];
for (const model of MODELS) {
  if (ONLY?.length && !ONLY.includes(model.key)) continue;
  for (const sceneKey of model.scenes || Object.keys(SCENES)) {
    if (SCENE && SCENE !== sceneKey) continue;
    let clip = results.clips.find((c) => c.model === model.key && c.scene === sceneKey);
    if (clip?.status === 'done') continue;
    if (!clip) { clip = { model: model.key, label: model.label, maker: model.maker, scene: sceneKey }; results.clips.push(clip); }
    clip.file = `clips/${sceneKey}__${slug(model.key)}.mp4`;
    delete clip.error;
    queue.push({ model, sceneKey, clip });
  }
}
for (const k of new Set(queue.map((q) => q.sceneKey))) frameIds[k] = await upload(path.join(ROOT, SCENES[k].frame));

let spent = results.clips.reduce((s, c) => s + (c.status === 'done' ? c.costUsd || 0 : 0), 0);
console.log(`${queue.length} clips to make, already spent $${spent.toFixed(2)}, cap $${CAP}`);
async function worker() {
  while (queue.length) {
    const { model, sceneKey, clip } = queue.shift();
    if (spent >= CAP) { clip.status = 'skipped'; clip.error = `budget cap $${CAP} reached`; save(); continue; }
    try {
      await run(model, sceneKey, frameIds[sceneKey], clip);
      console.log(`OK   ${model.label} / ${sceneKey}  ${clip.seconds}s  $${clip.costUsd}`);
    } catch (e) {
      Object.assign(clip, { status: 'failed', error: String(e.message || e) });
      console.log(`FAIL ${model.label} / ${sceneKey}: ${clip.error}`);
    }
    spent += clip.costUsd || 0;
    save();
  }
}
await Promise.all(Array.from({ length: JOBS }, worker));
save();
console.log(`done. spent $${spent.toFixed(2)}`);
