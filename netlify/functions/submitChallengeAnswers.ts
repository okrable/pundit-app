import { Handler } from '@netlify/functions';
import { query, queryWithClient, withTransaction } from './lib/db';
import { assertAuthorizedUser } from './lib/auth';
import { createRequestId, logRequestEnd, logRequestError, logRequestStart } from './lib/observability';
import { calculateQuizPoints } from '../../shared/scoring';
import { validateSubmittedAnswers } from '../../shared/submissionValidation';
import { enforceRateLimit } from './lib/rateLimit';

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

interface CorrectAnswerRow {
  question_id: string;
  player_name: string;
  player_0: string;
  player_1: string;
  player_2: string;
  player_3: string;
}

type ChallengeResult = 'win' | 'loss' | 'draw';
type WinnerRef = 'creator' | 'opponent' | null;

function buildBadRequest(headers: Record<string, string>, error: string) {
  return {
    statusCode: 400,
    headers,
    body: JSON.stringify({ error }),
  };
}

function getChallengeResults(
  creatorScore: number,
  opponentScore: number
): {
  winnerId: WinnerRef;
  creatorResult: ChallengeResult;
  opponentResult: ChallengeResult;
} {
  if (creatorScore > opponentScore) {
    return {
      winnerId: 'creator',
      creatorResult: 'win',
      opponentResult: 'loss',
    };
  }

  if (opponentScore > creatorScore) {
    return {
      winnerId: 'opponent',
      creatorResult: 'loss',
      opponentResult: 'win',
    };
  }

  return {
    winnerId: null,
    creatorResult: 'draw',
    opponentResult: 'draw',
  };
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

  const requestStartedAt = Date.now();
  const requestId = createRequestId();

  try {
    const body: SubmitChallengeRequest = JSON.parse(event.body || '{}');
    const { challengeId, userId, answers } = body;

    logRequestStart({ endpoint: 'submitChallengeAnswers', requestId, userId });

    if (!challengeId || !userId) {
      return buildBadRequest(headers, 'Missing required fields');
    }

    const validationError = validateSubmittedAnswers(answers);
    if (validationError) {
      return buildBadRequest(headers, validationError);
    }

    const authError = await assertAuthorizedUser(event, userId, headers, { allowGuest: false });
    if (authError) {
      return authError;
    }

    const rateLimitError = await enforceRateLimit(event, headers, {
      scope: 'submit-challenge',
      subject: userId,
      limit: 12,
      windowSeconds: 300,
    });
    if (rateLimitError) {
      return rateLimitError;
    }

    // Fetch correct answers from database
    const questionIds = answers.map((a) => a.questionId);
    const correctAnswers = await query<CorrectAnswerRow>(
      `SELECT question_id, player_name, player_0, player_1, player_2, player_3
       FROM public.pu_player_ques
       WHERE question_id = ANY($1)`,
      [questionIds]
    );
    const correctAnswersById = new Map(correctAnswers.map((row) => [row.question_id, row]));

    // Calculate score
    let score = 0;
    const detailedAnswers: {
      questionId: string;
      selectedOptionIndex: number;
      correctOptionIndex: number;
      isCorrect: boolean;
    }[] = [];

    for (const userAnswer of answers) {
      const correct = correctAnswersById.get(userAnswer.questionId);
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
      if (userAnswer.selectedOptionIndex >= options.length) {
        return buildBadRequest(headers, `selectedOptionIndex out of bounds for question ${userAnswer.questionId}`);
      }

      const correctIndex = options.findIndex((opt) => opt === correct.player_name);
      const isCorrect = userAnswer.selectedOptionIndex === correctIndex;

      if (isCorrect) {
        score += calculateQuizPoints(userAnswer.timeRemainingMs);
      }

      detailedAnswers.push({
        questionId: userAnswer.questionId,
        selectedOptionIndex: userAnswer.selectedOptionIndex,
        correctOptionIndex: correctIndex,
        isCorrect,
      });
    }

    const transactionResult = await withTransaction(async (client) => {
      const challenges = await queryWithClient<DbChallenge>(
        client,
        `SELECT * FROM challenges WHERE id = $1`,
        [challengeId]
      );

      if (challenges.length === 0) {
        return { kind: 'not_found' as const };
      }

      const challenge = challenges[0];
      const isCreator = challenge.creator_id === userId;
      const isOpponent = challenge.opponent_id === userId;

      if (!isCreator && !isOpponent) {
        return { kind: 'not_participant' as const };
      }

      if (challenge.status === 'revoked' || challenge.status === 'expired') {
        return { kind: 'unavailable' as const, status: challenge.status };
      }

      if (new Date(challenge.expires_at) < new Date() && challenge.status !== 'completed') {
        await queryWithClient(client, `UPDATE challenges SET status = 'expired' WHERE id = $1`, [challengeId]);
        return { kind: 'unavailable' as const, status: 'expired' };
      }

      if ((isCreator && challenge.creator_score !== null) || (isOpponent && challenge.opponent_score !== null)) {
        return {
          kind: 'submitted' as const,
          challenge,
          isCreator,
          replayed: true,
        };
      }

      const submittedChallenges = isCreator
        ? await queryWithClient<DbChallenge>(
            client,
            `UPDATE challenges SET
              creator_score = $1,
              creator_answers = $2,
              status = CASE
                WHEN opponent_score IS NOT NULL THEN 'completed'
                WHEN opponent_id IS NOT NULL THEN 'active'
                ELSE status
              END
             WHERE id = $3
             AND creator_id = $4
             AND creator_score IS NULL
             RETURNING *`,
            [score, JSON.stringify(detailedAnswers), challengeId, userId]
          )
        : await queryWithClient<DbChallenge>(
            client,
            `UPDATE challenges SET
              opponent_score = $1,
              opponent_answers = $2,
              status = CASE WHEN creator_score IS NOT NULL THEN 'completed' ELSE status END
             WHERE id = $3
             AND opponent_id = $4
             AND opponent_score IS NULL
             RETURNING *`,
            [score, JSON.stringify(detailedAnswers), challengeId, userId]
          );

      if (submittedChallenges.length === 0) {
        const replayedChallenges = await queryWithClient<DbChallenge>(
          client,
          `SELECT * FROM challenges WHERE id = $1`,
          [challengeId]
        );
        return {
          kind: 'submitted' as const,
          challenge: replayedChallenges[0] || challenge,
          isCreator,
          replayed: true,
        };
      }

      let updatedChallenge = submittedChallenges[0];
      if (updatedChallenge.creator_score !== null && updatedChallenge.opponent_score !== null) {
        const result = getChallengeResults(updatedChallenge.creator_score, updatedChallenge.opponent_score);
        const winnerId =
          result.winnerId === 'creator'
            ? updatedChallenge.creator_id
            : result.winnerId === 'opponent'
            ? updatedChallenge.opponent_id
            : null;

        const completedChallenges = await queryWithClient<DbChallenge>(
          client,
          `UPDATE challenges
           SET winner_id = $1, completed_at = NOW(), status = 'completed'
           WHERE id = $2
           AND completed_at IS NULL
           AND creator_score IS NOT NULL
           AND opponent_score IS NOT NULL
           RETURNING *`,
          [winnerId, challengeId]
        );

        if (completedChallenges.length > 0) {
          updatedChallenge = completedChallenges[0];

          const creatorWins = result.creatorResult === 'win' ? 1 : 0;
          const creatorLosses = result.creatorResult === 'loss' ? 1 : 0;
          const creatorDraws = result.creatorResult === 'draw' ? 1 : 0;
          await queryWithClient(
            client,
            `INSERT INTO users (id, challenge_wins, challenge_losses, challenge_draws)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE SET
               challenge_wins = users.challenge_wins + $2,
               challenge_losses = users.challenge_losses + $3,
               challenge_draws = users.challenge_draws + $4`,
            [updatedChallenge.creator_id, creatorWins, creatorLosses, creatorDraws]
          );

          if (updatedChallenge.opponent_id) {
            const opponentWins = result.opponentResult === 'win' ? 1 : 0;
            const opponentLosses = result.opponentResult === 'loss' ? 1 : 0;
            const opponentDraws = result.opponentResult === 'draw' ? 1 : 0;
            await queryWithClient(
              client,
              `INSERT INTO users (id, challenge_wins, challenge_losses, challenge_draws)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (id) DO UPDATE SET
                 challenge_wins = users.challenge_wins + $2,
                 challenge_losses = users.challenge_losses + $3,
                 challenge_draws = users.challenge_draws + $4`,
              [updatedChallenge.opponent_id, opponentWins, opponentLosses, opponentDraws]
            );
          }
        }
      }

      return {
        kind: 'submitted' as const,
        challenge: updatedChallenge,
        isCreator,
        replayed: false,
      };
    });

    if (transactionResult.kind === 'not_found') {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Challenge not found' }),
      };
    }

    if (transactionResult.kind === 'not_participant') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'You are not part of this challenge' }),
      };
    }

    if (transactionResult.kind === 'unavailable') {
      return {
        statusCode: 410,
        headers,
        body: JSON.stringify({ error: `Challenge is ${transactionResult.status}` }),
      };
    }

    const updatedChallenge = transactionResult.challenge;
    const isCreator = transactionResult.isCreator;
    const storedAnswers = isCreator
      ? updatedChallenge.creator_answers
      : updatedChallenge.opponent_answers;
    const myAnswers =
      typeof storedAnswers === 'string'
        ? JSON.parse(storedAnswers)
        : storedAnswers || detailedAnswers;
    const myStoredScore = isCreator
      ? updatedChallenge.creator_score
      : updatedChallenge.opponent_score;

    // If both have submitted, return the completed challenge result.
    if (updatedChallenge.creator_score !== null && updatedChallenge.opponent_score !== null) {
      const result = getChallengeResults(updatedChallenge.creator_score, updatedChallenge.opponent_score);
      const creatorResult = result.creatorResult;
      const opponentResult = result.opponentResult;

      // Return complete result
      const myResult = isCreator ? creatorResult : opponentResult;
      const myScore = myStoredScore ?? score;
      const theirScore = isCreator ? updatedChallenge.opponent_score : updatedChallenge.creator_score;
      const theirDisplayName = isCreator ? updatedChallenge.opponent_display_name : updatedChallenge.creator_display_name;
      const theirAnswers = isCreator ? updatedChallenge.opponent_answers : updatedChallenge.creator_answers;

      logRequestEnd({ endpoint: 'submitChallengeAnswers', requestId, userId }, Date.now() - requestStartedAt, 200);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'complete',
          result: myResult,
          yourScore: myScore,
          opponentScore: theirScore,
          opponentDisplayName: theirDisplayName,
          yourAnswers: myAnswers,
          opponentAnswers: typeof theirAnswers === 'string' ? JSON.parse(theirAnswers) : theirAnswers,
        }),
      };
    }

    // Challenge not complete yet - waiting for other player
    logRequestEnd({ endpoint: 'submitChallengeAnswers', requestId, userId }, Date.now() - requestStartedAt, 200);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'waiting',
        yourScore: myStoredScore ?? score,
        yourAnswers: myAnswers,
      }),
    };
  } catch (error) {
    logRequestError({ endpoint: 'submitChallengeAnswers', requestId }, Date.now() - requestStartedAt, error);
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
