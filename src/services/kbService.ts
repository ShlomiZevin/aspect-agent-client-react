import { apiRequest, getBaseURL } from './api';
import type { KnowledgeBase, KBFile } from '../types';

interface KBListResponse {
  knowledgeBases: Array<{
    id: number;
    name: string;
    description: string;
    agentName: string;
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
    openaiFileId: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    tags: string[];
    status: string;
    createdAt: string;
    updatedAt: string;
  }>;
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

  return data.knowledgeBases.map(kb => ({
    id: kb.id,
    name: kb.name,
    description: kb.description,
    agentName: kb.agentName,
    fileCount: kb.fileCount,
    totalSize: kb.totalSize,
    createdAt: new Date(kb.createdAt),
    updatedAt: new Date(kb.updatedAt),
  }));
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
    id: file.openaiFileId,  // Use openaiFileId for delete operations
    name: file.fileName,
    size: file.fileSize,
    type: file.fileType,
    tags: file.tags || [],
    uploadedAt: new Date(file.createdAt),
  }));
}

export async function createKnowledgeBase(
  name: string,
  description: string,
  agentName: string,
  baseURL?: string
): Promise<KnowledgeBase> {
  const data = await apiRequest<{ success: boolean; knowledgeBase: KnowledgeBase }>(
    '/api/kb/create',
    {
      method: 'POST',
      body: JSON.stringify({ name, description, agentName }),
    },
    baseURL || getBaseURL()
  );

  return data.knowledgeBase;
}

export async function uploadFiles(
  kbId: number,
  files: File[],
  tags: string[] = [],
  baseURL?: string
): Promise<void> {
  // Server expects single file uploads with field name 'file'
  // Upload files sequentially
  for (const file of files) {
    const formData = new FormData();
    formData.append('file', file);  // Server expects 'file' (singular)
    if (tags.length > 0) {
      formData.append('tags', JSON.stringify(tags));
    }

    const response = await fetch(
      `${baseURL || getBaseURL()}/api/kb/${kbId}/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Upload failed: ${response.status}`);
    }
  }
}

export async function deleteFile(
  kbId: number,
  fileId: string,
  baseURL?: string
): Promise<void> {
  await apiRequest(
    `/api/kb/${kbId}/files/${fileId}`,
    { method: 'DELETE' },
    baseURL || getBaseURL()
  );
}
