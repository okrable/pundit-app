import { withLambda, type LambdaHandler } from '@netlify/aws-lambda-compat';
import { queryWithClient, withTransaction } from './lib/db';
import { requireCompletedIdentity } from './lib/identity';
import { decideFriendRequestResponse, orderFriendshipPair } from '../../shared/socialPolicy';

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
    const { userId, playerId, action } = JSON.parse(event.body || '{}') as {
      userId?: string;
      playerId?: string;
      action?: 'accept' | 'decline';
    };
    if (!userId || !playerId || (action !== 'accept' && action !== 'decline')) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid friend request response' }) };
    }
    const identity = await requireCompletedIdentity(event, userId, headers);
    if (identity.response) return identity.response;
    if (userId === playerId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid player' }) };
    }
    const [userA, userB] = orderFriendshipPair(userId, playerId);
    const result = await withTransaction(async (client) => {
      await queryWithClient(client, 'SELECT id FROM users WHERE id IN ($1, $2) ORDER BY id FOR UPDATE', [userA, userB]);
      const friendships = await queryWithClient<{ id: string }>(
        client,
        'SELECT id FROM friendships WHERE user_a = $1 AND user_b = $2', [userA, userB]
      );
      const requests = await queryWithClient<{ id: string; sender_id: string }>(
        client,
        'SELECT id, sender_id FROM friend_requests WHERE user_a = $1 AND user_b = $2 FOR UPDATE',
        [userA, userB]
      );
      const decision = decideFriendRequestResponse({
        responderId: userId,
        pendingSenderId: requests[0]?.sender_id ?? null,
        alreadyFriends: friendships.length > 0,
        action,
      });
      if (decision === 'already_friends') {
        await queryWithClient(client, 'DELETE FROM friend_requests WHERE user_a = $1 AND user_b = $2', [userA, userB]);
        return { relationship: 'friends' as const, alreadyHandled: true };
      }
      if (decision === 'already_handled') return { relationship: 'none' as const, alreadyHandled: true };
      if (decision === 'forbidden') return { forbidden: true as const };
      if (decision === 'accept') {
        await queryWithClient(
          client,
          `INSERT INTO friendships (user_a, user_b) VALUES ($1, $2)
           ON CONFLICT (user_a, user_b) DO NOTHING`,
          [userA, userB]
        );
      }
      await queryWithClient(client, 'DELETE FROM friend_requests WHERE id = $1', [requests[0].id]);
      return { relationship: decision === 'accept' ? 'friends' as const : 'none' as const };
    });
    if ('forbidden' in result) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Only the recipient can respond' }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (error) {
    console.error('Error responding to friend request:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Unable to respond to friend request' }) };
  }
};

export default withLambda(handler);
