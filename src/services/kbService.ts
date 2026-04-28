import { apiRequest, getBaseURL } from './api';
import type { KnowledgeBase, KBFile, KBProviderName } from '../types';

interface KBListResponse {
  knowledgeBases: Array<{
    id: number;
    name: string;
    description: string;
    agentName: string;
    providers: KBProviderName[];
    vectorStoreId?: string;
    googleCorpusId?: string;
    syncedFromId?: number;
    lastSyncedAt?: string;
    createdAt: string;
    updatedAt: string;
    fileCount: number;
    totalSize: number;
  }>;
}

interface KBFilesResponse {
  knowledgeBaseId: number;
  files: Array<{
    id: number;
    openaiFileId?: string;
    googleDocumentId?: string;
    originalFileUrl?: string | null;
    fileName: string;
    fileSize: number;
    fileType: string;
    tags: string[];
    status: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

function mapKB(kb: KBListResponse['knowledgeBases'][0]): KnowledgeBase {
  return {
    id: kb.id,
    name: kb.name,
    description: kb.description,
    agentName: kb.agentName || '',
    providers: kb.providers || ['openai'],
    vectorStoreId: kb.vectorStoreId,
    googleCorpusId: kb.googleCorpusId,
    syncedFromId: kb.syncedFromId,
    lastSyncedAt: kb.lastSyncedAt ? new Date(kb.lastSyncedAt) : undefined,
    fileCount: kb.fileCount,
    totalSize: kb.totalSize,
    createdAt: new Date(kb.createdAt),
    updatedAt: new Date(kb.updatedAt),
  };
}

export async function getKnowledgeBases(
  agentName: string,
  baseURL?: string
): Promise<KnowledgeBase[]> {
  const data = await apiRequest<KBListResponse>(
    `/api/kb/list/${encodeURIComponent(agentName)}`,
    { method: 'GET' },
    baseURL || getBaseURL()
  );
  return data.knowledgeBases.map(mapKB);
}

export async function getKBFiles(
  kbId: number,
  baseURL?: string
): Promise<KBFile[]> {
  const data = await apiRequest<KBFilesResponse>(
    `/api/kb/${kbId}/files`,
    { method: 'GET' },
    baseURL || getBaseURL()
  );

  return data.files.map(file => ({
    id: file.id ?? null,
    openaiFileId: file.openaiFileId,
    googleDocumentId: file.googleDocumentId,
    originalFileUrl: file.originalFileUrl ?? null,
    name: file.fileName,
    size: file.fileSize,
    type: file.fileType,
    tags: file.tags || [],
    uploadedAt: file.createdAt ? new Date(file.createdAt) : new Date(),
  }));
}

export async function createKnowledgeBase(
  name: string,
  description: string,
  agentName: string,
  providers: KBProviderName[],
  baseURL?: string
): Promise<KnowledgeBase> {
  const data = await apiRequest<{ success: boolean; knowledgeBase: KBListResponse['knowledgeBases'][0] }>(
    '/api/kb/create',
    {
      method: 'POST',
      body: JSON.stringify({ name, description, agentName, providers }),
    },
    baseURL || getBaseURL()
  );
  return mapKB(data.knowledgeBase);
}

export type FileUploadStatus = 'pending' | 'uploading' | 'done' | 'error';

export interface FileUploadProgress {
  name: string;
  status: FileUploadStatus;
  error?: string;
}

export async function uploadFiles(
  kbId: number,
  files: File[],
  tags: string[] = [],
  onProgress?: (progress: FileUploadProgress[]) => void,
  baseURL?: string
): Promise<void> {
  const progress: FileUploadProgress[] = files.map(f => ({ name: f.name, status: 'pending' as const }));

  for (let i = 0; i < files.length; i++) {
    progress[i] = { ...progress[i], status: 'uploading' };
    onProgress?.([...progress]);

    const formData = new FormData();
    formData.append('file', files[i]);
    if (tags.length > 0) {
      formData.append('tags', JSON.stringify(tags));
    }

    const response = await fetch(
      `${baseURL || getBaseURL()}/api/kb/${kbId}/upload`,
      { method: 'POST', body: formData }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const errMsg = error.error || `Upload failed: ${response.status}`;
      progress[i] = { ...progress[i], status: 'error', error: errMsg };
      onProgress?.([...progress]);
      throw new Error(errMsg);
    }

    progress[i] = { ...progress[i], status: 'done' };
    onProgress?.([...progress]);
  }
}

export async function renameKnowledgeBase(
  kbId: number,
  name: string,
  baseURL?: string
): Promise<KnowledgeBase> {
  const data = await apiRequest<{ knowledgeBase: KBListResponse['knowledgeBases'][0] }>(
    `/api/kb/${kbId}`,
    { method: 'PATCH', body: JSON.stringify({ name }) },
    baseURL || getBaseURL()
  );
  return mapKB(data.knowledgeBase);
}

export async function deleteKnowledgeBase(
  kbId: number,
  baseURL?: string
): Promise<void> {
  await apiRequest(
    `/api/kb/${kbId}`,
    { method: 'DELETE' },
    baseURL || getBaseURL()
  );
}

export async function deleteFile(
  kbId: number,
  fileId: number,
  baseURL?: string
): Promise<void> {
  await apiRequest(
    `/api/kb/${kbId}/files/${fileId}`,
    { method: 'DELETE' },
    baseURL || getBaseURL()
  );
}

export async function deleteFileLegacy(
  kbId: number,
  openaiFileId: string,
  baseURL?: string
): Promise<void> {
  await apiRequest(
    `/api/kb/${kbId}/files/openai/${encodeURIComponent(openaiFileId)}`,
    { method: 'DELETE' },
    baseURL || getBaseURL()
  );
}

export function downloadFile(
  kbId: number,
  fileId: number,
  fileName: string,
  baseURL?: string
): void {
  const url = `${baseURL || getBaseURL()}/api/kb/${kbId}/files/${fileId}/download`;
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function detachProvider(
  kbId: number,
  provider: KBProviderName,
  baseURL?: string
): Promise<KnowledgeBase> {
  const data = await apiRequest<{
    success: boolean;
    knowledgeBase: KBListResponse['knowledgeBases'][0];
  }>(
    `/api/kb/${kbId}/detach`,
    {
      method: 'POST',
      body: JSON.stringify({ provider }),
    },
    baseURL || getBaseURL()
  );
  return mapKB(data.knowledgeBase);
}

export async function syncKnowledgeBase(
  kbId: number,
  targetProvider: KBProviderName,
  baseURL?: string
): Promise<{ syncedCount: number; totalFiles: number; knowledgeBase: KnowledgeBase }> {
  const data = await apiRequest<{
    success: boolean;
    syncedCount: number;
    totalFiles: number;
    knowledgeBase: KBListResponse['knowledgeBases'][0];
  }>(
    `/api/kb/${kbId}/sync`,
    {
      method: 'POST',
      body: JSON.stringify({ targetProvider }),
    },
    baseURL || getBaseURL()
  );

  return {
    syncedCount: data.syncedCount,
    totalFiles: data.totalFiles,
    knowledgeBase: mapKB(data.knowledgeBase),
  };
}

export interface ProviderFile {
  id: string;
  fileName?: string;
  displayName?: string;
  fileSize?: number;
  status?: string;
  createdAt?: number;
  createTime?: string;
  updateTime?: string;
}

export interface ProviderFilesResponse {
  provider: string;
  openai: ProviderFile[] | { error: string } | null;
  google: ProviderFile[] | { error: string } | null;
  anthropic: ProviderFile[] | { error: string } | null;
}

export async function previewFile(
  kbId: number,
  fileId: number,
  baseURL?: string
): Promise<{ content: string; source: string }> {
  return apiRequest<{ content: string; source: string }>(
    `/api/kb/${kbId}/files/${fileId}/preview`,
    { method: 'GET' },
    baseURL || getBaseURL()
  );
}

export async function previewProviderFile(
  provider: string,
  fileId: string,
  baseURL?: string
): Promise<{ content: string; source: string }> {
  return apiRequest<{ content: string; source: string }>(
    `/api/kb/provider-preview?provider=${provider}&fileId=${encodeURIComponent(fileId)}`,
    { method: 'GET' },
    baseURL || getBaseURL()
  );
}

export async function deleteProviderFile(
  kbId: number,
  provider: 'openai' | 'google' | 'anthropic',
  fileId: string,
  baseURL?: string
): Promise<void> {
  await apiRequest<{ success: boolean }>(
    `/api/kb/${kbId}/provider-files/${provider}?fileId=${encodeURIComponent(fileId)}`,
    { method: 'DELETE' },
    baseURL || getBaseURL()
  );
}

export async function getProviderFiles(
  kbId: number,
  baseURL?: string
): Promise<ProviderFilesResponse> {
  return apiRequest<ProviderFilesResponse>(
    `/api/kb/${kbId}/provider-files`,
    { method: 'GET' },
    baseURL || getBaseURL()
  );
}
