import { Handler } from '@netlify/functions';
import { query } from './lib/db';
import { assertAuthorizedUser } from './lib/auth';
import { getPreviousQuizDate, getQuizDate } from './lib/quizDate';

interface MigrateGuestResultRequest {
  userId: string; // Auth0 user ID
  quizId: string;
  score: number;
  totalQuestions: number;
  answers: boolean[]; // Boolean array from cached result
  userProfile?: {
    displayName?: string;
    email?: string;
    avatarUrl?: string;
  };
}

interface DbUser {
  streak: number;
  best_score: number;
}

// Calculate streak: count consecutive days ending with today
async function calculateStreak(userId: string): Promise<number> {
  const results = await query<{ quiz_date: string }>(
    `SELECT DISTINCT quiz_date::TEXT as quiz_date
     FROM results
     WHERE user_id = $1
     ORDER BY quiz_date DESC`,
    [userId]
  );

  if (results.length === 0) return 0;

  const today = getQuizDate();

  if (results[0].quiz_date !== today) {
    return 0;
  }

  let streak = 1;
  let expectedDate = today;

  for (let i = 1; i < results.length; i++) {
    expectedDate = getPreviousQuizDate(expectedDate);

    if (results[i].quiz_date === expectedDate) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
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
    const body: MigrateGuestResultRequest = JSON.parse(event.body || '{}');
    const { userId, quizId, score, totalQuestions, answers, userProfile } = body;

    // Validate request
    if (!userId || !quizId || score === undefined || !answers || answers.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    // Don't allow guest user IDs
    if (userId.startsWith('guest_')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Cannot migrate to a guest user' }),
      };
    }

    const authError = await assertAuthorizedUser(event, userId, headers, { allowGuest: false });
    if (authError) {
      return authError;
    }

    const quizDate = quizId.replace('quiz-', '');

    // Check for existing submission (idempotency)
    const existingResult = await query<{ id: string }>(
      `SELECT id FROM results WHERE user_id = $1 AND quiz_id = $2`,
      [userId, quizId]
    );

    if (existingResult.length > 0) {
      // Already migrated or user played independently
      const userStats = await query<DbUser>(
        `SELECT streak, best_score FROM users WHERE id = $1`,
        [userId]
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          migrated: false,
          message: 'Result already exists for this quiz',
          streak: userStats[0]?.streak || 0,
          bestScore: userStats[0]?.best_score || 0,
        }),
      };
    }

    // Upsert user record
    await query(
      `INSERT INTO users (id, display_name, email, avatar_url, created_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (id) DO UPDATE SET
         email = COALESCE(EXCLUDED.email, users.email),
         avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url)`,
      [userId, userProfile?.displayName || null, userProfile?.email || null, userProfile?.avatarUrl || null]
    );

    // Insert result with boolean array
    await query(
      `INSERT INTO results (user_id, quiz_id, quiz_date, score, total_questions, answers)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, quiz_id) DO NOTHING`,
      [userId, quizId, quizDate, score, totalQuestions, answers]
    );

    // Calculate streak
    const newStreak = await calculateStreak(userId);

    // Update user stats
    await query(
      `UPDATE users SET
        streak = $2,
        best_score = GREATEST(best_score, $3),
        total_quizzes = total_quizzes + 1,
        total_correct = total_correct + $4,
        last_played = $5
       WHERE id = $1`,
      [userId, newStreak, score, score, quizDate]
    );

    // Get updated best_score
    const updatedUser = await query<{ best_score: number }>(
      `SELECT best_score FROM users WHERE id = $1`,
      [userId]
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        migrated: true,
        streak: newStreak,
        bestScore: updatedUser[0]?.best_score || score,
      }),
    };
  } catch (error) {
    console.error('Error migrating guest result:', error);
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
