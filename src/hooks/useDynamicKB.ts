import { useState, useEffect, useCallback, useRef } from 'react';
import * as dynamicKBService from '../services/dynamicKBService';
import type { DynamicFile, DynamicFileAttachment, TableData } from '../types/dynamicKB';

export function useDynamicKB(agentName: string) {
  const [files, setFiles] = useState<DynamicFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<DynamicFile | null>(null);
  const [content, setContent] = useState<string | TableData>('');
  const [savedContent, setSavedContent] = useState<string | TableData>('');
  const [attachments, setAttachments] = useState<DynamicFileAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedFileRef = useRef<DynamicFile | null>(null);

  const isDirty = JSON.stringify(content) !== JSON.stringify(savedContent);

  const loadFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await dynamicKBService.getFiles(agentName);
      setFiles(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setIsLoading(false);
    }
  }, [agentName]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const selectFile = useCallback(async (file: DynamicFile | null) => {
    if (!file) {
      setSelectedFile(null);
      selectedFileRef.current = null;
      setContent('');
      setSavedContent('');
      setAttachments([]);
      return;
    }

    try {
      setIsLoading(true);
      setSelectedFile(file);
      selectedFileRef.current = file;
      setError(null);

      const [loadedContent, loadedAttachments] = await Promise.all([
        dynamicKBService.loadContent(file.id),
        dynamicKBService.getAttachments(file.id),
      ]);

      // Only update if still the selected file
      if (selectedFileRef.current?.id === file.id) {
        setContent(loadedContent);
        setSavedContent(loadedContent);
        setAttachments(loadedAttachments);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load file');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createFile = useCallback(async (name: string, fileType: 'text' | 'table') => {
    try {
      setError(null);
      const file = await dynamicKBService.createFile(agentName, name, fileType);
      await loadFiles();
      return file;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create file');
      throw err;
    }
  }, [agentName, loadFiles]);

  const updateFileName = useCallback(async (fileId: number, name: string) => {
    try {
      setError(null);
      await dynamicKBService.updateFile(fileId, { name });
      await loadFiles();
      if (selectedFile?.id === fileId) {
        setSelectedFile(prev => prev ? { ...prev, name } : null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to rename file');
    }
  }, [loadFiles, selectedFile]);

  const deleteFile = useCallback(async (fileId: number) => {
    try {
      setError(null);
      await dynamicKBService.deleteFile(fileId);
      if (selectedFile?.id === fileId) {
        setSelectedFile(null);
        selectedFileRef.current = null;
        setContent('');
        setSavedContent('');
        setAttachments([]);
      }
      await loadFiles();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
    }
  }, [loadFiles, selectedFile]);

  const saveContent = useCallback(async () => {
    if (!selectedFile) return null;
    try {
      setIsSaving(true);
      setError(null);
      const result = await dynamicKBService.saveContent(selectedFile.id, content);
      setSavedContent(content);
      await loadFiles();
      return result;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [selectedFile, content, loadFiles]);

  const importFromDoc = useCallback(async (file: File) => {
    try {
      setError(null);
      const result = await dynamicKBService.importDoc(file);
      setContent(result.text);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to import document');
    }
  }, []);

  const importFromSpreadsheet = useCallback(async (file: File) => {
    try {
      setError(null);
      const result = await dynamicKBService.importSpreadsheet(file);
      setContent({ headers: result.headers, rows: result.rows });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to import spreadsheet');
    }
  }, []);

  const attachToKB = useCallback(async (kbId: number) => {
    if (!selectedFile) return;
    try {
      setError(null);
      await dynamicKBService.attachToKB(selectedFile.id, kbId);
      const updated = await dynamicKBService.getAttachments(selectedFile.id);
      setAttachments(updated);
      await loadFiles();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to attach');
      throw err;
    }
  }, [selectedFile, loadFiles]);

  const detachFromKB = useCallback(async (kbId: number) => {
    if (!selectedFile) return;
    try {
      setError(null);
      await dynamicKBService.detachFromKB(selectedFile.id, kbId);
      const updated = await dynamicKBService.getAttachments(selectedFile.id);
      setAttachments(updated);
      await loadFiles();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to detach');
    }
  }, [selectedFile, loadFiles]);

  return {
    files,
    selectedFile,
    content,
    setContent,
    savedContent,
    attachments,
    isLoading,
    isSaving,
    isDirty,
    error,
    loadFiles,
    selectFile,
    createFile,
    updateFileName,
    deleteFile,
    saveContent,
    importFromDoc,
    importFromSpreadsheet,
    attachToKB,
    detachFromKB,
    clearError: () => setError(null),
  };
}
