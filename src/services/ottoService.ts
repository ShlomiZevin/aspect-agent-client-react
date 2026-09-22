/**
 * Otto custom screens — the client half of otto/routes/otto.routes.js.
 *
 * Every call is dataset-scoped and the server gate requires the `otto`
 * module to be LIVE for that dataset — a 403 here means the feature is
 * switched off for the client, which the shelf already knew (`canCreate`),
 * so surfaces behind it simply don't link here.
 */

import { apiRequest } from './api';
import type {
  BrainstormResult, BuildProgress, OttoCost, OttoMessage, OttoPlan,
  OttoScreen, OttoScreenSummary, OttoStarter, ScreenDataPayload,
} from '../types/otto';
import type { Localized } from '../types/apps';

const base = (datasetId: string) => `/api/otto/${encodeURIComponent(datasetId)}`;

/** `viewerId` is the anonymous per-browser id from UserContext — sent as a
 *  query param (works on every verb, including DELETE) so the server can
 *  tell a draft's creator apart from everyone else (task #92). */
const withViewer = (path: string, viewerId: string | null) =>
  viewerId ? `${path}?viewerId=${encodeURIComponent(viewerId)}` : path;

export const ottoService = {
  listScreens: (datasetId: string, viewerId: string | null, baseURL?: string) =>
    apiRequest<{ screens: OttoScreenSummary[]; starters: OttoStarter[] }>(
      withViewer(`${base(datasetId)}/screens`, viewerId), {}, baseURL),

  createScreen: (datasetId: string, createdBy: string | null, baseURL?: string) =>
    apiRequest<{ screen: OttoScreen }>(`${base(datasetId)}/screens`, {
      method: 'POST',
      body: JSON.stringify({ createdBy }),
    }, baseURL).then(r => r.screen),

  getScreen: (datasetId: string, id: string, viewerId: string | null, baseURL?: string) =>
    apiRequest<{ screen: OttoScreen }>(
      withViewer(`${base(datasetId)}/screens/${encodeURIComponent(id)}`, viewerId), {}, baseURL)
      .then(r => r.screen),

  rename: (datasetId: string, id: string, title: Localized, icon: string | undefined, viewerId: string | null, baseURL?: string) =>
    apiRequest<{ screen: OttoScreen }>(withViewer(`${base(datasetId)}/screens/${encodeURIComponent(id)}`, viewerId), {
      method: 'PATCH',
      body: JSON.stringify(icon ? { title, icon } : { title }),
    }, baseURL).then(r => r.screen),

  publish: (datasetId: string, id: string, viewerId: string | null, baseURL?: string) =>
    apiRequest<{ screen: OttoScreen }>(withViewer(`${base(datasetId)}/screens/${encodeURIComponent(id)}`, viewerId), {
      method: 'PATCH',
      body: JSON.stringify({ publish: true }),
    }, baseURL).then(r => r.screen),

  /** "Edit app": published → draft state, publish snapshot kept for revert. */
  unpublish: (datasetId: string, id: string, viewerId: string | null, baseURL?: string) =>
    apiRequest<{ screen: OttoScreen }>(withViewer(`${base(datasetId)}/screens/${encodeURIComponent(id)}`, viewerId), {
      method: 'PATCH',
      body: JSON.stringify({ unpublish: true }),
    }, baseURL).then(r => r.screen),

  /** "Cancel changes": restore the last published state, go live again. */
  revert: (datasetId: string, id: string, viewerId: string | null, baseURL?: string) =>
    apiRequest<{ screen: OttoScreen }>(withViewer(`${base(datasetId)}/screens/${encodeURIComponent(id)}`, viewerId), {
      method: 'PATCH',
      body: JSON.stringify({ revert: true }),
    }, baseURL).then(r => r.screen),

  deleteDraft: (datasetId: string, id: string, viewerId: string | null, baseURL?: string) =>
    apiRequest<{ deleted: boolean }>(withViewer(`${base(datasetId)}/screens/${encodeURIComponent(id)}`, viewerId), {
      method: 'DELETE',
    }, baseURL),

  chat: (datasetId: string, id: string, messages: OttoMessage[], language: 'en' | 'he', viewerId: string | null, baseURL?: string) =>
    apiRequest<BrainstormResult>(withViewer(`${base(datasetId)}/screens/${encodeURIComponent(id)}/chat`, viewerId), {
      method: 'POST',
      // language = the shell's EN/HE toggle; Otto converses in the interface
      // language, like Data Chat and reports.
      body: JSON.stringify({ messages, language }),
    }, baseURL),

  draftPlan: (datasetId: string, id: string, messages: OttoMessage[], viewerId: string | null, baseURL?: string) =>
    apiRequest<{ plan: OttoPlan }>(withViewer(`${base(datasetId)}/screens/${encodeURIComponent(id)}/plan`, viewerId), {
      method: 'POST',
      body: JSON.stringify({ messages }),
    }, baseURL).then(r => r.plan),

  startBuild: (datasetId: string, id: string, viewerId: string | null, baseURL?: string) =>
    apiRequest<{ buildId: number }>(withViewer(`${base(datasetId)}/screens/${encodeURIComponent(id)}/build`, viewerId), {
      method: 'POST',
      body: JSON.stringify({}),
    }, baseURL),

  latestBuild: (datasetId: string, id: string, viewerId: string | null, baseURL?: string) =>
    apiRequest<{ build: BuildProgress | null }>(
      withViewer(`${base(datasetId)}/screens/${encodeURIComponent(id)}/build/latest`, viewerId), {}, baseURL)
      .then(r => r.build),

  /** What this screen has cost to make so far — chat, plans, builds. */
  getCost: (datasetId: string, id: string, viewerId: string | null, baseURL?: string) =>
    apiRequest<{ cost: OttoCost }>(
      withViewer(`${base(datasetId)}/screens/${encodeURIComponent(id)}/cost`, viewerId), {}, baseURL)
      .then(r => r.cost),

  runningBuilds: (datasetId: string, baseURL?: string) =>
    apiRequest<{ builds: BuildProgress[] }>(`${base(datasetId)}/builds/running`, {}, baseURL)
      .then(r => r.builds),

  getData: (datasetId: string, id: string, viewerId: string | null, baseURL?: string) =>
    apiRequest<ScreenDataPayload>(
      withViewer(`${base(datasetId)}/screens/${encodeURIComponent(id)}/data`, viewerId), {}, baseURL),
};
