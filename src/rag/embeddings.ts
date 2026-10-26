/** Small deterministic local embedding model. It is dependency-free and works offline. */
export function embedText(text: string, dimensions = 256): number[] {
  const size = Math.max(8, Math.floor(dimensions));
  const vector = new Array<number>(size).fill(0);
  const tokens = text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  for (const token of tokens) {
    let hash = 2166136261;
    for (let i = 0; i < token.length; i += 1) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const index = (hash >>> 0) % size;
    vector[index] += 1;
    const second = ((hash >>> 8) >>> 0) % size;
    vector[second] += 0.5;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return norm === 0 ? vector : vector.map((value) => value / norm);
}

export const STOP_WORDS = new Set([
  'и', 'в', 'во', 'не', 'что', 'он', 'на', 'я', 'с', 'со', 'как', 'а', 'то', 'все', 'она',
  'так', 'его', 'но', 'да', 'ты', 'к', 'у', 'же', 'вы', 'за', 'бы', 'по', 'только', 'ее',
  'мне', 'было', 'вот', 'от', 'меня', 'еще', 'нет', 'о', 'из', 'ему', 'теперь', 'когда',
  'даже', 'ли', 'если', 'уже', 'или', 'ни', 'быть', 'был', 'него', 'до', 'вас', 'ведь',
  'там', 'потом', 'себя', 'ничего', 'ей', 'может', 'они', 'тут', 'где', 'есть', 'надо',
  'ней', 'для', 'мы', 'тебя', 'их', 'чем', 'была', 'сам', 'чтоб', 'без', 'будто', 'чего',
  'раз', 'тоже', 'себе', 'под', 'будет', 'ж', 'тогда', 'кто', 'этот', 'того', 'потому',
  'этого', 'какой', 'совсем', 'ним', 'здесь', 'этом', 'один', 'мой', 'тем', 'чтобы', 'нее',
  'были', 'куда', 'зачем', 'всех', 'можно', 'при', 'два', 'об', 'другой', 'после', 'над',
  'больше', 'тот', 'через', 'эти', 'нас', 'про', 'всего', 'них', 'какая', 'много', 'три',
  'эту', 'моя', 'свою', 'этой', 'перед', 'чуть', 'том', 'нельзя', 'такой', 'им', 'более',
  'всегда', 'всю', 'между',
  'a', 'an', 'the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
  'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did',
  'but', 'if', 'then', 'so', 'that', 'this', 'these', 'those', 'it', 'its', 'into', 'no',
  'not', 'than', 'about', 'can', 'will', 'would', 'should', 'could'
]);

const RU_PERFECTIVE_GERUND = /(?:[ая](?:в|вши|вшись))|(?:(?:ив|ивши|ившись|ыв|ывши|ывшись))$/;
const RU_REFLEXIVE = /(?:ся|сь)$/;
const RU_ADJECTIVE = /(?:ее|ие|ые|ое|ими|ыми|ей|ий|ый|ой|ем|им|ым|ом|его|ого|ему|ому|их|ых|ую|юю|ая|яя|ою|ею)$/;
const RU_PARTICIPLE = /(?:[ая](?:ем|нн|вш|ющ|щ))|(?:(?:ивш|ывш|ующ))$/;
const RU_VERB = /(?:[ая](?:ла|на|ете|йте|ли|й|л|ем|н|ло|но|ет|ют|ны|ть|ешь|нно))|(?:(?:ила|ыла|ена|ейте|уйте|ите|или|ыли|ей|уй|ил|ыл|им|ым|ен|ило|ыло|ено|ят|ует|уют|ит|ыт|ены|ить|ыть|ишь|ю))$/;
const RU_NOUN = /(?:а|ев|ов|ие|ье|е|иями|ями|ами|еи|ии|и|ией|ей|ой|ий|й|иям|ям|ием|ем|ам|ом|о|у|ах|иях|ях|ы|ь|ию|ью|ю|я)$/;

export function stemWord(word: string): string {
  const lower = word.toLocaleLowerCase();
  if (lower.length <= 2) return lower;
  if (/[\u0400-\u04FF]/.test(lower)) {
    const m = lower.match(/^(.*?[аеиоуыэюя])(.*)$/);
    if (!m) return lower;
    const head = m[1];
    let tail = m[2];
    if (!tail) return lower;
    tail = tail.replace(RU_PERFECTIVE_GERUND, '');
    tail = tail.replace(RU_REFLEXIVE, '');
    const adj = tail.replace(RU_ADJECTIVE, '');
    if (adj !== tail) {
      tail = adj.replace(RU_PARTICIPLE, '');
    } else {
      const verb = tail.replace(RU_VERB, '');
      if (verb !== tail) tail = verb;
      else tail = tail.replace(RU_NOUN, '');
    }
    return head + tail;
  }
  return lower
    .replace(/(?:sses|ies)$/, 's')
    .replace(/(?:ing|edly|ed)$/, '')
    .replace(/(?:ational|tional)$/, 'tion')
    .replace(/(?:izer|ization)$/, 'ize')
    .replace(/(?:fulness|ousness)$/, 'ous')
    .replace(/(?:ment|able|ible)$/, '')
    .replace(/s$/, '');
}

export function tokenize(text: string): string[] {
  return text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

export function extractSearchTerms(text: string, filterStopWords = true): string[] {
  const tokens = tokenize(text);
  const terms: string[] = [];
  for (const token of tokens) {
    if (filterStopWords && STOP_WORDS.has(token) && tokens.length > 2) continue;
    terms.push(token);
    const stem = stemWord(token);
    if (stem !== token && stem.length >= 2) {
      terms.push(stem);
    }
  }
  return terms.length > 0 ? terms : tokens;
}

export function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  let score = 0;
  for (let i = 0; i < length; i += 1) score += left[i] * right[i];
  return score;
}

