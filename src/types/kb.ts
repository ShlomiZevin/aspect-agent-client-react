export type KBProviderName = 'openai' | 'google' | 'anthropic';

export interface KnowledgeBase {
  id: number;
  name: string;
  description: string;
  agentName: string;
  providers: KBProviderName[];
  vectorStoreId?: string;       // OpenAI vector store ID
  googleCorpusId?: string;      // Google File Search Store name
  syncedFromId?: number;
  lastSyncedAt?: Date;
  fileCount: number;
  totalSize: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface KBFile {
  id: number | null;            // DB numeric ID (null for legacy files not yet in DB)
  openaiFileId?: string;        // OpenAI file ID
  googleDocumentId?: string;    // Google document name
  originalFileUrl?: string | null; // GCS path for download
  name: string;
  size: number;
  type: string;
  tags: string[];
  uploadedAt: Date;
}

export interface KBConfig {
  baseURL: string;
  chatPageUrl: string;
  logoSrc: string;
  storagePrefix: string;
  stylesFile: string;
}
