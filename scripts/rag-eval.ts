import { readFile } from 'node:fs/promises';
import { RagPipeline } from '../src/rag/index.js';

type EvalCase = { id: string; query: string; mustContain: string[] };
let fixturePath = 'docs/rag-eval.json';
let indexPath: string | undefined;

for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (arg === '--index' || arg === '-i') {
    indexPath = process.argv[++i];
  } else if (!arg.startsWith('-') && i === 2) {
    fixturePath = arg;
  }
}

const cases = JSON.parse(await readFile(fixturePath, 'utf8')) as EvalCase[];
if (!Array.isArray(cases) || cases.length === 0) throw new Error(`Fixture must be a non-empty array: ${fixturePath}`);

const pipeline = new RagPipeline({ chunkSize: 180, chunkOverlap: 30, topK: 3 });
if (indexPath) {
  pipeline.loadSnapshot(JSON.parse(await readFile(indexPath, 'utf8')));
} else {
  pipeline.ingest([
    { id: 'overview', title: 'Обзор проекта', source: 'README.md', text: 'Интерактивная 3D-диорама советского двора в эстетике PlayStation 1.' },
    { id: 'controls', title: 'Управление', source: 'README.md', text: 'Движение меха и пилота выполняется клавишами WASD или стрелками.' },
    { id: 'weather', title: 'Погода', source: 'docs/WEATHER_SYSTEM.md', text: 'Снег и туман влияют на видимость и атмосферу сцены.' }
  ]);
}


const results = cases.map((item) => {
  const result = pipeline.answer(item.query);
  // answer() is async only for a custom generator; the default path is deterministic.
  return result.then((answer) => {
    const text = answer.answer.toLocaleLowerCase();
    const missing = item.mustContain.filter((term) => !text.includes(term.toLocaleLowerCase()));
    return { id: item.id, ok: missing.length === 0 && answer.citations.length > 0, citations: answer.citations.length, missing };
  });
});
const evaluated = await Promise.all(results);
const passed = evaluated.filter((item) => item.ok).length;
console.log(JSON.stringify({ fixturePath, passed, total: evaluated.length, passRate: passed / evaluated.length, results: evaluated }, null, 2));
if (passed !== evaluated.length) throw new Error(`RAG eval failed: ${passed}/${evaluated.length} cases passed`);
