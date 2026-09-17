/**
 * Minimal File System Access API typings.
 *
 * TypeScript 5.9's `lib.dom` still does not declare these, and the
 * builder needs exactly four things: pick a directory, re-check
 * permission on a remembered handle, read a file, write a file. Declared
 * narrowly on purpose — a fuller copy of the spec would be more to keep
 * correct than we would ever use.
 *
 * Chromium-only today, which is fine: this powers one optional workflow
 * (loading drafts an AI assistant wrote on this machine), and the caller
 * feature-detects `showDirectoryPicker` before offering it.
 */

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface FileSystemWritableFileStream {
  write(data: string | BufferSource | Blob): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileHandle {
  readonly kind: 'file';
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemDirectoryHandle {
  readonly kind: 'directory';
  readonly name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface Window {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: string;
  }) => Promise<FileSystemDirectoryHandle>;
}
