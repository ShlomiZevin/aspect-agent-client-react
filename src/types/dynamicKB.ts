export interface DynamicFile {
  id: number;
  agentId: number;
  name: string;
  fileType: 'text' | 'table';
  fileSize: number;
  attachmentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DynamicFileAttachment {
  id: number;
  kbId: number;
  kbName: string;
  kbProvider: string;
}

export interface TableData {
  headers: string[];
  rows: string[][];
}
