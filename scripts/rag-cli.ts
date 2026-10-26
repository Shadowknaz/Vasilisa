import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { RagPipeline, InMemoryVectorStore, type RagDocument, type RagConfig, type RagChunk } from '../src/rag/index.js';


const config: Partial<RagConfig> = { chunkSize: 180, chunkOverlap: 30, topK: 5 };
const command = process.argv[2] ?? 'build';

function collect(dir: string, root = dir): RagDocument[] {
  const documents: RagDocument[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const source = join(dir, entry.name);
    if (entry.isDirectory()) {
      documents.push(...collect(source, root));
      continue;
    }
    if (entry.isFile() && (entry.name.toLowerCase().endsWith('.md') || entry.name.toLowerCase().endsWith('.ts'))) {
      const relative = source.slice(root.length + 1);
      documents.push({ id: relative, title: relative, source: relative, metadata: { type: entry.name.endsWith('.ts') ? 'source' : 'documentation' }, text: readFileSync(source, 'utf8') });
    }
  }
  return documents;
}

if (command === 'build') {
  let indexPath = resolve('.rag/index.json');
  let inputDir: string | undefined;
  for (let i = 3; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg === '--output' || arg === '-o') {
      indexPath = resolve(process.argv[++i]);
    } else if (!arg.startsWith('-')) {
      inputDir = resolve(arg);
    }
  }
  const roots = inputDir ? [inputDir] : [resolve('docs'), resolve('src')];
  const docs = roots.flatMap((root) => collect(root));
  if (!inputDir) {
    docs.push({ id: 'README.md', title: 'README', source: 'README.md', metadata: { type: 'documentation' }, text: readFileSync(resolve('README.md'), 'utf8') });
  }
  const pipeline = new RagPipeline(config);
  const chunks = pipeline.ingest(docs);
  mkdirSync(resolve(indexPath, '..'), { recursive: true });
  writeFileSync(indexPath, JSON.stringify(pipeline.store.toJSON()), 'utf8');
  console.log(`Indexed ${docs.length} documents into ${chunks} chunks: ${indexPath}`);
} else if (command === 'query') {
  let indexPath = resolve('.rag/index.json');
  let topK = 5;
  let typeFilter: string | undefined;
  const queryTokens: string[] = [];

  for (let i = 3; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg === '--index' || arg === '-i') {
      indexPath = resolve(process.argv[++i]);
    } else if (arg === '--top' || arg === '-k') {
      topK = parseInt(process.argv[++i], 10) || 5;
    } else if (arg === '--type' || arg === '-t') {
      typeFilter = process.argv[++i];
    } else if (i === 3 && arg.endsWith('.json')) {
      indexPath = resolve(arg);
    } else {
      queryTokens.push(arg);
    }
  }

  const query = queryTokens.join(' ').trim();
  if (!query) throw new Error('Usage: rag-cli query [options] <question>');

  const snapshot = JSON.parse(readFileSync(indexPath, 'utf8')) as Parameters<typeof InMemoryVectorStore.fromJSON>[0];
  const pipeline = new RagPipeline({ ...config, topK });
  pipeline.loadSnapshot(snapshot);
  const filter = typeFilter ? (chunk: RagChunk) => chunk.metadata?.type === typeFilter : undefined;
  const result = await pipeline.answer(query, { topK, filter });
  console.log(result.answer);
  for (const citation of result.citations) {
    console.log(`- ${citation.title} (${citation.source ?? citation.documentId}) [score: ${citation.score.toFixed(3)}]`);
  }
} else {
  throw new Error(`Unknown command: ${command}`);
}

