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
  BrainstormResult, BuildProgress, OttoMessage, OttoPlan,
  OttoScreen, OttoScreenSummary, OttoStarter, ScreenDataPayload,
} from '../types/otto';
import type { Localized } from '../types/apps';

const base = (datasetId: string) => `/api/otto/${encodeURIComponent(datasetId)}`;

export const ottoService = {
  listScreens: (datasetId: string, baseURL?: string) =>
    apiRequest<{ screens: OttoScreenSummary[]; starters: OttoStarter[] }>(
      `${base(datasetId)}/screens`, {}, baseURL),

  createScreen: (datasetId: string, createdBy: string | null, baseURL?: string) =>
    apiRequest<{ screen: OttoScreen }>(`${base(datasetId)}/screens`, {
      method: 'POST',
      body: JSON.stringify({ createdBy }),
    }, baseURL).then(r => r.screen),

  getScreen: (datasetId: string, id: string, baseURL?: string) =>
    apiRequest<{ screen: OttoScreen }>(`${base(datasetId)}/screens/${encodeURIComponent(id)}`, {}, baseURL)
      .then(r => r.screen),

  rename: (datasetId: string, id: string, title: Localized, icon: string | undefined, baseURL?: string) =>
    apiRequest<{ screen: OttoScreen }>(`${base(datasetId)}/screens/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(icon ? { title, icon } : { title }),
    }, baseURL).then(r => r.screen),

  publish: (datasetId: string, id: string, baseURL?: string) =>
    apiRequest<{ screen: OttoScreen }>(`${base(datasetId)}/screens/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ publish: true }),
    }, baseURL).then(r => r.screen),

  deleteDraft: (datasetId: string, id: string, baseURL?: string) =>
    apiRequest<{ deleted: boolean }>(`${base(datasetId)}/screens/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }, baseURL),

  chat: (datasetId: string, id: string, messages: OttoMessage[], language: 'en' | 'he', baseURL?: string) =>
    apiRequest<BrainstormResult>(`${base(datasetId)}/screens/${encodeURIComponent(id)}/chat`, {
      method: 'POST',
      // language = the shell's EN/HE toggle; Otto converses in the interface
      // language, like Data Chat and reports.
      body: JSON.stringify({ messages, language }),
    }, baseURL),

  draftPlan: (datasetId: string, id: string, messages: OttoMessage[], baseURL?: string) =>
    apiRequest<{ plan: OttoPlan }>(`${base(datasetId)}/screens/${encodeURIComponent(id)}/plan`, {
      method: 'POST',
      body: JSON.stringify({ messages }),
    }, baseURL).then(r => r.plan),

  startBuild: (datasetId: string, id: string, baseURL?: string) =>
    apiRequest<{ buildId: number }>(`${base(datasetId)}/screens/${encodeURIComponent(id)}/build`, {
      method: 'POST',
      body: JSON.stringify({}),
    }, baseURL),

  latestBuild: (datasetId: string, id: string, baseURL?: string) =>
    apiRequest<{ build: BuildProgress | null }>(
      `${base(datasetId)}/screens/${encodeURIComponent(id)}/build/latest`, {}, baseURL)
      .then(r => r.build),

  runningBuilds: (datasetId: string, baseURL?: string) =>
    apiRequest<{ builds: BuildProgress[] }>(`${base(datasetId)}/builds/running`, {}, baseURL)
      .then(r => r.builds),

  getData: (datasetId: string, id: string, baseURL?: string) =>
    apiRequest<ScreenDataPayload>(
      `${base(datasetId)}/screens/${encodeURIComponent(id)}/data`, {}, baseURL),
};
