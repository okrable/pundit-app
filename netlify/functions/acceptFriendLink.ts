import { Handler } from '@netlify/functions';
import { query } from './lib/db';

interface AcceptFriendLinkRequest {
  code: string;
  userId: string;
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
    const { code, userId } = body;

    if (!code || !userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing code or userId' }),
      };
    }

    // Guest users cannot accept friend links
    if (userId.startsWith('guest_')) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Please sign in to add friends' }),
      };
    }

    // Look up the friend link
    const links = await query<{
      id: string;
      user_id: string;
      expires_at: string;
      used_by: string | null;
    }>(
      `SELECT id, user_id, expires_at, used_by FROM friend_links WHERE code = $1`,
      [code.toUpperCase()]
    );

    if (links.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Invalid invite code' }),
      };
    }

    const link = links[0];

    // Check if link is expired
    if (new Date(link.expires_at) < new Date()) {
      return {
        statusCode: 410,
        headers,
        body: JSON.stringify({ error: 'This invite link has expired. Ask your friend for a new one.' }),
      };
    }

    // Check if link has already been used
    if (link.used_by) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: 'This invite link has already been used' }),
      };
    }

    // Check if user is trying to friend themselves
    if (link.user_id === userId) {
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
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: "You're already friends with this person" }),
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

    // Get the friend's info to return
    const friendInfo = await query<{
      display_name: string | null;
      username: string | null;
    }>(
      `SELECT display_name, username FROM users WHERE id = $1`,
      [link.user_id]
    );

    const friend = friendInfo[0] || { display_name: null, username: null };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        friendId: link.user_id,
        friendDisplayName: friend.display_name,
        friendUsername: friend.username,
      }),
    };
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
