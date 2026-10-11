/**
 * Rule-based topic suggestion: scores the text being typed against words that
 * appear in each topic's past entries (and its name). Words that occur in many
 * topics count for less, like a tiny TF-IDF.
 */
const STOPWORDS = new Set(
  `a an and are as at be been but by for from had has have i in into is it its me my of on or our so
   than that the their them then there these they this to too up us was we were what when which while
   who will with you your did do does done doing get got make made new more some any all just also out
   about after again before can could should would today yesterday tomorrow work worked working`
    .split(/\s+/)
    .filter(Boolean),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

export interface TopicCorpus {
  topicId: number;
  name: string;
  texts: string[];
}

export interface TopicSuggestion {
  topicId: number;
  score: number;
}

export interface SuggestIndex {
  suggest(text: string, limit?: number): TopicSuggestion[];
}

const NAME_WEIGHT = 3;
const MIN_SCORE = 0.6;

export function buildSuggestIndex(corpora: TopicCorpus[]): SuggestIndex {
  // word -> topicId -> weight (number of entries containing it, name counts extra)
  const index = new Map<string, Map<number, number>>();
  const bump = (word: string, topicId: number, by: number) => {
    let byTopic = index.get(word);
    if (!byTopic) index.set(word, (byTopic = new Map()));
    byTopic.set(topicId, (byTopic.get(topicId) ?? 0) + by);
  };

  for (const c of corpora) {
    for (const w of new Set(tokenize(c.name))) bump(w, c.topicId, NAME_WEIGHT);
    for (const t of c.texts) for (const w of new Set(tokenize(t))) bump(w, c.topicId, 1);
  }
  const topicCount = Math.max(corpora.length, 1);

  return {
    suggest(text, limit = 1) {
      const scores = new Map<number, number>();
      for (const w of new Set(tokenize(text))) {
        // Exact word, or a known word starting with what's being typed (≥4 chars).
        const matches: Map<number, number>[] = [];
        const exact = index.get(w);
        if (exact) matches.push(exact);
        else if (w.length >= 4) {
          for (const [k, v] of index) if (k.startsWith(w)) matches.push(v);
        }
        for (const byTopic of matches) {
          const idf = Math.log(1 + topicCount / byTopic.size);
          for (const [topicId, n] of byTopic) {
            scores.set(topicId, (scores.get(topicId) ?? 0) + Math.log(1 + n) * idf);
          }
        }
      }
      return [...scores]
        .filter(([, s]) => s >= MIN_SCORE)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([topicId, score]) => ({ topicId, score }));
    },
  };
}
