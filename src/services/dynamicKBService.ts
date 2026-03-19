import { apiRequest, getBaseURL } from './api';
import type { DynamicFile, DynamicFileAttachment, TableData } from '../types/dynamicKB';

interface DynamicFileRaw {
  id: number;
  agentId: number;
  name: string;
  fileType: 'text' | 'table';
  fileSize: number;
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
}

function mapFile(f: DynamicFileRaw): DynamicFile {
  return {
    ...f,
    createdAt: new Date(f.createdAt),
    updatedAt: new Date(f.updatedAt),
  };
}

export async function getFiles(agentName: string): Promise<DynamicFile[]> {
  const data = await apiRequest<{ files: DynamicFileRaw[] }>(
    `/api/dynamic-kb/${encodeURIComponent(agentName)}/files`,
    { method: 'GET' },
    getBaseURL()
  );
  return data.files.map(mapFile);
}

export async function createFile(
  agentName: string,
  name: string,
  fileType: 'text' | 'table'
): Promise<DynamicFile> {
  const data = await apiRequest<{ file: DynamicFileRaw }>(
    `/api/dynamic-kb/${encodeURIComponent(agentName)}/files`,
    { method: 'POST', body: JSON.stringify({ name, fileType }) },
    getBaseURL()
  );
  return mapFile(data.file);
}

export async function updateFile(fileId: number, updates: { name: string }): Promise<DynamicFile> {
  const data = await apiRequest<{ file: DynamicFileRaw }>(
    `/api/dynamic-kb/files/${fileId}`,
    { method: 'PUT', body: JSON.stringify(updates) },
    getBaseURL()
  );
  return mapFile(data.file);
}

export async function deleteFile(fileId: number): Promise<void> {
  await apiRequest<{ success: boolean }>(
    `/api/dynamic-kb/files/${fileId}`,
    { method: 'DELETE' },
    getBaseURL()
  );
}

export async function loadContent(fileId: number): Promise<string | TableData> {
  const data = await apiRequest<{ content: string | TableData }>(
    `/api/dynamic-kb/files/${fileId}/content`,
    { method: 'GET' },
    getBaseURL()
  );
  return data.content;
}

export async function saveContent(
  fileId: number,
  content: string | TableData
): Promise<{ synced: boolean; syncedKBs: string[] }> {
  const data = await apiRequest<{ synced: boolean; syncedKBs: string[] }>(
    `/api/dynamic-kb/files/${fileId}/content`,
    { method: 'PUT', body: JSON.stringify({ content }) },
    getBaseURL()
  );
  return data;
}

export async function getAttachments(fileId: number): Promise<DynamicFileAttachment[]> {
  const data = await apiRequest<{ attachments: DynamicFileAttachment[] }>(
    `/api/dynamic-kb/files/${fileId}/attachments`,
    { method: 'GET' },
    getBaseURL()
  );
  return data.attachments;
}

export async function attachToKB(fileId: number, kbId: number): Promise<void> {
  await apiRequest<{ success: boolean }>(
    `/api/dynamic-kb/files/${fileId}/attach/${kbId}`,
    { method: 'POST' },
    getBaseURL()
  );
}

export async function detachFromKB(fileId: number, kbId: number): Promise<void> {
  await apiRequest<{ success: boolean }>(
    `/api/dynamic-kb/files/${fileId}/attach/${kbId}`,
    { method: 'DELETE' },
    getBaseURL()
  );
}

export async function importDoc(file: File): Promise<{ text: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const url = `${getBaseURL()}/api/dynamic-kb/import/doc`;
  const res = await fetch(url, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function importSpreadsheet(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  const formData = new FormData();
  formData.append('file', file);
  const url = `${getBaseURL()}/api/dynamic-kb/import/spreadsheet`;
  const res = await fetch(url, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
