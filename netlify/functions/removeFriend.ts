import { withLambda, type LambdaHandler } from '@netlify/aws-lambda-compat';
import { query } from './lib/db';
import { requireCompletedIdentity } from './lib/identity';
import { orderFriendshipPair } from '../../shared/socialPolicy';

interface RemoveFriendRequest {
  userId: string;
  friendId: string;
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
    const body: RemoveFriendRequest = JSON.parse(event.body || '{}');
    const { userId, friendId } = body;

    if (!userId || !friendId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing userId or friendId' }),
      };
    }

    // Guest users can't have friends
    if (userId.startsWith('guest_')) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Please sign in to manage friends' }),
      };
    }

    const identity = await requireCompletedIdentity(event, userId, headers);
    if (identity.response) {
      return identity.response;
    }

    if (userId === friendId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'You cannot remove yourself as a friend' }),
      };
    }

    const [userA, userB] = orderFriendshipPair(userId, friendId);

    // Delete the friendship
    const result = await query<{ id: string }>(
      `DELETE FROM friendships WHERE user_a = $1 AND user_b = $2 RETURNING id`,
      [userA, userB]
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        friendId,
        alreadyRemoved: result.length === 0,
      }),
    };
  } catch (error) {
    console.error('Error removing friend:', error);
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
