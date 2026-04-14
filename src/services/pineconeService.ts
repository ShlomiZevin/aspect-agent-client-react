/**
 * Pinecone KB Service - Client API
 *
 * Isolated service for the Pinecone admin page.
 * Talks to /api/pinecone/* endpoints.
 */

import { getBaseURL } from './api';

// ─── Connection & Index Types ────────────────────────────────────────────────

export interface ConnectionStatus {
  configured: boolean;
  hasApiKey: boolean;
  indexName: string | null;
}

export interface PineconeIndex {
  name: string;
  dimension: number;
  metric: string;
  host: string;
  status: string;
  cloud: string;
  region: string;
}

export interface IndexListResponse {
  indexes: PineconeIndex[];
  activeIndex: string | null;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChunkData {
  text: string;
  chunkIndex: number;
  charStart: number;
  charEnd: number;
  estimatedTokens?: number;
}

export interface ChunkPreviewResult {
  fileName: string;
  fileSize: number;
  extractedText: string;
  pages?: number;
  chunks: ChunkData[];
  stats: {
    totalChunks: number;
    avgChunkLength: number;
    totalCharacters: number;
  };
  settings: {
    chunkSize: number;
    chunkOverlap: number;
  };
}

export interface EmbeddingPreviewResult {
  fileName: string;
  chunks: (ChunkData & { estimatedTokens: number })[];
  stats: {
    totalChunks: number;
    avgChunkLength: number;
    totalCharacters: number;
    estimatedTokens: number;
    estimatedCost: number;
    embeddingModel: string;
    embeddingDimensions: number;
  };
}

export interface IndexFileResult {
  success: boolean;
  fileId: number;
  fileName: string;
  namespace: string;
  vectorCount: number;
  embeddingTokens: number;
  embeddingCost: number;
}

export interface BulkIndexResult {
  totalFiles: number;
  successCount: number;
  failedCount: number;
  totalVectors: number;
  totalEmbeddingCost: number;
  results: Array<{
    fileName: string;
    fileId?: number;
    vectorCount?: number;
    embeddingTokens?: number;
    status: 'success' | 'failed';
    error?: string;
  }>;
  failedFiles: Array<{ fileName: string; error: string }>;
}

export interface PineconeNamespace {
  name: string;
  vectorCount: number;
}

export interface IndexStats {
  totalVectorCount: number;
  dimension: number;
  namespaces: PineconeNamespace[];
}

export interface VectorData {
  id: string;
  metadata: {
    kbId: number;
    fileId: number;
    fileName: string;
    fileType: string;
    chunkIndex: number;
    totalChunks: number;
    agentId: number;
    text: string;
  };
  score: number;
}

export interface QueryResult {
  text: string;
  score: number;
  fileName: string;
  chunkIndex: number;
  fileId: number;
  kbId: number;
  fileType: string;
}

export interface QueryResponse {
  results: QueryResult[];
  queryTimeMs: number;
  totalResults: number;
  tokensUsed: number;
  formattedPrompt: string;
}

// ─── API Functions ───────────────────────────────────────────────────────────

const BASE = () => getBaseURL();

export async function previewChunks(
  file: File,
  chunkSize: number = 1000,
  chunkOverlap: number = 200
): Promise<ChunkPreviewResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('chunkSize', String(chunkSize));
  formData.append('chunkOverlap', String(chunkOverlap));

  const response = await fetch(`${BASE()}/api/pinecone/preview-chunks`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Preview failed: ${response.status}`);
  }
  return response.json();
}

export async function previewEmbeddings(
  file: File,
  chunkSize: number = 1000,
  chunkOverlap: number = 200
): Promise<EmbeddingPreviewResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('chunkSize', String(chunkSize));
  formData.append('chunkOverlap', String(chunkOverlap));

  const response = await fetch(`${BASE()}/api/pinecone/preview-embeddings`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Embedding preview failed: ${response.status}`);
  }
  return response.json();
}

