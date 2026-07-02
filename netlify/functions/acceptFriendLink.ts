import { Handler } from '@netlify/functions';
import { query } from './lib/db';
import { assertAuthorizedUser } from './lib/auth';

interface AcceptFriendLinkRequest {
  code: string;
  userId: string;
}

interface FriendLinkRow {
  id: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  used_by: string | null;
  db_now: string;
  is_expired: boolean;
}

interface FriendInfoRow {
  display_name: string | null;
  username: string | null;
}

function getCodeSuffix(code: string): string {
  return code.slice(-4);
}

function logAcceptFailure(
  reason: string,
  code: string,
  userId: string,
  link?: Pick<FriendLinkRow, 'user_id' | 'created_at' | 'expires_at' | 'used_by' | 'db_now'>
) {
  console.warn('friend_link.accept.failed', {
    reason,
    codeSuffix: getCodeSuffix(code),
    requesterUserId: userId,
    linkOwnerId: link?.user_id,
    createdAt: link?.created_at,
    expiresAt: link?.expires_at,
    dbNow: link?.db_now,
    usedBy: link?.used_by,
  });
}

async function getFriendInfo(friendId: string): Promise<FriendInfoRow> {
  const friendInfo = await query<FriendInfoRow>(
    `SELECT display_name, username FROM users WHERE id = $1`,
    [friendId]
  );

  return friendInfo[0] || { display_name: null, username: null };
}

async function successResponse(
  headers: Record<string, string>,
  friendId: string
) {
  const friend = await getFriendInfo(friendId);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      friendId,
      friendDisplayName: friend.display_name,
      friendUsername: friend.username,
    }),
  };
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
    const body: AcceptFriendLinkRequest = JSON.parse(event.body || '{}');
    const { userId } = body;
    const code = body.code?.toUpperCase();

    if (!code || !userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing code or userId' }),
      };
    }

    // Guest users cannot accept friend links
    if (userId.startsWith('guest_')) {
      logAcceptFailure('guest_user', code, userId);
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Please sign in to add friends' }),
      };
    }

    const authError = await assertAuthorizedUser(event, userId, headers, { allowGuest: false });
    if (authError) {
      return authError;
    }

    // Look up the friend link
    const links = await query<FriendLinkRow>(
      `SELECT
        id,
        user_id,
        created_at,
        expires_at,
        used_by,
        NOW() AS db_now,
        expires_at <= NOW() AS is_expired
       FROM friend_links
       WHERE code = $1`,
      [code]
    );

    if (links.length === 0) {
      logAcceptFailure('invalid_code', code, userId);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Invalid invite code' }),
      };
    }

    const link = links[0];

    // Check if link is expired using database time.
    if (link.is_expired) {
      logAcceptFailure('expired', code, userId, link);
      return {
        statusCode: 410,
        headers,
        body: JSON.stringify({ error: 'This invite link has expired. Ask your friend for a new one.' }),
      };
    }

    // Check if user is trying to friend themselves
    if (link.user_id === userId) {
      logAcceptFailure('self_friend', code, userId, link);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'You cannot add yourself as a friend' }),
      };
    }

    // Sort user IDs to match the database constraint (user_a < user_b)
    const [userA, userB] = [link.user_id, userId].sort();

    // Check if friendship already exists
    const existingFriendship = await query<{ id: string }>(
      `SELECT id FROM friendships WHERE user_a = $1 AND user_b = $2`,
      [userA, userB]
    );

    if (existingFriendship.length > 0) {
      console.info('friend_link.accept.already_connected', {
        codeSuffix: getCodeSuffix(code),
        requesterUserId: userId,
        linkOwnerId: link.user_id,
      });
      return successResponse(headers, link.user_id);
    }

    // Check if link has already been used after honoring idempotent already-friends success.
    if (link.used_by) {
      logAcceptFailure('already_used', code, userId, link);
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: 'This invite link has already been used' }),
      };
    }

    // Create the friendship
    await query(
      `INSERT INTO friendships (user_a, user_b) VALUES ($1, $2)`,
      [userA, userB]
    );

    // Mark the link as used
    await query(
      `UPDATE friend_links SET used_by = $1, used_at = NOW() WHERE id = $2`,
      [userId, link.id]
    );

    return successResponse(headers, link.user_id);
  } catch (error) {
    console.error('Error accepting friend link:', error);
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
