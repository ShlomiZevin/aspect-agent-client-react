import { useState, useCallback, useEffect } from 'react';
import {
  getKnowledgeBases,
  getKBFiles,
  createKnowledgeBase as createKBApi,
  uploadFiles as uploadFilesApi,
  deleteFile as deleteFileApi,
} from '../services/kbService';
import type { KnowledgeBase, KBFile } from '../types';

export interface UseKnowledgeBaseReturn {
  knowledgeBases: KnowledgeBase[];
  selectedKB: KnowledgeBase | null;
  files: KBFile[];
  isLoading: boolean;
  isUploading: boolean;
  error: string | null;
  loadKnowledgeBases: () => Promise<void>;
  selectKnowledgeBase: (kb: KnowledgeBase | null) => Promise<void>;
  createKnowledgeBase: (name: string, description: string) => Promise<KnowledgeBase>;
  uploadFiles: (files: File[], tags?: string[]) => Promise<void>;
  deleteFile: (fileId: string) => Promise<void>;
  clearError: () => void;
}

/**
 * Hook for managing Knowledge Base operations
 */
export function useKnowledgeBase(
  agentName: string,
  baseURL?: string
): UseKnowledgeBaseReturn {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null);
  const [files, setFiles] = useState<KBFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadKnowledgeBases = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const kbs = await getKnowledgeBases(agentName, baseURL);
      setKnowledgeBases(kbs);
    } catch (err) {
      console.error('Error loading knowledge bases:', err);
      setError(err instanceof Error ? err.message : 'Failed to load knowledge bases');
    } finally {
      setIsLoading(false);
    }
  }, [agentName, baseURL]);

  // Load knowledge bases on mount
  useEffect(() => {
    loadKnowledgeBases();
  }, [loadKnowledgeBases]);

  const selectKnowledgeBase = useCallback(
    async (kb: KnowledgeBase | null) => {
      setSelectedKB(kb);

      if (!kb) {
        setFiles([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const kbFiles = await getKBFiles(kb.id, baseURL);
        setFiles(kbFiles);
      } catch (err) {
        console.error('Error loading KB files:', err);
        setError(err instanceof Error ? err.message : 'Failed to load files');
        setFiles([]);
      } finally {
        setIsLoading(false);
      }
    },
    [baseURL]
  );

  const createKnowledgeBase = useCallback(
    async (name: string, description: string): Promise<KnowledgeBase> => {
      setIsLoading(true);
      setError(null);

      try {
        const newKB = await createKBApi(name, description, agentName, baseURL);
        setKnowledgeBases(prev => [...prev, newKB]);
        return newKB;
      } catch (err) {
        console.error('Error creating knowledge base:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to create knowledge base';
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [agentName, baseURL]
  );

  const uploadFiles = useCallback(
    async (filesToUpload: File[], tags: string[] = []) => {
      if (!selectedKB) {
        setError('No knowledge base selected');
        return;
      }

      setIsUploading(true);
      setError(null);

      try {
        await uploadFilesApi(selectedKB.id, filesToUpload, tags, baseURL);
        // Reload files after upload
        const kbFiles = await getKBFiles(selectedKB.id, baseURL);
        setFiles(kbFiles);
        // Update KB in list
        await loadKnowledgeBases();
      } catch (err) {
        console.error('Error uploading files:', err);
        setError(err instanceof Error ? err.message : 'Failed to upload files');
      } finally {
        setIsUploading(false);
      }
    },
    [selectedKB, baseURL, loadKnowledgeBases]
  );

  const deleteFile = useCallback(
    async (fileId: string) => {
      if (!selectedKB) {
        setError('No knowledge base selected');
        return;
      }

      try {
        await deleteFileApi(selectedKB.id, fileId, baseURL);
        setFiles(prev => prev.filter(f => f.id !== fileId));
        // Update KB in list
        await loadKnowledgeBases();
      } catch (err) {
        console.error('Error deleting file:', err);
        setError(err instanceof Error ? err.message : 'Failed to delete file');
      }
    },
    [selectedKB, baseURL, loadKnowledgeBases]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    knowledgeBases,
    selectedKB,
    files,
    isLoading,
    isUploading,
    error,
    loadKnowledgeBases,
    selectKnowledgeBase,
    createKnowledgeBase,
    uploadFiles,
    deleteFile,
    clearError,
  };
}
