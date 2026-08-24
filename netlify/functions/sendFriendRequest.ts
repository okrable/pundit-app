import { withLambda, type LambdaHandler } from '@netlify/aws-lambda-compat';
import { enforceRateLimit } from './lib/rateLimit';
import { queryWithClient, withTransaction } from './lib/db';
import { requireCompletedIdentity } from './lib/identity';
import { decideSendFriendRequest, orderFriendshipPair } from '../../shared/socialPolicy';

const handler: LambdaHandler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { userId, playerId } = JSON.parse(event.body || '{}') as {
      userId?: string;
      playerId?: string;
    };
    if (!userId || !playerId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'userId and playerId are required' }) };
    }
    const identity = await requireCompletedIdentity(event, userId, headers);
    if (identity.response) return identity.response;
    if (userId === playerId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'You cannot add yourself' }) };
    }

    const [userA, userB] = orderFriendshipPair(userId, playerId);
    const senderLimit = await enforceRateLimit(event, headers, {
      scope: 'send-friend-request', subject: userId, limit: 30, windowSeconds: 3600,
    });
    if (senderLimit) return senderLimit;
    const pairLimit = await enforceRateLimit(event, headers, {
      scope: 'send-friend-request-pair', subject: `${userA}:${userB}`, limit: 5, windowSeconds: 86400,
    });
    if (pairLimit) return pairLimit;

    const result = await withTransaction(async (client) => {
      const users = await queryWithClient<{ id: string; username: string | null; onboarding_status: string }>(
        client,
        `SELECT id, username, onboarding_status
         FROM users WHERE id IN ($1, $2) ORDER BY id FOR UPDATE`,
        [userA, userB]
      );
      const recipient = users.find((row) => row.id === playerId);
      if (!recipient || recipient.onboarding_status !== 'complete' || !recipient.username) {
        return { kind: 'unavailable' as const };
      }
      const friendships = await queryWithClient<{ id: string }>(
        client,
        'SELECT id FROM friendships WHERE user_a = $1 AND user_b = $2', [userA, userB]
      );
      const requests = await queryWithClient<{ id: string; sender_id: string }>(
        client,
        'SELECT id, sender_id FROM friend_requests WHERE user_a = $1 AND user_b = $2 FOR UPDATE',
        [userA, userB]
      );
      const decision = decideSendFriendRequest({
        senderId: userId,
        recipientId: playerId,
        alreadyFriends: friendships.length > 0,
        pendingSenderId: requests[0]?.sender_id ?? null,
      });
      if (decision === 'already_friends') {
        if (requests[0]) await queryWithClient(client, 'DELETE FROM friend_requests WHERE id = $1', [requests[0].id]);
        return { kind: 'friends' as const, alreadyFriends: true };
      }
      if (decision === 'already_requested') {
        return { kind: 'outgoing_pending' as const, alreadyRequested: true };
      }
      if (decision === 'accept_reciprocal') {
        await queryWithClient(
          client,
          `INSERT INTO friendships (user_a, user_b) VALUES ($1, $2)
           ON CONFLICT (user_a, user_b) DO NOTHING`,
          [userA, userB]
        );
        await queryWithClient(client, 'DELETE FROM friend_requests WHERE user_a = $1 AND user_b = $2', [userA, userB]);
        return { kind: 'friends' as const, reciprocalAccepted: true };
      }
      await queryWithClient(
        client,
        `INSERT INTO friend_requests (user_a, user_b, sender_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_a, user_b) DO UPDATE SET updated_at = now()`,
        [userA, userB, userId]
      );
      return { kind: 'outgoing_pending' as const, alreadyRequested: false };
    });

    if (result.kind === 'unavailable') {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Player profile unavailable' }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ relationship: result.kind, ...result }) };
  } catch (error) {
    console.error('Error sending friend request:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Unable to send friend request' }) };
  }
};

export default withLambda(handler);
