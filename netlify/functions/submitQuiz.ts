import { Handler } from '@netlify/functions';
import { query } from './lib/db';

interface SubmitQuizRequest {
  quizId: string;
  userId: string;
  answers: {
    questionId: string;
    selectedOptionIndex: number;
    timeRemainingMs?: number;
  }[];
  userProfile?: {
    displayName?: string;
    email?: string;
    avatarUrl?: string;
  };
}

// Calculate points based on time remaining (correct answers only)
// Max 100 points per question, 500 total for 5 questions
function calculatePoints(timeRemainingMs: number | undefined): number {
  if (timeRemainingMs === undefined) return 60; // Default for legacy submissions
  const seconds = timeRemainingMs / 1000;
  if (seconds >= 16) return 100; // Lightning
  if (seconds >= 12) return 80;  // Quick
  if (seconds >= 8) return 60;   // Steady
  if (seconds >= 4) return 40;   // Careful
  return 20;                      // Slow (including timer expired)
}

interface DbResult {
  id: string;
  user_id: string;
  quiz_id: string;
  quiz_date: string;
  score: number;
  total_questions: number;
  answers: boolean[];
  created_at: string;
}

interface DbUser {
  id: string;
  streak: number;
  best_score: number;
}

// Calculate streak: count consecutive days ending with today
async function calculateStreak(userId: string): Promise<number> {
  // Get all quiz dates for this user, ordered descending
  const results = await query<{ quiz_date: string }>(
    `SELECT DISTINCT quiz_date::TEXT as quiz_date
     FROM results
     WHERE user_id = $1
     ORDER BY quiz_date DESC`,
    [userId]
  );

  if (results.length === 0) return 0;

  // Get today's date in UTC
  const today = new Date().toISOString().split('T')[0];

  // Check if most recent play is today
  if (results[0].quiz_date !== today) {
    return 0; // Streak broken - didn't play today
  }

  // Count consecutive days from today backwards
  let streak = 1;
  let expectedDate = new Date(today);

  for (let i = 1; i < results.length; i++) {
    expectedDate.setDate(expectedDate.getDate() - 1);
    const expectedDateStr = expectedDate.toISOString().split('T')[0];

    if (results[i].quiz_date === expectedDateStr) {
      streak++;
    } else {
      break; // Gap found, streak ends
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
    const body: SubmitQuizRequest = JSON.parse(event.body || '{}');
    const { quizId, userId, answers, userProfile } = body;

    if (!quizId || !userId || !answers || answers.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }


    if (!Array.isArray(answers)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'answers must be an array' }),
      };
    }

    if (answers.length > 5) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Too many answers submitted' }),
      };
    }

    const seenQuestionIds = new Set<string>();
    for (const answer of answers) {
      if (!answer?.questionId || typeof answer.selectedOptionIndex !== 'number') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Each answer must include questionId and selectedOptionIndex' }),
        };
      }

      if (!Number.isInteger(answer.selectedOptionIndex) || answer.selectedOptionIndex < 0 || answer.selectedOptionIndex > 3) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'selectedOptionIndex must be an integer between 0 and 3' }),
        };
      }

      if (answer.timeRemainingMs !== undefined && (!Number.isFinite(answer.timeRemainingMs) || answer.timeRemainingMs < 0 || answer.timeRemainingMs > 20_000)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'timeRemainingMs must be between 0 and 20000' }),
        };
      }

      if (seenQuestionIds.has(answer.questionId)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Duplicate questionId in answers' }),
        };
      }
      seenQuestionIds.add(answer.questionId);
    }
    // Fetch correct answers from database
    const questionIds = answers.map((a) => a.questionId);
    const correctAnswers = await query<{
      question_id: string;
      player_id: string;
      player_name: string;
      player_0: string;
      player_1: string;
      player_2: string;
      player_3: string;
    }>(
      `SELECT question_id, player_id, player_name, player_0, player_1, player_2, player_3
       FROM public.pu_player_ques
       WHERE question_id = ANY($1)`,
      [questionIds]
    );

    // Calculate score and build both detailed and boolean answers
    // Score is now speed-based: 0-100 points per question, max 500 total
    let score = 0;
    const detailedAnswers: {
      questionId: string;
      selectedOptionIndex: number;
      correctOptionIndex: number;
      isCorrect: boolean;
    }[] = [];
    const answersCorrect: boolean[] = [];

    for (const userAnswer of answers) {
      const correct = correctAnswers.find((q) => q.question_id === userAnswer.questionId);
      if (!correct) {
        detailedAnswers.push({
          questionId: userAnswer.questionId,
          selectedOptionIndex: userAnswer.selectedOptionIndex,
          correctOptionIndex: 0,
          isCorrect: false,
        });
        answersCorrect.push(false);
        continue;
      }

      const options = [correct.player_0, correct.player_1, correct.player_2, correct.player_3].filter(Boolean);
      if (userAnswer.selectedOptionIndex >= options.length) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `selectedOptionIndex out of bounds for question ${userAnswer.questionId}` }),
        };
      }

      const correctIndex = options.findIndex((opt) => opt === correct.player_name);
      const isCorrect = userAnswer.selectedOptionIndex === correctIndex;

      if (isCorrect) {
        // Award points based on time remaining
        const points = calculatePoints(userAnswer.timeRemainingMs);
        score += points;
      }

      detailedAnswers.push({
        questionId: userAnswer.questionId,
        selectedOptionIndex: userAnswer.selectedOptionIndex,
        correctOptionIndex: correctIndex,
        isCorrect,
      });
      answersCorrect.push(isCorrect);
    }

    const quizDate = quizId.replace('quiz-', '');

    // Guest users: no database interaction, return placeholder response
    if (userId.startsWith('guest_')) {
      const result = {
        date: quizDate,
        quizId,
        score,
        totalQuestions: answers.length,
        answers: detailedAnswers,  // Return detailed for immediate display
        streak: 1,
        bestScore: score,
      };

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result),
      };
    }

    // Auth0 users: check for existing submission (idempotency)
    const existingResult = await query<DbResult>(
      `SELECT * FROM results WHERE user_id = $1 AND quiz_id = $2`,
      [userId, quizId]
    );

    if (existingResult.length > 0) {
      // Return cached result with current user stats
      const userStats = await query<DbUser>(
        `SELECT streak, best_score FROM users WHERE id = $1`,
        [userId]
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          date: existingResult[0].quiz_date,
          quizId: existingResult[0].quiz_id,
          score: existingResult[0].score,
          totalQuestions: existingResult[0].total_questions,
          answers: existingResult[0].answers,
          streak: userStats[0]?.streak || 0,
          bestScore: userStats[0]?.best_score || 0,
        }),
      };
    }

    // Upsert user record (create if new, update email/avatar if existing)
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
      [userId, quizId, quizDate, score, answers.length, answersCorrect]
    );

    // Calculate streak (after inserting today's result)
    const newStreak = await calculateStreak(userId);

    const correctCount = answersCorrect.filter(Boolean).length;

    // Update user stats
    await query(
      `UPDATE users SET
        streak = $2,
        best_score = GREATEST(best_score, $3),
        total_quizzes = total_quizzes + 1,
        total_correct = total_correct + $4,
        last_played = $5
       WHERE id = $1`,
      [userId, newStreak, score, correctCount, quizDate]
    );

    // Get updated best_score
    const updatedUser = await query<{ best_score: number }>(
      `SELECT best_score FROM users WHERE id = $1`,
      [userId]
    );

    const result = {
      date: quizDate,
      quizId,
      score,
      totalQuestions: answers.length,
      answers: detailedAnswers,  // Return detailed for immediate display
      streak: newStreak,
      bestScore: updatedUser[0]?.best_score || score,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('Error submitting quiz:', error);
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
