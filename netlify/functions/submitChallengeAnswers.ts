import { Handler } from '@netlify/functions';
import { query } from './lib/db';
import { assertAuthorizedUser } from './lib/auth';

interface SubmitChallengeRequest {
  challengeId: string;
  userId: string;
  answers: {
    questionId: string;
    selectedOptionIndex: number;
    timeRemainingMs?: number;
  }[];
}

interface DbChallenge {
  id: string;
  code: string;
  quiz_id: string;
  quiz_date: string;
  creator_id: string;
  creator_display_name: string | null;
  creator_score: number | null;
  creator_answers: any | null;
  opponent_id: string | null;
  opponent_display_name: string | null;
  opponent_score: number | null;
  opponent_answers: any | null;
  status: string;
  expires_at: string;
  winner_id: string | null;
}

// Calculate points based on time remaining (same as daily quiz)
function calculatePoints(timeRemainingMs: number | undefined): number {
  if (timeRemainingMs === undefined) return 60;
  const seconds = timeRemainingMs / 1000;
  if (seconds >= 16) return 100;
  if (seconds >= 12) return 80;
  if (seconds >= 8) return 60;
  if (seconds >= 4) return 40;
  return 20;
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
    const body: SubmitChallengeRequest = JSON.parse(event.body || '{}');
    const { challengeId, userId, answers } = body;

    if (!challengeId || !userId || !answers || answers.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    const authError = await assertAuthorizedUser(event, userId, headers, { allowGuest: false });
    if (authError) {
      return authError;
    }

    // Fetch challenge
    const challenges = await query<DbChallenge>(
      `SELECT * FROM challenges WHERE id = $1`,
      [challengeId]
    );

    if (challenges.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Challenge not found' }),
      };
    }

    const challenge = challenges[0];

    // Determine if user is creator or opponent
    const isCreator = challenge.creator_id === userId;
    const isOpponent = challenge.opponent_id === userId;

    if (!isCreator && !isOpponent) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'You are not part of this challenge' }),
      };
    }

    // Check if already submitted
    if (isCreator && challenge.creator_score !== null) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: 'You have already submitted answers' }),
      };
    }
    if (isOpponent && challenge.opponent_score !== null) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: 'You have already submitted answers' }),
      };
    }

    // Fetch correct answers from database
    const questionIds = answers.map((a) => a.questionId);
    const correctAnswers = await query<{
      question_id: string;
      player_name: string;
      player_0: string;
      player_1: string;
      player_2: string;
      player_3: string;
    }>(
      `SELECT question_id, player_name, player_0, player_1, player_2, player_3
       FROM public.pu_player_ques
       WHERE question_id = ANY($1)`,
      [questionIds]
    );

    // Calculate score
    let score = 0;
    const detailedAnswers: {
      questionId: string;
      selectedOptionIndex: number;
      correctOptionIndex: number;
      isCorrect: boolean;
    }[] = [];

    for (const userAnswer of answers) {
      const correct = correctAnswers.find((q) => q.question_id === userAnswer.questionId);
      if (!correct) {
        detailedAnswers.push({
          questionId: userAnswer.questionId,
          selectedOptionIndex: userAnswer.selectedOptionIndex,
          correctOptionIndex: 0,
          isCorrect: false,
        });
        continue;
      }

      const options = [correct.player_0, correct.player_1, correct.player_2, correct.player_3].filter(Boolean);
      const correctIndex = options.findIndex((opt) => opt === correct.player_name);
      const isCorrect = userAnswer.selectedOptionIndex === correctIndex;

      if (isCorrect) {
        score += calculatePoints(userAnswer.timeRemainingMs);
      }

      detailedAnswers.push({
        questionId: userAnswer.questionId,
        selectedOptionIndex: userAnswer.selectedOptionIndex,
        correctOptionIndex: correctIndex,
        isCorrect,
      });
    }

    // Update challenge with answers
    if (isCreator) {
      await query(
        `UPDATE challenges SET
          creator_score = $1,
          creator_answers = $2,
          status = CASE WHEN opponent_score IS NOT NULL THEN 'completed' ELSE 'active' END
        WHERE id = $3`,
        [score, JSON.stringify(detailedAnswers), challengeId]
      );
    } else {
      await query(
        `UPDATE challenges SET
          opponent_score = $1,
          opponent_answers = $2,
          status = CASE WHEN creator_score IS NOT NULL THEN 'completed' ELSE status END
        WHERE id = $3`,
        [score, JSON.stringify(detailedAnswers), challengeId]
      );
    }

    // Fetch updated challenge to check if complete
    const updatedChallenges = await query<DbChallenge>(
      `SELECT * FROM challenges WHERE id = $1`,
      [challengeId]
    );
    const updatedChallenge = updatedChallenges[0];

    // If both have submitted, determine winner and update stats
    if (updatedChallenge.creator_score !== null && updatedChallenge.opponent_score !== null) {
      let winnerId: string | null = null;
      let creatorResult: 'win' | 'loss' | 'draw' = 'draw';
      let opponentResult: 'win' | 'loss' | 'draw' = 'draw';

      if (updatedChallenge.creator_score > updatedChallenge.opponent_score) {
        winnerId = updatedChallenge.creator_id;
        creatorResult = 'win';
        opponentResult = 'loss';
      } else if (updatedChallenge.opponent_score > updatedChallenge.creator_score) {
        winnerId = updatedChallenge.opponent_id;
        creatorResult = 'loss';
        opponentResult = 'win';
      }

      // Update challenge with winner and completion time
      await query(
        `UPDATE challenges SET winner_id = $1, completed_at = NOW(), status = 'completed' WHERE id = $2`,
        [winnerId, challengeId]
      );

      // Update stats for Auth0 users only (use upsert in case user doesn't exist yet)
      if (!updatedChallenge.creator_id.startsWith('guest_')) {
        const creatorWins = creatorResult === 'win' ? 1 : 0;
        const creatorLosses = creatorResult === 'loss' ? 1 : 0;
        const creatorDraws = creatorResult === 'draw' ? 1 : 0;
        await query(
          `INSERT INTO users (id, challenge_wins, challenge_losses, challenge_draws)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET
             challenge_wins = users.challenge_wins + $2,
             challenge_losses = users.challenge_losses + $3,
             challenge_draws = users.challenge_draws + $4`,
          [updatedChallenge.creator_id, creatorWins, creatorLosses, creatorDraws]
        );
      }

      if (updatedChallenge.opponent_id && !updatedChallenge.opponent_id.startsWith('guest_')) {
        const opponentWins = opponentResult === 'win' ? 1 : 0;
        const opponentLosses = opponentResult === 'loss' ? 1 : 0;
        const opponentDraws = opponentResult === 'draw' ? 1 : 0;
        await query(
          `INSERT INTO users (id, challenge_wins, challenge_losses, challenge_draws)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET
             challenge_wins = users.challenge_wins + $2,
             challenge_losses = users.challenge_losses + $3,
             challenge_draws = users.challenge_draws + $4`,
          [updatedChallenge.opponent_id, opponentWins, opponentLosses, opponentDraws]
        );
      }

      // Return complete result
      const myResult = isCreator ? creatorResult : opponentResult;
      const myScore = isCreator ? updatedChallenge.creator_score : updatedChallenge.opponent_score;
      const theirScore = isCreator ? updatedChallenge.opponent_score : updatedChallenge.creator_score;
      const theirDisplayName = isCreator ? updatedChallenge.opponent_display_name : updatedChallenge.creator_display_name;
      const theirAnswers = isCreator ? updatedChallenge.opponent_answers : updatedChallenge.creator_answers;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'complete',
          result: myResult,
          yourScore: myScore,
          opponentScore: theirScore,
          opponentDisplayName: theirDisplayName,
          yourAnswers: detailedAnswers,
          opponentAnswers: typeof theirAnswers === 'string' ? JSON.parse(theirAnswers) : theirAnswers,
        }),
      };
    }

    // Challenge not complete yet - waiting for other player
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'waiting',
        yourScore: score,
        yourAnswers: detailedAnswers,
      }),
    };
  } catch (error) {
    console.error('Error submitting challenge answers:', error);
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
