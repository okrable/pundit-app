import { Handler } from '@netlify/functions';
import { query } from './lib/db';
import { requireCompletedIdentity } from './lib/identity';
import { enforceRateLimit } from './lib/rateLimit';
import {
  decideFriendInvitePreview,
  normalizeSocialCode,
  orderFriendshipPair,
} from '../../shared/socialPolicy';

interface FriendLinkRow {
  user_id: string;
  expires_at: string;
  used_by: string | null;
  is_reusable: boolean;
  username: string | null;
  avatar_url: string | null;
  avatar_id: string | null;
  onboarding_status: string | null;
}

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { code, userId } = event.queryStringParameters || {};
    if (!code || !userId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing code or userId' }) };
    }

    const identity = await requireCompletedIdentity(event, userId, headers);
    if (identity.response) return identity.response;

    const rateLimitError = await enforceRateLimit(event, headers, {
      scope: 'preview-friend-link',
      subject: userId,
      limit: 30,
      windowSeconds: 300,
    });
    if (rateLimitError) return rateLimitError;

    const links = await query<FriendLinkRow>(
      `SELECT
         fl.user_id,
         fl.expires_at,
         fl.used_by,
         fl.is_reusable,
         u.username,
         u.avatar_url,
         u.avatar_id,
         u.onboarding_status
       FROM friend_links fl
       LEFT JOIN users u ON u.id = fl.user_id
       WHERE fl.code = $1`,
      [normalizeSocialCode(code)]
    );

    if (links.length === 0) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Invalid invite code' }) };
    }

    const link = links[0];
    const inviterAvailable = link.onboarding_status === 'complete' && Boolean(link.username);
    const [userA, userB] = orderFriendshipPair(link.user_id, userId);
    const existing = await query<{ id: string }>(
      `SELECT id FROM friendships WHERE user_a = $1 AND user_b = $2 LIMIT 1`,
      [userA, userB]
    );

    const state = decideFriendInvitePreview({
      isExpired: new Date(link.expires_at) <= new Date(),
      isSelf: link.user_id === userId,
      inviterAvailable,
      alreadyFriends: existing.length > 0,
      isReusable: link.is_reusable,
      usedBy: link.used_by,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        code: normalizeSocialCode(code),
        inviter: inviterAvailable
          ? {
              userId: link.user_id,
              username: link.username,
              avatarUrl: link.avatar_url,
              avatarId: link.avatar_id,
            }
          : null,
        expiresAt: link.expires_at,
        canAccept: state === 'available' || state === 'already_friends',
        state,
      }),
    };
  } catch (error) {
    console.error('Error previewing friend link:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
