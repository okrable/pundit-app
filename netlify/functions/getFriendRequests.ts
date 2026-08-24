import { withLambda, type LambdaHandler } from '@netlify/aws-lambda-compat';
import { query } from './lib/db';
import { requireCompletedIdentity } from './lib/identity';

const handler: LambdaHandler = async (event) => {
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
    const userId = event.queryStringParameters?.userId;
    if (!userId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'userId is required' }) };
    }
    const identity = await requireCompletedIdentity(event, userId, headers);
    if (identity.response) return identity.response;

    const rows = await query<{
      id: string;
      sender_id: string;
      created_at: string;
      player_id: string;
      username: string;
      avatar_id: string | null;
    }>(
      `SELECT
         fr.id,
         fr.sender_id,
         fr.created_at,
         u.id as player_id,
         u.username,
         u.avatar_id
       FROM friend_requests fr
       JOIN users u ON u.id = CASE WHEN fr.user_a = $1 THEN fr.user_b ELSE fr.user_a END
       WHERE fr.user_a = $1 OR fr.user_b = $1
       ORDER BY fr.created_at DESC`,
      [userId]
    );
    const mapRequest = (row: typeof rows[number]) => ({
      requestId: row.id,
      createdAt: row.created_at,
      player: { userId: row.player_id, username: row.username, avatarId: row.avatar_id },
    });
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        incoming: rows.filter((row) => row.sender_id !== userId).map(mapRequest),
        outgoing: rows.filter((row) => row.sender_id === userId).map(mapRequest),
      }),
    };
  } catch (error) {
    console.error('Error getting friend requests:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Unable to load friend requests' }) };
  }
};

export default withLambda(handler);
