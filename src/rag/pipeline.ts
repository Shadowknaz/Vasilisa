import { chunkDocuments } from './chunk.js';
import { InMemoryVectorStore } from './vectorStore.js';
import type { RagAnswer, RagConfig, RagDocument, RagQueryOptions, RetrievedChunk } from './types.js';


export const DEFAULT_RAG_CONFIG: RagConfig = {
  chunkSize: 180,
  chunkOverlap: 30,
  embeddingDimensions: 256,
  topK: 4,
  minScore: 0.05
};

export type AnswerGenerator = (query: string, context: RetrievedChunk[]) => string | Promise<string>;

export interface RagAnswerOptions extends RagQueryOptions {
  generator?: AnswerGenerator;
}

export class RagPipeline {
  store: InMemoryVectorStore;
  private readonly config: RagConfig;
  constructor(config: Partial<RagConfig> = {}) {
    this.config = { ...DEFAULT_RAG_CONFIG, ...config };
    this.store = new InMemoryVectorStore(this.config.embeddingDimensions);
  }

  ingest(documents: RagDocument[]): number {
    const chunks = chunkDocuments(documents, this.config);
    this.store.add(chunks);
    return chunks.length;
  }

  loadSnapshot(snapshot: Parameters<typeof InMemoryVectorStore.fromJSON>[0]): void {
    this.store = InMemoryVectorStore.fromJSON(snapshot);
  }

  retrieve(query: string, optionsOrTopK: number | RagQueryOptions = this.config.topK): RetrievedChunk[] {
    if (typeof optionsOrTopK === 'object') {
      const topK = optionsOrTopK.topK ?? this.config.topK;
      const minScore = optionsOrTopK.minScore ?? this.config.minScore;
      return this.store.search(query, topK, minScore, optionsOrTopK.filter);
    }
    return this.store.search(query, optionsOrTopK, this.config.minScore);
  }

  async answer(query: string, generatorOrOptions?: AnswerGenerator | RagAnswerOptions): Promise<RagAnswer> {
    const isOptions = typeof generatorOrOptions === 'object' && generatorOrOptions !== null;
    const generator = typeof generatorOrOptions === 'function' ? generatorOrOptions : isOptions ? generatorOrOptions.generator : undefined;
    const citations = isOptions ? this.retrieve(query, generatorOrOptions) : this.retrieve(query);

    if (generator) return { answer: await generator(query, citations), citations };
    if (citations.length === 0) return { answer: 'В базе знаний не найдено подходящих сведений.', citations };
    const excerpts = citations.map((item, index) => `[${index + 1}] ${item.text}`).join('\n');
    return {
      answer: `Найдены следующие сведения:\n${excerpts}`,
      citations
    };
  }
}

