import { withLambda, type LambdaHandler } from '@netlify/aws-lambda-compat';
import { randomInt } from 'node:crypto';
import { getSiteUrl } from './lib/siteUrl';
import { enforceRateLimit } from './lib/rateLimit';
import { queryWithClient, withTransaction } from './lib/db';
import { requireCompletedIdentity } from './lib/identity';

interface CreateFriendLinkRequest {
  userId: string;
}

// Generate an 8-character alphanumeric code (uppercase, no ambiguous chars)
function generateFriendCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0/O, 1/I/L
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(randomInt(chars.length));
  }
  return code;
}

const handler: LambdaHandler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body: CreateFriendLinkRequest = JSON.parse(event.body || '{}');
    const { userId } = body;

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing userId' }),
      };
    }

    // Guest users cannot create friend links
    if (userId.startsWith('guest_')) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Please sign in to invite friends' }),
      };
    }

    const identity = await requireCompletedIdentity(event, userId, headers);
    if (identity.response) {
      return identity.response;
    }

    const rateLimitError = await enforceRateLimit(event, headers, {
      scope: 'create-friend-link',
      subject: userId,
      limit: 10,
      windowSeconds: 300,
    });
    if (rateLimitError) {
      return rateLimitError;
    }

    const linkResult = await withTransaction(async (client) => {
      // Serialize link creation for this user so concurrent requests cannot
      // mint multiple active reusable codes.
      await queryWithClient(
        client,
        `SELECT id FROM users WHERE id = $1 FOR UPDATE`,
        [userId]
      );

      const existingLinks = await queryWithClient<{
        code: string;
        expires_at: string;
      }>(
        client,
        `SELECT code, expires_at
         FROM friend_links
         WHERE user_id = $1
           AND is_reusable = true
           AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId]
      );

      if (existingLinks.length > 0) {
        return {
          code: existingLinks[0].code,
          expiresAt: existingLinks[0].expires_at,
          reused: true,
        };
      }

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const candidate = generateFriendCode();
        const inserted = await queryWithClient<{ code: string }>(
          client,
          `INSERT INTO friend_links (code, user_id, expires_at, is_reusable)
           VALUES ($1, $2, $3, true)
           ON CONFLICT (code) DO NOTHING
           RETURNING code`,
          [candidate, userId, expiresAt.toISOString()]
        );
        if (inserted.length > 0) {
          return {
            code: inserted[0].code,
            expiresAt: expiresAt.toISOString(),
            reused: false,
          };
        }
      }

      throw new Error('Failed to generate unique code');
    });

    // Build share URL using the API base URL domain
    const shareUrl = `${getSiteUrl()}/f/${linkResult.code}`;

    return {
      statusCode: linkResult.reused ? 200 : 201,
      headers,
      body: JSON.stringify({
        code: linkResult.code,
        shareUrl,
        expiresAt: linkResult.expiresAt,
        reused: linkResult.reused,
        username: identity.identity.username,
      }),
    };
  } catch (error) {
    console.error('Error creating friend link:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

export default withLambda(handler);
