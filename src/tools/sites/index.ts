import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { GscApiClient } from '../../api/client.js';
import { siteUrlSchema, createToolResponse, formatToolResponse } from '../schemas.js';
import { GscError } from '../../errors/gsc-error.js';

/**
 * Determine whether a GSC site URL represents a domain property or a URL-prefix property.
 */
function getPropertyType(siteUrl: string): string {
  return siteUrl.startsWith('sc-domain:') ? 'Domain property' : 'URL-prefix property';
}

/**
 * Format an error into an MCP tool error response.
 */
function errorResponse(error: unknown) {
  const message =
    error instanceof GscError
      ? `${error.message}${error.recoveryHint ? `\n\nHint: ${error.recoveryHint}` : ''}`
      : error instanceof Error
        ? error.message
        : 'An unexpected error occurred.';

  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true,
  };
}

export function registerSiteTools(server: McpServer, api: GscApiClient): void {
  // ── list_properties ──────────────────────────────────────────────────
  server.tool(
    'list_properties',
    'List all Google Search Console properties with permission levels and types',
    {},
    async () => {
      try {
        const sites = await api.listSites();

        const domainCount = sites.filter((s) => s.siteUrl.startsWith('sc-domain:')).length;
        const urlPrefixCount = sites.length - domainCount;

        const rows = sites.map((site) => {
          const type = getPropertyType(site.siteUrl);
          return `- **${site.siteUrl}** — ${type} (${site.permissionLevel})`;
        });

        const data = rows.length > 0 ? rows.join('\n') : '_No properties found._';
        const summary = `Found ${sites.length} propert${sites.length === 1 ? 'y' : 'ies'}: ${domainCount} domain propert${domainCount === 1 ? 'y' : 'ies'}, ${urlPrefixCount} URL-prefix propert${urlPrefixCount === 1 ? 'y' : 'ies'}`;

        const recommendations: string[] = [];
        if (sites.length === 0) {
          recommendations.push('No properties found. Add the service account email as a user of the property in Search Console, then retry.');
        }

        const limitations = [
          'Only properties accessible to the authenticated account are listed.',
        ];

        const text = formatToolResponse(createToolResponse(data, summary, recommendations, limitations));
        return { content: [{ type: 'text' as const, text }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );

  // ── get_property_details ─────────────────────────────────────────────
  server.tool(
    'get_property_details',
    'Get detailed information for a specific Google Search Console property',
    { siteUrl: siteUrlSchema },
    async ({ siteUrl }) => {
      try {
        const site = await api.getSite(siteUrl);

        const propertyType = getPropertyType(site.siteUrl);
        const isVerified = site.permissionLevel !== 'siteUnverifiedUser';

        const lines = [
          `| Field | Value |`,
          `| --- | --- |`,
          `| **URL** | ${site.siteUrl} |`,
          `| **Type** | ${propertyType} |`,
          `| **Permission level** | ${site.permissionLevel} |`,
          `| **Verified** | ${isVerified ? 'Yes' : 'No'} |`,
        ];
        const data = lines.join('\n');

        const summary = `Property ${site.siteUrl} is a ${propertyType.toLowerCase()} with ${site.permissionLevel} access.`;

        const recommendations: string[] = [];
        if (!isVerified) {
          recommendations.push(
            'This property is not verified. To verify ownership:',
            '1. Go to Google Search Console -> Settings -> Ownership verification.',
            '2. Choose a verification method (HTML file, DNS record, HTML tag, Google Analytics, or Google Tag Manager).',
            '3. Follow the on-screen instructions to complete verification.',
          );
        }

        const limitations = [
          'Detailed verification method info is not available through the API.',
        ];

        const text = formatToolResponse(createToolResponse(data, summary, recommendations, limitations));
        return { content: [{ type: 'text' as const, text }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
