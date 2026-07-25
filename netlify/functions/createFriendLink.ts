import { Handler } from '@netlify/functions';
import { randomInt } from 'node:crypto';
import { getSiteUrl } from './lib/siteUrl';
import { enforceRateLimit } from './lib/rateLimit';
import { query } from './lib/db';
import { assertAuthorizedUser } from './lib/auth';

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

export const handler: Handler = async (event) => {
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

    const authError = await assertAuthorizedUser(event, userId, headers, { allowGuest: false });
    if (authError) {
      return authError;
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

    // Generate unique code (retry if collision)
    let code = generateFriendCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await query<{ id: string }>(
        `SELECT id FROM friend_links WHERE code = $1`,
        [code]
      );
      if (existing.length === 0) break;
      code = generateFriendCode();
      attempts++;
    }

    if (attempts >= 10) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to generate unique code' }),
      };
    }

    // Create the friend link (expires in 7 days)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await query(
      `INSERT INTO friend_links (code, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [code, userId, expiresAt.toISOString()]
    );

    // Build share URL using the API base URL domain
    const shareUrl = `${getSiteUrl()}/f/${code}`;

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        code,
        shareUrl,
        expiresAt: expiresAt.toISOString(),
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
