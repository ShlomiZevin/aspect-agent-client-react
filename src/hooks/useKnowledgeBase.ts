import { useState, useCallback, useEffect } from 'react';
import {
  getKnowledgeBases,
  getKBFiles,
  createKnowledgeBase as createKBApi,
  uploadFiles as uploadFilesApi,
  deleteFile as deleteFileApi,
  deleteFileLegacy as deleteFileLegacyApi,
  syncKnowledgeBase as syncKBApi,
  detachProvider as detachProviderApi,
} from '../services/kbService';
import type { FileUploadProgress } from '../services/kbService';
import type { KnowledgeBase, KBFile, KBProvider } from '../types';

export type { FileUploadProgress };

export interface UseKnowledgeBaseReturn {
  knowledgeBases: KnowledgeBase[];
  selectedKB: KnowledgeBase | null;
  files: KBFile[];
  isLoading: boolean;
  isUploading: boolean;
  isSyncing: boolean;
  uploadProgress: FileUploadProgress[] | null;
  error: string | null;
  loadKnowledgeBases: () => Promise<void>;
  selectKnowledgeBase: (kb: KnowledgeBase | null) => Promise<void>;
  createKnowledgeBase: (name: string, description: string, provider: KBProvider) => Promise<KnowledgeBase>;
  uploadFiles: (files: File[], tags?: string[]) => Promise<void>;
  deleteFile: (file: KBFile) => Promise<void>;
  syncKnowledgeBase: (kbId: number, targetProvider: KBProvider) => Promise<void>;
  detachProvider: (kbId: number, provider: KBProvider) => Promise<void>;
  clearError: () => void;
}

export function useKnowledgeBase(
  agentName: string,
  baseURL?: string
): UseKnowledgeBaseReturn {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null);
  const [files, setFiles] = useState<KBFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<FileUploadProgress[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadKnowledgeBases = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const kbs = await getKnowledgeBases(agentName, baseURL);
      setKnowledgeBases(kbs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge bases');
    } finally {
      setIsLoading(false);
    }
  }, [agentName, baseURL]);

  useEffect(() => {
    loadKnowledgeBases();
  }, [loadKnowledgeBases]);

  const selectKnowledgeBase = useCallback(
    async (kb: KnowledgeBase | null) => {
      setSelectedKB(kb);
      setFiles([]);
      if (!kb) return;

      setIsLoading(true);
      setError(null);
      try {
        const kbFiles = await getKBFiles(kb.id, baseURL);
        setFiles(kbFiles);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load files');
        setFiles([]);
      } finally {
        setIsLoading(false);
      }
    },
    [baseURL]
  );

  const createKnowledgeBase = useCallback(
    async (name: string, description: string, provider: KBProvider): Promise<KnowledgeBase> => {
      setIsLoading(true);
      setError(null);
      try {
        const newKB = await createKBApi(name, description, agentName, provider, baseURL);
        setKnowledgeBases(prev => [newKB, ...prev]);
        return newKB;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create knowledge base';
        setError(msg);
        throw new Error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [agentName, baseURL]
  );

  const uploadFiles = useCallback(
    async (filesToUpload: File[], tags: string[] = []) => {
      if (!selectedKB) { setError('No knowledge base selected'); return; }

      setIsUploading(true);
      setError(null);
      setUploadProgress(filesToUpload.map(f => ({ name: f.name, status: 'pending' as const })));
      try {
        await uploadFilesApi(
          selectedKB.id,
          filesToUpload,
          tags,
          (progress) => setUploadProgress([...progress]),
          baseURL
        );
        const kbFiles = await getKBFiles(selectedKB.id, baseURL);
        setFiles(kbFiles);
        await loadKnowledgeBases();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to upload files');
      } finally {
        setIsUploading(false);
        setUploadProgress(null);
      }
    },
    [selectedKB, baseURL, loadKnowledgeBases]
  );

  const deleteFile = useCallback(
    async (file: KBFile) => {
      if (!selectedKB) { setError('No knowledge base selected'); return; }

      try {
        if (file.id !== null) {
          await deleteFileApi(selectedKB.id, file.id, baseURL);
          setFiles(prev => prev.filter(f => f.id !== file.id));
        } else if (file.openaiFileId) {
          await deleteFileLegacyApi(selectedKB.id, file.openaiFileId, baseURL);
          setFiles(prev => prev.filter(f => f.openaiFileId !== file.openaiFileId));
        }
        await loadKnowledgeBases();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete file');
      }
    },
    [selectedKB, baseURL, loadKnowledgeBases]
  );

  const syncKnowledgeBase = useCallback(
    async (kbId: number, targetProvider: KBProvider) => {
      setIsSyncing(true);
      setError(null);
      try {
        const result = await syncKBApi(kbId, targetProvider, baseURL);
        // Update the KB in the list with the new provider info
        setKnowledgeBases(prev =>
          prev.map(kb => kb.id === kbId ? result.knowledgeBase : kb)
        );
        // If synced KB is the selected one, update it too
        if (selectedKB?.id === kbId) {
          setSelectedKB(result.knowledgeBase);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to sync knowledge base';
        setError(msg);
        throw new Error(msg);
      } finally {
        setIsSyncing(false);
      }
    },
    [baseURL, selectedKB]
  );

  const detachProvider = useCallback(
    async (kbId: number, provider: KBProvider) => {
      setIsSyncing(true);
      setError(null);
      try {
        const updatedKB = await detachProviderApi(kbId, provider, baseURL);
        setKnowledgeBases(prev =>
          prev.map(kb => kb.id === kbId ? updatedKB : kb)
        );
        if (selectedKB?.id === kbId) {
          setSelectedKB(updatedKB);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to detach provider';
        setError(msg);
        throw new Error(msg);
      } finally {
        setIsSyncing(false);
      }
    },
    [baseURL, selectedKB]
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    knowledgeBases,
    selectedKB,
    files,
    isLoading,
    isUploading,
    isSyncing,
    uploadProgress,
    error,
    loadKnowledgeBases,
    selectKnowledgeBase,
    createKnowledgeBase,
    uploadFiles,
    deleteFile,
    syncKnowledgeBase,
    detachProvider,
    clearError,
  };
}
