// pgvector proof of concept — /api/kb-pgvector on the server (kb-pgvector/).
// The same KB searched in Pinecone (today's path) and in pgvector side by side.
import { apiRequest } from './api';

export interface PocInfo {
  agent: string;
  index: string;
  namespace: string;
  chunks: number;
  files: number;
  pineconeChunks: number | null;
  embeddingModel: string;
  dimensions: number;
  copiedAt: string;
  namespaces: string[];
  maxTopK: number;
}

export interface PocHit {
  rank: number;
  key: string;
  fileName: string;
  chunkIndex: number | null;
  score: number;
  text: string;
}

export interface PocSide {
  ms: number;
  results: PocHit[];
}

export interface PocSearch {
  query: string;
  topK: number;
  namespace: string;
  embeddingModel: string;
  embedMs: number;
  overlap: { same: number; of: number; sameOrder: boolean; maxScoreDiff: number };
  pinecone: PocSide;
  pgvector: PocSide;
}

const base = (agent: string) => `/api/kb-pgvector/${encodeURIComponent(agent)}`;

export const kbPgvectorService = {
  info: (agent: string) => apiRequest<PocInfo>(`${base(agent)}/info`),
  search: (agent: string, query: string, topK: number) =>
    apiRequest<PocSearch>(`${base(agent)}/search`, { method: 'POST', body: JSON.stringify({ query, topK }) }),
};
