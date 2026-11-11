import { nextPosition, renumber } from './positions';

describe('renumber', () => {
  it('sorts by position and renumbers 0..n-1, keeping array order for ties', () => {
    const input = [
      { id: 'c', position: 3 },
      { id: 'a', position: 1 },
      { id: 'b', position: 1 },
    ];
    const out = renumber(input);
    expect(out.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(out.map((i) => i.position)).toEqual([0, 1, 2]);
  });

  it('does not mutate the input', () => {
    const input = [{ id: 'a', position: 5 }];
    const snapshot = structuredClone(input);
    renumber(input);
    expect(input).toEqual(snapshot);
  });
});

describe('nextPosition', () => {
  it('returns max + 1', () => {
    expect(nextPosition([{ position: 1 }, { position: 1 }])).toBe(2);
  });

  it('returns 0 for an empty list', () => {
    expect(nextPosition([])).toBe(0);
  });
});
