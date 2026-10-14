import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from '../src/server.js';
import { createAuthenticatedClient } from '../src/auth/client-factory.js';
import { GscApiClient } from '../src/api/client.js';
import { CacheManager } from '../src/cache/cache-manager.js';
import { RateLimiter } from '../src/utils/rate-limiter.js';

async function main(): Promise<void> {
  try {
    // Create shared infrastructure
    const cache = new CacheManager();
    const rateLimiter = new RateLimiter(20, 30); // 20 req/s, burst of 30

    // Authenticate with Google
    const authResult = await createAuthenticatedClient();
    console.error(`[awesome-gsc-mcp] Authenticated via ${authResult.method} (${authResult.identity})`);

    // Create API client
    const api = new GscApiClient(authResult.auth, cache, rateLimiter);

    // Create MCP server
    const server = createServer(api);

    // Stdio only. The upstream HTTP mode listened on all interfaces without
    // authentication, so it was removed rather than patched.
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[awesome-gsc-mcp] Server running on stdio');
  } catch (error) {
    console.error('[awesome-gsc-mcp] Failed to start:', error instanceof Error ? error.message : error);
    const hint = (error as { recoveryHint?: string } | null)?.recoveryHint;
    if (hint) console.error(hint);
    process.exit(1);
  }
}

main();
