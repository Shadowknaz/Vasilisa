export interface RagDocument {
  id: string;
  title: string;
  text: string;
  source?: string;
  metadata?: Record<string, string>;
}

export interface RagChunk {
  id: string;
  documentId: string;
  title: string;
  text: string;
  index: number;
  source?: string;
  metadata?: Record<string, string>;
}

export interface RetrievedChunk extends RagChunk {
  score: number;
}

export interface RagAnswer {
  answer: string;
  citations: RetrievedChunk[];
}

export type RagChunkFilter = (chunk: RagChunk) => boolean;

export interface RagQueryOptions {
  topK?: number;
  minScore?: number;
  filter?: RagChunkFilter;
}

export interface RagConfig {
  chunkSize: number;
  chunkOverlap: number;
  embeddingDimensions: number;
  topK: number;
  minScore: number;
  bm25Weight?: number;
}

