import type { RagChunk, RagConfig, RagDocument } from './types.js';

function cleanText(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

/** Split documents into overlapping, word-aware chunks suitable for retrieval. */
export function chunkDocument(document: RagDocument, config: Pick<RagConfig, 'chunkSize' | 'chunkOverlap'>): RagChunk[] {
  const text = cleanText(document.text);
  if (!text) return [];
  const size = Math.max(32, Math.floor(config.chunkSize));
  const overlap = Math.max(0, Math.min(size - 1, Math.floor(config.chunkOverlap)));
  const words = text.split(/\s+/);
  const chunks: RagChunk[] = [];
  let start = 0;
  let index = 0;
  while (start < words.length) {
    const end = Math.min(words.length, start + size);
    chunks.push({
      id: `${document.id}:${index}`,
      documentId: document.id,
      title: document.title,
      text: words.slice(start, end).join(' '),
      index,
      source: document.source,
      metadata: document.metadata
    });
    if (end === words.length) break;
    start = end - overlap;
    index += 1;
  }
  return chunks;
}

export function chunkDocuments(documents: RagDocument[], config: Pick<RagConfig, 'chunkSize' | 'chunkOverlap'>): RagChunk[] {
  return documents.flatMap((document) => chunkDocument(document, config));
}
