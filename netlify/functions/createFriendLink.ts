import { Handler } from '@netlify/functions';
import { randomInt } from 'node:crypto';
import { query } from './lib/db';
import { assertAuthorizedUser } from './lib/auth';

interface CreateFriendLinkRequest {
  userId: string;
}

interface CreatedFriendLink {
  created_at: string;
  expires_at: string;
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

function getSiteUrl(): string {
  return (process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://pundit-app.netlify.app').replace(/\/$/, '');
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

    // Create the friend link using database time so expiry checks share the same clock.
    const createdLinks = await query<CreatedFriendLink>(
      `INSERT INTO friend_links (code, user_id, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '7 days')
       RETURNING created_at, expires_at`,
      [code, userId]
    );
    const createdLink = createdLinks[0];

    // Build share URL using the API base URL domain
    const shareUrl = `${getSiteUrl()}/f/${code}`;

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        code,
        shareUrl,
        createdAt: createdLink.created_at,
        expiresAt: createdLink.expires_at,
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
