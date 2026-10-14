import { describe, it, expect } from 'vitest';
import { topRowsByClicks } from '../../src/api/search-analytics.js';

describe('topRowsByClicks', () => {
  it('ranks by impressions when every row has 0 clicks', () => {
    const rows = [
      { keys: ['ads crm'], clicks: 0, impressions: 1 },
      { keys: ['binotel crm'], clicks: 0, impressions: 11 },
      { keys: ['pipedrive'], clicks: 0, impressions: 184 },
    ];
    expect(topRowsByClicks(rows, 2).map((r) => r.keys[0])).toEqual(['pipedrive', 'binotel crm']);
  });

  it('puts clicks ahead of impressions', () => {
    const rows = [
      { keys: ['a'], clicks: 0, impressions: 500 },
      { keys: ['b'], clicks: 2, impressions: 10 },
    ];
    expect(topRowsByClicks(rows, 1)[0]!.keys[0]).toBe('b');
  });
});
