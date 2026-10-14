import { describe, it, expect } from 'vitest';
import type { searchconsole_v1 } from 'googleapis';
import { batchInspectUrls } from '../../src/api/url-inspection.js';
import { CacheManager } from '../../src/cache/cache-manager.js';
import { RateLimiter } from '../../src/utils/rate-limiter.js';

describe('batchInspectUrls', () => {
  it('keeps the other results when one URL fails', async () => {
    const client = {
      urlInspection: {
        index: {
          inspect: async ({ requestBody }: { requestBody: { inspectionUrl: string } }) => {
            if (requestBody.inspectionUrl.endsWith('/bad')) throw new Error('Internal error encountered.');
            return { data: { inspectionResult: { indexStatusResult: { verdict: 'PASS' } } } };
          },
        },
      },
    } as unknown as searchconsole_v1.Searchconsole;

    const results = await batchInspectUrls(
      client,
      'https://example.com/',
      ['https://example.com/a', 'https://example.com/bad', 'https://example.com/c'],
      new CacheManager(),
      new RateLimiter(100, 100),
    );

    expect(results).toHaveLength(3);
    expect(results[0]!.indexStatusResult?.verdict).toBe('PASS');
    expect(results[1]!.error).toContain('Internal error');
    expect(results[1]!.indexStatusResult).toBeUndefined();
    expect(results[2]!.indexStatusResult?.verdict).toBe('PASS');
  });
});