export async function indexFile(
  file: File,
  kbId: number,
  agentId: number = 0,
  chunkSize: number = 1000,
  chunkOverlap: number = 200
): Promise<IndexFileResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('kbId', String(kbId));
  formData.append('agentId', String(agentId));
  formData.append('chunkSize', String(chunkSize));
  formData.append('chunkOverlap', String(chunkOverlap));

  const response = await fetch(`${BASE()}/api/pinecone/index-file`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Index failed: ${response.status}`);
  }
  return response.json();
}

export async function indexBulk(
  files: File[],
  namespace: string,
  agentId: number = 0,
  chunkSize: number = 1000,
  chunkOverlap: number = 200,
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<BulkIndexResult> {
  // For very large uploads, batch them in groups of 20 to avoid timeout
  const BATCH_SIZE = 20;
  const allResults: BulkIndexResult['results'] = [];
  let totalVectors = 0;
  let totalCost = 0;
  let successCount = 0;
  let failedCount = 0;
  const failedFiles: BulkIndexResult['failedFiles'] = [];

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const formData = new FormData();
    for (const file of batch) {
      formData.append('files', file);
    }
    formData.append('namespace', namespace);
    formData.append('agentId', String(agentId));
    formData.append('chunkSize', String(chunkSize));
    formData.append('chunkOverlap', String(chunkOverlap));

    if (onProgress) {
      onProgress(i, files.length, batch[0].name);
    }

    const response = await fetch(`${BASE()}/api/pinecone/index-bulk`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      // Mark all files in batch as failed
      for (const file of batch) {
        allResults.push({ fileName: file.name, status: 'failed', error: err.error || 'Batch failed' });
        failedFiles.push({ fileName: file.name, error: err.error || 'Batch failed' });
        failedCount++;
      }
      continue;
    }

    const batchResult: BulkIndexResult = await response.json();
    allResults.push(...batchResult.results);
    totalVectors += batchResult.totalVectors;
    totalCost += batchResult.totalEmbeddingCost;
    successCount += batchResult.successCount;
    failedCount += batchResult.failedCount;
    failedFiles.push(...batchResult.failedFiles);
  }

  if (onProgress) {
    onProgress(files.length, files.length, 'Done');
  }

  return {
    totalFiles: files.length,
    successCount,
    failedCount,
    totalVectors,
    totalEmbeddingCost: totalCost,
    results: allResults,
    failedFiles,
  };
}

export async function getIndexStats(): Promise<IndexStats> {
  const response = await fetch(`${BASE()}/api/pinecone/stats`);
  if (!response.ok) throw new Error(`Stats failed: ${response.status}`);
  return response.json();
}

export async function listVectors(
  namespace: string,
  fileId?: number,
  limit: number = 100
): Promise<{ namespace: string; vectors: VectorData[]; count: number }> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (fileId !== undefined) params.set('fileId', String(fileId));

  const response = await fetch(`${BASE()}/api/pinecone/namespace/${encodeURIComponent(namespace)}/vectors?${params}`);
  if (!response.ok) throw new Error(`List vectors failed: ${response.status}`);
  return response.json();
}

export async function deleteFileVectors(kbId: number, fileId: number): Promise<void> {
  const response = await fetch(`${BASE()}/api/pinecone/file/${kbId}/${fileId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
}

export async function deleteNamespace(kbId: number): Promise<void> {
  const response = await fetch(`${BASE()}/api/pinecone/namespace/${kbId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(`Delete namespace failed: ${response.status}`);
}

export async function queryPinecone(
  namespaces: string[],
  query: string,
  topK: number = 5,
  scoreThreshold: number = 0.3,
  maxTokens: number = 3000
): Promise<QueryResponse> {
  const response = await fetch(`${BASE()}/api/pinecone/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ namespaces, query, topK, scoreThreshold, maxTokens }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Query failed: ${response.status}`);
  }
  return response.json();
}

// ─── Index Management ────────────────────────────────────────────────────────

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  const response = await fetch(`${BASE()}/api/pinecone/status`);
  if (!response.ok) throw new Error(`Status check failed: ${response.status}`);
  return response.json();
}

export async function listPineconeIndexes(): Promise<IndexListResponse> {
  const response = await fetch(`${BASE()}/api/pinecone/indexes`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `List indexes failed: ${response.status}`);
  }
  return response.json();
}

export async function createPineconeIndex(
  name: string,
  dimension: number = 1536,
  metric: string = 'cosine',
  cloud: string = 'aws',
  region: string = 'us-east-1'
): Promise<void> {
  const response = await fetch(`${BASE()}/api/pinecone/indexes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, dimension, metric, cloud, region }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Create index failed: ${response.status}`);
  }
}

export async function deletePineconeIndex(name: string): Promise<void> {
  const response = await fetch(`${BASE()}/api/pinecone/indexes/${name}`, { method: 'DELETE' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Delete index failed: ${response.status}`);
  }
}

export async function activatePineconeIndex(name: string): Promise<void> {
  const response = await fetch(`${BASE()}/api/pinecone/indexes/${name}/activate`, { method: 'POST' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Activate index failed: ${response.status}`);
  }
}

// ─── Library Files (DB-tracked) ──────────────────────────────────────────────

export interface LibraryFile {
  id: number;
  indexName: string;
  namespace: string;
  fileId: string;
  fileName: string;
  fileSize: number | null;
  fileType: string | null;
  chunkCount: number;
  embeddingTokens: number;
  embeddingCost: number;
  status: string;
  createdAt: string;
}

export async function getLibraryFiles(
  namespace: string,
  indexName?: string
): Promise<{ files: LibraryFile[]; source: string }> {
  const params = new URLSearchParams({ namespace });
  if (indexName) params.set('indexName', indexName);
  const response = await fetch(`${BASE()}/api/library/files?${params}`);
  if (!response.ok) throw new Error(`List files failed: ${response.status}`);
  return response.json();
}

export async function deleteLibraryFile(id: number): Promise<void> {
  const response = await fetch(`${BASE()}/api/library/files/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Delete failed: ${response.status}`);
  }
}
