/** Small in-house scorer (spec §7): no regex on user input, so any character is literal. */

export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const WORD_SPLIT = /[\s\-_/.:?=&#|,;]+/;

function isSubsequence(query: string, word: string): boolean {
  let i = 0;
  for (const ch of word) if (ch === query[i]) i++;
  return i === query.length;
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/**
 * Higher is better; null = no match.
 * exact 100 > prefix 90 > word prefix 80 > substring 60 > in-word subsequence 40 > one typo 20.
 */
export function fuzzyScore(query: string, text: string): number | null {
  const q = normalize(query);
  const t = normalize(text);
  if (!q || !t) return null;
  if (t === q) return 100;
  if (t.startsWith(q)) return 90;
  const words = t.split(WORD_SPLIT).filter(Boolean);
  if (words.some((w) => w.startsWith(q))) return 80;
  if (t.includes(q)) return 60;
  if (q.length >= 3 && words.some((w) => w.length >= q.length && isSubsequence(q, w))) return 40;
  if (q.length >= 4 && words.some((w) => editDistanceAtMostOne(q, w) || editDistanceAtMostOne(q, w.slice(0, q.length)))) {
    return 20;
  }
  return null;
}

export type MatchRange = [start: number, end: number];

const SEPARATOR = /[\s\-_/.:?=&#|,;]/;
const COMBINING = /[\u0300-\u036f]/g;

/** Normalised text plus, for each normalised code unit, the original [start, end) it came from. */
function normalizeWithMap(text: string): { norm: string; from: MatchRange[] } {
  let norm = '';
  const from: MatchRange[] = [];
  let i = 0;
  for (const ch of text) {
    const n = ch.normalize('NFD').replace(COMBINING, '').toLowerCase();
    for (let k = 0; k < n.length; k++) from.push([i, i + ch.length]);
    norm += n;
    i += ch.length;
  }
  return { norm, from };
}

function findWordPrefix(norm: string, q: string): number {
  for (let i = 0; i <= norm.length - q.length; i++) {
    if ((i === 0 || SEPARATOR.test(norm[i - 1])) && norm.startsWith(q, i)) return i;
  }
  return -1;
}

/** Normalised indexes of q's letters inside one word, or null when the word does not contain q in order. */
function subsequenceIn(norm: string, q: string): number[] | null {
  let start = 0;
  while (start < norm.length) {
    while (start < norm.length && SEPARATOR.test(norm[start])) start++;
    let end = start;
    while (end < norm.length && !SEPARATOR.test(norm[end])) end++;
    if (end - start >= q.length) {
      const hits: number[] = [];
      for (let i = start; i < end && hits.length < q.length; i++) if (norm[i] === q[hits.length]) hits.push(i);
      if (hits.length === q.length) return hits;
    }
    start = end;
  }
  return null;
}

/**
 * Which letters of `text` a query matched, as half-open ranges in the original text, following the same
 * tiers as fuzzyScore. A one-typo match marks nothing, since no letters line up.
 */
export function matchRanges(query: string, text: string): MatchRange[] {
  const score = fuzzyScore(query, text);
  if (score === null || score <= 20) return [];
  const q = normalize(query);
  const { norm, from } = normalizeWithMap(text);
  const toOriginal = (a: number, b: number): MatchRange => [from[a][0], from[b - 1][1]];

  const lead = norm.length - norm.trimStart().length;
  if (norm.startsWith(q, lead)) return [toOriginal(lead, lead + q.length)];
  const word = findWordPrefix(norm, q);
  if (word >= 0) return [toOriginal(word, word + q.length)];
  const sub = norm.indexOf(q);
  if (sub >= 0) return [toOriginal(sub, sub + q.length)];
  const hits = subsequenceIn(norm, q);
  return hits ? hits.map((h) => toOriginal(h, h + 1)) : [];
}

export interface TextSegment {
  text: string;
  hit: boolean;
}

/** Splits text into plain and matched segments; adjacent or overlapping ranges merge. */
export function splitByRanges(text: string, ranges: MatchRange[]): TextSegment[] {
  const segments: TextSegment[] = [];
  let at = 0;
  const push = (end: number, hit: boolean) => {
    if (end <= at) return;
    const last = segments.at(-1);
    if (last && last.hit === hit) last.text += text.slice(at, end);
    else segments.push({ text: text.slice(at, end), hit });
    at = end;
  };
  for (const [start, end] of [...ranges].sort((a, b) => a[0] - b[0])) {
    push(start, false);
    push(end, true);
  }
  push(text.length, false);
  return segments;
}
