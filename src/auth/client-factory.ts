/**
 * Authentication client factory for Google Search Console.
 *
 * Service account only, with a read-only scope. OAuth was removed on purpose:
 * it stores a refresh token for a personal Google account on disk, while a
 * service account can be given the narrowest Search Console role per property.
 */

import { webmasters_v3 } from 'googleapis';
import type { GoogleAuth } from 'googleapis-common';
import {
  loadServiceAccountCredentials,
  createServiceAccountAuth,
} from './service-account.js';
import { AuthenticationError, AuthorizationError } from '../errors/gsc-error.js';

export type AuthMethod = 'service-account';
export type AuthClient = GoogleAuth;

export interface AuthResult {
  auth: AuthClient;
  method: AuthMethod;
  identity: string;
}

const SETUP_GUIDE = `
===== Google Search Console MCP - Authentication Setup =====

No valid credentials found. This server only accepts a service account:

  1. Create a service account in Google Cloud Console
  2. Download the JSON key file
  3. Add the service account email as a user in Search Console
     (Search Console -> Settings -> Users and permissions).
     "Restricted" permission is enough; never make it an Owner.
  4. Set the environment variable:
     export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"

================================================================
`.trim();

/**
 * Creates an authenticated Search Console client from service account
 * credentials (GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_KEY).
 *
 * @throws {AuthenticationError} If no credentials are found or they are invalid.
 */
export async function createAuthenticatedClient(): Promise<AuthResult> {
  let detail = '';

  try {
    const credentials = loadServiceAccountCredentials();
    if (credentials) {
      const auth = createServiceAccountAuth(credentials);
      process.stderr.write(
        `[auth] Authenticated via service account: ${credentials.client_email}\n`,
      );
      return {
        auth,
        method: 'service-account',
        identity: credentials.client_email,
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    detail = `\n\nService account: ${message}`;
  }

  throw new AuthenticationError(
    `No valid Google Search Console credentials found.${detail}`,
    { recoveryHint: SETUP_GUIDE },
  );
}

/**
 * Validates that the authenticated client can actually reach the Search Console API
 * by making a lightweight `sites.list` call.
 *
 * @throws {AuthenticationError} on 401 responses.
 * @throws {AuthorizationError} on 403 responses.
 * @throws {Error} on other unexpected failures.
 */
export async function validateConnection(
  client: webmasters_v3.Webmasters,
): Promise<void> {
  try {
    await client.sites.list();
  } catch (err: unknown) {
    const status = extractHttpStatus(err);

    if (status === 401) {
      throw new AuthenticationError(
        'Credentials were loaded but the API returned 401 Unauthorized.',
        {
          recoveryHint:
            'Your credentials may be revoked or expired.\n' +
            'Re-download the service account JSON key from Google Cloud Console.',
          cause: err,
        },
      );
    }

    if (status === 403) {
      throw new AuthorizationError(
        'Credentials are valid but lack permission to access Search Console.',
        {
          recoveryHint:
            'Add the service account email in Search Console -> Settings -> Users and permissions.',
          cause: err,
        },
      );
    }

    throw new Error(
      `Failed to validate Search Console connection: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Extracts an HTTP status code from a Google API error, if present.
 */
function extractHttpStatus(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) {
    return undefined;
  }

  // googleapis wraps errors in GaxiosError with a `code` field (as a string or number).
  const maybeCode = (err as Record<string, unknown>)['code'];
  if (typeof maybeCode === 'number') {
    return maybeCode;
  }
  if (typeof maybeCode === 'string') {
    const parsed = parseInt(maybeCode, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  // Fallback: check response.status
  const response = (err as Record<string, unknown>)['response'];
  if (typeof response === 'object' && response !== null) {
    const status = (response as Record<string, unknown>)['status'];
    if (typeof status === 'number') {
      return status;
    }
  }

  return undefined;
}
