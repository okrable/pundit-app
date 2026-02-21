import { Handler } from '@netlify/functions';
import { query } from './lib/db';
import { assertAuthorizedUser } from './lib/auth';
import { getQuizDate } from './lib/quizDate';

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const userId = event.queryStringParameters?.userId;

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing userId parameter' }),
      };
    }

    // Guest users don't have friends
    if (userId.startsWith('guest_')) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          leaderboard: [],
          totalFriends: 0,
          friendsPlayedToday: 0,
        }),
      };
    }

    const authError = await assertAuthorizedUser(event, userId, headers, { allowGuest: false });
    if (authError) {
      return authError;
    }

    const today = getQuizDate();

    // Get friends leaderboard including the current user
    // Uses a CTE to get all friend IDs plus the current user,
    // then joins with users and left joins with results for today
    const leaderboard = await query<{
      user_id: string;
      display_name: string | null;
      username: string | null;
      score: number | null;
      streak: number;
      has_played_today: boolean;
    }>(
      `WITH friend_ids AS (
        -- Get all friend IDs
        SELECT CASE WHEN f.user_a = $1 THEN f.user_b ELSE f.user_a END as friend_id
        FROM friendships f
        WHERE f.user_a = $1 OR f.user_b = $1
        UNION ALL
        -- Include the current user
        SELECT $1 as friend_id
      )
      SELECT
        u.id as user_id,
        u.display_name,
        u.username,
        r.score,
        u.streak,
        r.score IS NOT NULL as has_played_today
      FROM friend_ids fi
      JOIN users u ON u.id = fi.friend_id
      LEFT JOIN results r ON r.user_id = u.id AND r.quiz_date = $2
      ORDER BY
        CASE WHEN r.score IS NULL THEN 1 ELSE 0 END,  -- Played first
        r.score DESC NULLS LAST,
        u.display_name ASC NULLS LAST`,
      [userId, today]
    );

    // Calculate ranks only for those who played today
    let currentRank = 0;
    let lastScore: number | null = null;
    let sameScoreCount = 0;

    const rankedLeaderboard = leaderboard.map((entry) => {
      let rank: number | null = null;

      if (entry.has_played_today && entry.score !== null) {
        if (entry.score !== lastScore) {
          currentRank = currentRank + sameScoreCount + 1;
          sameScoreCount = 0;
        } else {
          sameScoreCount++;
        }
        rank = currentRank;
        lastScore = entry.score;
      }

      return {
        userId: entry.user_id,
        displayName: entry.display_name,
        username: entry.username,
        score: entry.score ?? 0,
        streak: entry.streak,
        rank,
        hasPlayedToday: entry.has_played_today,
      };
    });

    // Count stats
    const totalFriends = leaderboard.length - 1; // Exclude self
    const friendsPlayedToday = leaderboard.filter(
      (e) => e.has_played_today && e.user_id !== userId
    ).length;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        leaderboard: rankedLeaderboard,
        totalFriends,
        friendsPlayedToday,
      }),
    };
  } catch (error) {
    console.error('Error fetching friends leaderboard:', error);
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
