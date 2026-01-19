export interface KnowledgeBase {
  id: number;
  name: string;
  description: string;
  agentName: string;
  fileCount: number;
  totalSize: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface KBFile {
  id: string;
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
