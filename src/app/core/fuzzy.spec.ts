import { matchRanges, splitByRanges } from './fuzzy';

describe('matchRanges', () => {
  it('marks a prefix', () => {
    expect(matchRanges('gi', 'GitHub')).toEqual([[0, 2]]);
  });

  it('marks a word prefix', () => {
    expect(matchRanges('over', 'Stack Overflow')).toEqual([[6, 10]]);
  });

  it('marks a substring', () => {
    expect(matchRanges('hub', 'GitHub')).toEqual([[3, 6]]);
  });

  it('marks each letter of an in-word subsequence', () => {
    expect(matchRanges('gtb', 'GitHub')).toEqual([[0, 1], [2, 3], [5, 6]]);
  });

  it('maps accented text back to the original letters', () => {
    expect(matchRanges('cafe', 'Café Bar')).toEqual([[0, 4]]);
  });

  it('ignores case in the query', () => {
    expect(matchRanges('GIT', 'GitHub')).toEqual([[0, 3]]);
  });

  it('marks nothing for a typo match or no match', () => {
    expect(matchRanges('gthib', 'GitHub')).toEqual([]);
    expect(matchRanges('zz', 'GitHub')).toEqual([]);
    expect(matchRanges('', 'GitHub')).toEqual([]);
  });

  it('prefers a word prefix over an earlier substring', () => {
    expect(matchRanges('lab', 'Collab Lab')).toEqual([[7, 10]]);
  });
});

describe('splitByRanges', () => {
  it('splits text into hit and plain segments', () => {
    expect(splitByRanges('GitHub', [[0, 2]])).toEqual([
      { text: 'Gi', hit: true },
      { text: 'tHub', hit: false },
    ]);
  });

  it('returns one plain segment without ranges', () => {
    expect(splitByRanges('GitHub', [])).toEqual([{ text: 'GitHub', hit: false }]);
  });

  it('merges adjacent ranges', () => {
    expect(splitByRanges('abc', [[0, 1], [1, 2]])).toEqual([
      { text: 'ab', hit: true },
      { text: 'c', hit: false },
    ]);
  });
});
