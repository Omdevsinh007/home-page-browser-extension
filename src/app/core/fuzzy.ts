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
