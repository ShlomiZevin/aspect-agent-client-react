import { useState, useCallback } from 'react';
import type { DynamicFile, DynamicFileAttachment, TableData, SyncResult } from '../types';
import * as dynamicKBService from '../services/dynamicKBService';

export function useDynamicKB(agentName: string, baseURL?: string) {
  const [files, setFiles] = useState<DynamicFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<DynamicFile | null>(null);
  const [content, setContent] = useState<string | TableData>('');
  const [attachments, setAttachments] = useState<DynamicFileAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const loadFiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await dynamicKBService.getFiles(agentName, baseURL);
      setFiles(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [agentName, baseURL]);

  const selectFile = useCallback(async (file: DynamicFile) => {
    setSelectedFile(file);
    setIsDirty(false);
    setError(null);
    setContent(file.fileType === 'table' ? { headers: [], rows: [] } : '');
    setAttachments([]);
    try {
      const [fileContent, fileAttachments] = await Promise.all([
        dynamicKBService.loadContent(file.id, baseURL),
        dynamicKBService.getAttachments(file.id, baseURL),
      ]);
      setContent(fileContent);
      setAttachments(fileAttachments);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [baseURL]);

  const createFile = useCallback(async (name: string, fileType: 'text' | 'table') => {
    setError(null);
    try {
      const file = await dynamicKBService.createFile(agentName, name, fileType, baseURL);
      setFiles(prev => [file, ...prev]);
      return file;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, [agentName, baseURL]);

  const updateFileName = useCallback(async (fileId: number, name: string) => {
    setError(null);
    try {
      const updated = await dynamicKBService.updateFile(fileId, { name }, baseURL);
      setFiles(prev => prev.map(f => f.id === fileId ? updated : f));
      if (selectedFile?.id === fileId) setSelectedFile(updated);
      return updated;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, [baseURL, selectedFile]);

  const deleteFile = useCallback(async (fileId: number) => {
    setError(null);
    try {
      await dynamicKBService.deleteFile(fileId, baseURL);
      setFiles(prev => prev.filter(f => f.id !== fileId));
      if (selectedFile?.id === fileId) {
        setSelectedFile(null);
        setContent('');
        setAttachments([]);
        setIsDirty(false);
      }
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, [baseURL, selectedFile]);

  const saveContent = useCallback(async (
    newContent: string | TableData
  ): Promise<SyncResult | null> => {
    if (!selectedFile) return null;
    setIsSaving(true);
    setError(null);
    try {
      const result = await dynamicKBService.saveContent(
        selectedFile.id,
        newContent,
        selectedFile.fileType,
        baseURL
      );
      setContent(newContent);
      setIsDirty(false);
      // Update file size & updatedAt in list
      setFiles(prev => prev.map(f =>
        f.id === selectedFile.id ? { ...f, updatedAt: new Date() } : f
      ));
      return result;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [selectedFile, baseURL]);

  const updateContent = useCallback((newContent: string | TableData) => {
    setContent(newContent);
    setIsDirty(true);
  }, []);

  const importFromDoc = useCallback(async (file: File) => {
    setError(null);
    try {
      const { text } = await dynamicKBService.importDoc(file, baseURL);
      setContent(text);
      setIsDirty(true);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, [baseURL]);

  const importFromSpreadsheet = useCallback(async (file: File) => {
    setError(null);
    try {
      const tableData = await dynamicKBService.importSpreadsheet(file, baseURL);
      setContent(tableData);
      setIsDirty(true);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, [baseURL]);

  const attachToKB = useCallback(async (kbId: number) => {
    if (!selectedFile) return;
    setError(null);
    try {
      await dynamicKBService.attachToKB(selectedFile.id, kbId, baseURL);
      const updated = await dynamicKBService.getAttachments(selectedFile.id, baseURL);
      setAttachments(updated);
      setFiles(prev => prev.map(f =>
        f.id === selectedFile.id ? { ...f, attachmentCount: updated.length } : f
      ));
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, [selectedFile, baseURL]);

  const detachFromKB = useCallback(async (kbId: number) => {
    if (!selectedFile) return;
    setError(null);
    try {
      await dynamicKBService.detachFromKB(selectedFile.id, kbId, baseURL);
      const updated = await dynamicKBService.getAttachments(selectedFile.id, baseURL);
      setAttachments(updated);
      setFiles(prev => prev.map(f =>
        f.id === selectedFile.id ? { ...f, attachmentCount: updated.length } : f
      ));
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, [selectedFile, baseURL]);

  return {
    files,
    selectedFile,
    content,
    attachments,
    isLoading,
    isSaving,
    isDirty,
    error,
    clearError,
    loadFiles,
    selectFile,
    createFile,
    updateFileName,
    deleteFile,
    saveContent,
    updateContent,
    importFromDoc,
    importFromSpreadsheet,
    attachToKB,
    detachFromKB,
  };
}
