import { withLambda, type LambdaHandler } from '@netlify/aws-lambda-compat';
import { enforceRateLimit } from './lib/rateLimit';
import { query } from './lib/db';
import { requireCompletedIdentity } from './lib/identity';
import { getPreviousQuizDate, getQuizDate } from './lib/quizDate';
import { getFriendRelationshipState, orderFriendshipPair } from '../../shared/socialPolicy';
import { projectPublicAchievementUnlocks } from '../../shared/achievements';

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
    const playerId = event.queryStringParameters?.playerId;
    const viewerUserId = event.queryStringParameters?.viewerUserId;
    if (!playerId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'playerId is required' }) };
    }

    const rateLimitError = await enforceRateLimit(event, headers, {
      scope: 'get-player-profile',
      subject: viewerUserId || null,
      limit: 120,
      windowSeconds: 300,
    });
    if (rateLimitError) return rateLimitError;

    if (viewerUserId) {
      const identity = await requireCompletedIdentity(event, viewerUserId, headers);
      if (identity.response) return identity.response;
    }

    const today = getQuizDate();
    const previousQuizDate = getPreviousQuizDate(today);
    const players = await query<{
      id: string;
      username: string;
      avatar_id: string | null;
      best_score: number;
      total_quizzes: number;
      streak: number;
      last_played: string | null;
    }>(
      `SELECT id, username, avatar_id, best_score, total_quizzes, streak,
              last_played::TEXT as last_played
       FROM users
       WHERE id = $1
         AND onboarding_status = 'complete'
         AND username IS NOT NULL`,
      [playerId]
    );
    const player = players[0];
    if (!player) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Player profile unavailable' }) };
    }

    const achievements = await query<{ achievement_id: string; unlocked_at: string }>(
      `SELECT achievement_id, unlocked_at
       FROM user_achievements
       WHERE user_id = $1
       ORDER BY unlocked_at DESC, achievement_id ASC`,
      [playerId]
    );

    let alreadyFriends = false;
    let pendingSenderId: string | null = null;
    if (viewerUserId && viewerUserId !== playerId) {
      const [userA, userB] = orderFriendshipPair(viewerUserId, playerId);
      const [friendships, requests] = await Promise.all([
        query<{ id: string }>(
          'SELECT id FROM friendships WHERE user_a = $1 AND user_b = $2 LIMIT 1',
          [userA, userB]
        ),
        query<{ sender_id: string }>(
          'SELECT sender_id FROM friend_requests WHERE user_a = $1 AND user_b = $2 LIMIT 1',
          [userA, userB]
        ),
      ]);
      alreadyFriends = friendships.length > 0;
      pendingSenderId = requests[0]?.sender_id ?? null;
    }

    const currentStreak = player.last_played === today || player.last_played === previousQuizDate
      ? Number(player.streak || 0)
      : 0;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        profile: {
          userId: player.id,
          username: player.username,
          avatarId: player.avatar_id,
          currentStreak,
          bestScore: Number(player.best_score || 0),
          totalQuizzes: Number(player.total_quizzes || 0),
          achievements: projectPublicAchievementUnlocks(
            achievements.map((row) => ({
              achievementId: row.achievement_id,
              unlockedAt: row.unlocked_at,
            }))
          ),
        },
        relationship: getFriendRelationshipState({
          viewerId: viewerUserId,
          playerId,
          alreadyFriends,
          pendingSenderId,
        }),
      }),
    };
  } catch (error) {
    console.error('Error getting player profile:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Unable to load player profile' }) };
  }
};

export default withLambda(handler);
