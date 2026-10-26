import { cosineSimilarity, embedText, extractSearchTerms, tokenize } from './embeddings.js';
import type { RagChunk, RagChunkFilter, RagQueryOptions, RetrievedChunk } from './types.js';

export interface IndexedChunk { chunk: RagChunk; vector: number[] }

export interface VectorStoreSnapshot { dimensions: number; entries: IndexedChunk[] }

function lexicalOverlap(query: string, text: string): number {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return 0;
  const textTokens = new Set(tokenize(text));
  let matches = 0;
  for (const token of queryTokens) if (textTokens.has(token)) matches += 1;
  return matches / queryTokens.size;
}

interface CacheItem {
  terms: string[];
  tf: Map<string, number>;
}

export class InMemoryVectorStore {
  private readonly entries: IndexedChunk[] = [];
  private cache: CacheItem[] = [];
  private readonly df: Map<string, number> = new Map();
  private avgdl = 1;
  private dirty = true;

  constructor(private readonly dimensions = 256) {}

  add(chunks: RagChunk[]): void {
    for (const chunk of chunks) {
      const existing = this.entries.findIndex((entry) => entry.chunk.id === chunk.id);
      const value = { chunk, vector: embedText(chunk.text, this.dimensions) };
      if (existing >= 0) this.entries[existing] = value;
      else this.entries.push(value);
    }
    this.dirty = true;
  }

  clear(): void {
    this.entries.length = 0;
    this.cache.length = 0;
    this.df.clear();
    this.dirty = true;
  }

  get size(): number { return this.entries.length; }

  toJSON(): VectorStoreSnapshot { return { dimensions: this.dimensions, entries: this.entries }; }

  static fromJSON(snapshot: VectorStoreSnapshot): InMemoryVectorStore {
    const store = new InMemoryVectorStore(snapshot.dimensions);
    store.entries.push(...snapshot.entries);
    store.dirty = true;
    return store;
  }

  private ensureIndex(): void {
    if (!this.dirty) return;
    this.cache = this.entries.map((entry) => {
      const terms = extractSearchTerms(entry.chunk.text);
      const tf = new Map<string, number>();
      for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
      return { terms, tf };
    });
    this.df.clear();
    let totalLen = 0;
    for (const item of this.cache) {
      totalLen += item.terms.length;
      for (const term of item.tf.keys()) {
        this.df.set(term, (this.df.get(term) ?? 0) + 1);
      }
    }
    const count = Math.max(1, this.entries.length);
    this.avgdl = Math.max(1, totalLen / count);
    this.dirty = false;
  }

  search(
    query: string,
    optionsOrTopK: number | RagQueryOptions = 5,
    minScoreParam = -1,
    filterParam?: RagChunkFilter
  ): RetrievedChunk[] {
    const topK = typeof optionsOrTopK === 'object' ? (optionsOrTopK.topK ?? 5) : optionsOrTopK;
    const minScore = typeof optionsOrTopK === 'object' ? (optionsOrTopK.minScore ?? -1) : minScoreParam;
    const filter = typeof optionsOrTopK === 'object' ? optionsOrTopK.filter : filterParam;

    this.ensureIndex();
    const queryVector = embedText(query, this.dimensions);
    const queryTerms = extractSearchTerms(query);
    const N = this.entries.length;
    const k1 = 1.2;
    const b = 0.75;

    let maxBm25 = 0;
    for (const term of queryTerms) {
      const docCount = this.df.get(term) ?? 0;
      const idf = Math.log(1 + (N - docCount + 0.5) / (docCount + 0.5));
      maxBm25 += idf * (k1 + 1);
    }

    return this.entries
      .filter((entry) => !filter || filter(entry.chunk))
      .map(({ chunk, vector }, index) => {
        const semantic = cosineSimilarity(queryVector, vector);
        const lexical = lexicalOverlap(query, chunk.text);
        const item = this.cache[index];
        let bm25 = 0;
        if (item && maxBm25 > 0) {
          for (const term of queryTerms) {
            const freq = item.tf.get(term) ?? 0;
            if (freq > 0) {
              const docCount = this.df.get(term) ?? 0;
              const idf = Math.log(1 + (N - docCount + 0.5) / (docCount + 0.5));
              bm25 += idf * (freq * (k1 + 1)) / (freq + k1 * (1 - b + b * (item.terms.length / this.avgdl)));
            }
          }
        }
        const bm25Norm = maxBm25 > 0 ? bm25 / maxBm25 : 0;
        const score = semantic * 0.5 + bm25Norm * 0.35 + lexical * 0.15;
        return { ...chunk, score };
      })
      .filter((item) => item.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(0, topK));
  }
}

