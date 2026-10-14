import { describe, it, expect } from 'vitest';
import type { webmasters_v3 } from 'googleapis';
import { listSitemaps } from '../../src/api/sitemaps.js';
import { CacheManager } from '../../src/cache/cache-manager.js';
import { RateLimiter } from '../../src/utils/rate-limiter.js';

function clientReturning(sitemap: webmasters_v3.Schema$WmxSitemap): webmasters_v3.Webmasters {
  return {
    sitemaps: { list: async () => ({ data: { sitemap: [sitemap] } }) },
  } as unknown as webmasters_v3.Webmasters;
}

describe('listSitemaps', () => {
  it('treats the API\'s "0" error and warning counts as none', async () => {
    const client = clientReturning({ path: 'https://example.com/sitemap.xml', errors: '0', warnings: '0' });
    const [sm] = await listSitemaps(client, 'sc-domain:example.com', new CacheManager(), new RateLimiter(100, 100));
    expect(sm.errors).toBeUndefined();
    expect(sm.warnings).toBeUndefined();
  });

  it('keeps non-zero counts', async () => {
    const client = clientReturning({ path: 'https://example.com/sitemap.xml', errors: '3', warnings: '1' });
    const [sm] = await listSitemaps(client, 'sc-domain:example.com', new CacheManager(), new RateLimiter(100, 100));
    expect(sm.errors).toBe('3');
    expect(sm.warnings).toBe('1');
  });
});
