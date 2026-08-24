import { withLambda, type LambdaHandler } from '@netlify/aws-lambda-compat';
import { queryWithClient, withTransaction } from './lib/db';
import { requireCompletedIdentity } from './lib/identity';
import { decideCancelFriendRequest, orderFriendshipPair } from '../../shared/socialPolicy';

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
    if (!userId || !playerId || userId === playerId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid friend request' }) };
    }
    const identity = await requireCompletedIdentity(event, userId, headers);
    if (identity.response) return identity.response;
    const [userA, userB] = orderFriendshipPair(userId, playerId);
    const result = await withTransaction(async (client) => {
      const requests = await queryWithClient<{ id: string; sender_id: string }>(
        client,
        'SELECT id, sender_id FROM friend_requests WHERE user_a = $1 AND user_b = $2 FOR UPDATE',
        [userA, userB]
      );
      const decision = decideCancelFriendRequest({
        senderId: userId,
        pendingSenderId: requests[0]?.sender_id ?? null,
      });
      if (decision === 'already_handled') return { relationship: 'none' as const, alreadyHandled: true };
      if (decision === 'forbidden') return { forbidden: true as const };
      await queryWithClient(client, 'DELETE FROM friend_requests WHERE id = $1', [requests[0].id]);
      return { relationship: 'none' as const };
    });
    if ('forbidden' in result) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Only the sender can cancel' }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (error) {
    console.error('Error cancelling friend request:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Unable to cancel friend request' }) };
  }
};

export default withLambda(handler);
