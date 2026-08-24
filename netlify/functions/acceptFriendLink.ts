import { withLambda, type LambdaHandler } from '@netlify/aws-lambda-compat';
import { queryWithClient, withTransaction } from './lib/db';
import { enforceRateLimit } from './lib/rateLimit';
import { requireCompletedIdentity } from './lib/identity';
import {
  decideFriendLinkAcceptance,
  normalizeSocialCode,
  orderFriendshipPair,
} from '../../shared/socialPolicy';

interface AcceptFriendLinkRequest {
  code: string;
  userId: string;
}

type AcceptResult =
  | { kind: 'not_found' }
  | { kind: 'expired' }
  | { kind: 'self' }
  | { kind: 'used' }
  | { kind: 'inviter_unavailable' }
  | {
      kind: 'success';
      alreadyFriends: boolean;
      friend: {
        userId: string;
        username: string;
        avatarUrl: string | null;
      };
    };

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

    const identity = await requireCompletedIdentity(event, userId, headers);
    if (identity.response) {
      return identity.response;
    }

    const rateLimitError = await enforceRateLimit(event, headers, {
      scope: 'accept-friend-link',
      subject: userId,
      limit: 15,
      windowSeconds: 300,
    });
    if (rateLimitError) {
      return rateLimitError;
    }

    const result = await withTransaction<AcceptResult>(async (client) => {
      const links = await queryWithClient<{
        id: string;
        user_id: string;
        expires_at: string;
        used_by: string | null;
        is_reusable: boolean;
      }>(
        client,
        `SELECT id, user_id, expires_at, used_by, is_reusable
         FROM friend_links
         WHERE code = $1
         FOR UPDATE`,
        [normalizeSocialCode(code)]
      );

      if (links.length === 0) {
        return { kind: 'not_found' };
      }

      const link = links[0];
      const preliminaryDecision = decideFriendLinkAcceptance({
        isExpired: new Date(link.expires_at) <= new Date(),
        isSelf: link.user_id === userId,
        alreadyFriends: false,
        isReusable: link.is_reusable,
        usedBy: link.used_by,
      });
      if (preliminaryDecision === 'expired') {
        return { kind: 'expired' };
      }
      if (preliminaryDecision === 'self') {
        return { kind: 'self' };
      }

      const friendInfo = await queryWithClient<{
        id: string;
        username: string | null;
        avatar_url: string | null;
        avatar_id: string | null;
        onboarding_status: string;
      }>(
        client,
        `SELECT id, username, avatar_url, avatar_id, onboarding_status
         FROM users
         WHERE id = $1`,
        [link.user_id]
      );
      const inviter = friendInfo[0];
      if (!inviter || inviter.onboarding_status !== 'complete' || !inviter.username) {
        return { kind: 'inviter_unavailable' };
      }

      const [userA, userB] = orderFriendshipPair(link.user_id, userId);
      const existingFriendship = await queryWithClient<{ id: string }>(
        client,
        `SELECT id FROM friendships WHERE user_a = $1 AND user_b = $2`,
        [userA, userB]
      );
      const decision = decideFriendLinkAcceptance({
        isExpired: new Date(link.expires_at) <= new Date(),
        isSelf: link.user_id === userId,
        alreadyFriends: existingFriendship.length > 0,
        isReusable: link.is_reusable,
        usedBy: link.used_by,
      });

      if (decision === 'expired') {
        return { kind: 'expired' };
      }
      if (decision === 'self') {
        return { kind: 'self' };
      }
      if (decision === 'already_friends') {
        await queryWithClient(
          client,
          'DELETE FROM friend_requests WHERE user_a = $1 AND user_b = $2',
          [userA, userB]
        );
        if (!link.is_reusable && !link.used_by) {
          await queryWithClient(
            client,
            `UPDATE friend_links
             SET used_by = $1, used_at = NOW()
             WHERE id = $2 AND used_by IS NULL`,
            [userId, link.id]
          );
        }
        return {
          kind: 'success',
          alreadyFriends: true,
          friend: {
            userId: inviter.id,
            username: inviter.username,
            avatarUrl: inviter.avatar_url,
            avatarId: inviter.avatar_id,
          },
        };
      }

      if (decision === 'used_legacy') {
        return { kind: 'used' };
      }

      if (!link.is_reusable) {
        const claimed = await queryWithClient<{ id: string }>(
          client,
          `UPDATE friend_links
           SET used_by = $1, used_at = NOW()
           WHERE id = $2 AND used_by IS NULL
           RETURNING id`,
          [userId, link.id]
        );
        if (claimed.length === 0) {
          return { kind: 'used' };
        }
      }

      const inserted = await queryWithClient<{ id: string }>(
        client,
        `INSERT INTO friendships (user_a, user_b)
         VALUES ($1, $2)
         ON CONFLICT (user_a, user_b) DO NOTHING
         RETURNING id`,
        [userA, userB]
      );
      await queryWithClient(
        client,
        'DELETE FROM friend_requests WHERE user_a = $1 AND user_b = $2',
        [userA, userB]
      );

      return {
        kind: 'success',
        alreadyFriends: inserted.length === 0,
        friend: {
          userId: inviter.id,
          username: inviter.username,
          avatarUrl: inviter.avatar_url,
          avatarId: inviter.avatar_id,
        },
      };
    });

    if (result.kind === 'not_found') {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Invalid invite code' }),
      };
    }
    if (result.kind === 'expired') {
      return {
        statusCode: 410,
        headers,
        body: JSON.stringify({ error: 'This invite link has expired. Ask your friend for a new one.' }),
      };
    }
    if (result.kind === 'self') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'You cannot add yourself as a friend' }),
      };
    }
    if (result.kind === 'used') {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: 'This legacy invite link has already been used' }),
      };
    }
    if (result.kind === 'inviter_unavailable') {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          error: 'The inviting player must complete username setup before adding friends',
          code: 'INVITER_USERNAME_REQUIRED',
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        alreadyFriends: result.alreadyFriends,
        friend: result.friend,
        friendId: result.friend.userId,
        friendUsername: result.friend.username,
        // Deprecated compatibility field for installed clients.
        friendDisplayName: result.friend.username,
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

export default withLambda(handler);
