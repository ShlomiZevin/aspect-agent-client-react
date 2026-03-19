import { apiRequest, getBaseURL } from './api';
import type { DynamicFile, DynamicFileAttachment, TableData, SyncResult } from '../types';

function mapFile(f: Record<string, unknown>): DynamicFile {
  return {
    id: f.id as number,
    agentId: f.agentId as number,
    name: f.name as string,
    fileType: f.fileType as 'text' | 'table',
    fileSize: (f.fileSize as number) || 0,
    attachmentCount: (f.attachmentCount as number) || 0,
    createdAt: new Date(f.createdAt as string),
    updatedAt: new Date(f.updatedAt as string),
  };
}

export async function getFiles(agentName: string, baseURL?: string): Promise<DynamicFile[]> {
  const data = await apiRequest<Record<string, unknown>[]>(
    `/api/dynamic-kb/${encodeURIComponent(agentName)}/files`,
    { method: 'GET' },
    baseURL || getBaseURL()
  );
  return data.map(mapFile);
}

export async function createFile(
  agentName: string,
  name: string,
  fileType: 'text' | 'table',
  baseURL?: string
): Promise<DynamicFile> {
  const data = await apiRequest<Record<string, unknown>>(
    `/api/dynamic-kb/${encodeURIComponent(agentName)}/files`,
    { method: 'POST', body: JSON.stringify({ name, fileType }) },
    baseURL || getBaseURL()
  );
  return mapFile(data);
}

export async function updateFile(
  fileId: number,
  data: { name: string },
  baseURL?: string
): Promise<DynamicFile> {
  const result = await apiRequest<Record<string, unknown>>(
    `/api/dynamic-kb/files/${fileId}`,
    { method: 'PUT', body: JSON.stringify(data) },
    baseURL || getBaseURL()
  );
  return mapFile(result);
}

export async function deleteFile(fileId: number, baseURL?: string): Promise<void> {
  await apiRequest(
    `/api/dynamic-kb/files/${fileId}`,
    { method: 'DELETE' },
    baseURL || getBaseURL()
  );
}

export async function loadContent(
  fileId: number,
  baseURL?: string
): Promise<string | TableData> {
  const data = await apiRequest<{ content: string | TableData }>(
    `/api/dynamic-kb/files/${fileId}/content`,
    { method: 'GET' },
    baseURL || getBaseURL()
  );
  return data.content;
}

export async function saveContent(
  fileId: number,
  content: string | TableData,
  fileType: 'text' | 'table',
  baseURL?: string
): Promise<SyncResult> {
  return apiRequest<SyncResult>(
    `/api/dynamic-kb/files/${fileId}/content`,
    { method: 'PUT', body: JSON.stringify({ content, fileType }) },
    baseURL || getBaseURL()
  );
}

export async function getAttachments(
  fileId: number,
  baseURL?: string
): Promise<DynamicFileAttachment[]> {
  return apiRequest<DynamicFileAttachment[]>(
    `/api/dynamic-kb/files/${fileId}/attachments`,
    { method: 'GET' },
    baseURL || getBaseURL()
  );
}

export async function attachToKB(
  fileId: number,
  kbId: number,
  baseURL?: string
): Promise<void> {
  await apiRequest(
    `/api/dynamic-kb/files/${fileId}/attach/${kbId}`,
    { method: 'POST' },
    baseURL || getBaseURL()
  );
}

export async function detachFromKB(
  fileId: number,
  kbId: number,
  baseURL?: string
): Promise<void> {
  await apiRequest(
    `/api/dynamic-kb/files/${fileId}/attach/${kbId}`,
    { method: 'DELETE' },
    baseURL || getBaseURL()
  );
}

export async function importDoc(file: File, baseURL?: string): Promise<{ text: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const url = `${baseURL || getBaseURL()}/api/dynamic-kb/import/doc`;
  const response = await fetch(url, { method: 'POST', body: formData });
  if (!response.ok) throw new Error(`Import failed: ${response.statusText}`);
  return response.json();
}

export async function importSpreadsheet(
  file: File,
  baseURL?: string
): Promise<TableData> {
  const formData = new FormData();
  formData.append('file', file);
  const url = `${baseURL || getBaseURL()}/api/dynamic-kb/import/spreadsheet`;
  const response = await fetch(url, { method: 'POST', body: formData });
  if (!response.ok) throw new Error(`Import failed: ${response.statusText}`);
  return response.json();
}
