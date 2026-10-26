import { RagPipeline } from '../src/rag/index.js';

const pipeline = new RagPipeline({ chunkSize: 40, chunkOverlap: 8, topK: 2 });
const count = pipeline.ingest([
  { id: 'weather', title: 'Погода', text: 'Снег и туман влияют на видимость. Плотность снега меняется по времени.' },
  { id: 'player', title: 'Игрок', text: 'Игрок может исследовать двор, войти в кабину и управлять мехом.' }
]);
if (count < 2) throw new Error(`Expected at least two chunks, got ${count}`);
const hits = pipeline.retrieve('как снег влияет на видимость');
if (hits.length === 0 || !hits[0].text.includes('видимость')) throw new Error('Retrieval check failed');
const result = await pipeline.answer('что делает игрок');
if (!result.answer.includes('Игрок')) throw new Error('Answer check failed');
console.log(`RAG check passed: ${count} chunks, top score ${hits[0].score.toFixed(3)}`);
