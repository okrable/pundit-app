import { withLambda, type LambdaHandler } from '@netlify/aws-lambda-compat';
import { query } from './lib/db';
import { enforceRateLimit } from './lib/rateLimit';
import { requireCompletedIdentity } from './lib/identity';
import {
  getCompatibilityPlayerName,
  resolveChallengeIdentity,
} from './lib/challengeIdentity';
import { getDailyQuestionRows, QuestionSourceError } from './lib/questionSource';
import { formatDailyQuizQuestions } from './lib/dailyQuizResponse';
import { getChallengeUnavailableResponse } from './lib/challengeAvailability';

interface JoinChallengeRequest {
  code: string;
  userId: string;
  /** @deprecated The server resolves public identity from the bearer token. */
  displayName?: string;
  /** @deprecated The server resolves public identity from the bearer token. */
  username?: string;
}

interface DbChallenge {
  id: string;
  code: string;
  quiz_id: string;
  quiz_date: string;
  creator_id: string;
  creator_display_name: string | null;
  creator_username: string | null;
  opponent_id: string | null;
  opponent_username: string | null;
  status: string;
  expires_at: string;
}

const handler: LambdaHandler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  const unavailable = getChallengeUnavailableResponse(headers);
  if (unavailable) return unavailable;

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
    const body: JoinChallengeRequest = JSON.parse(event.body || '{}');
    const { code, userId } = body;

    if (!code || !userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing code or userId' }),
      };
    }

    // Guest users cannot join challenges
    if (userId.startsWith('guest_')) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Please sign in to join challenges' }),
      };
    }

    const identity = await requireCompletedIdentity(event, userId, headers);
    if (identity.response) {
      return identity.response;
    }

    const rateLimitError = await enforceRateLimit(event, headers, {
      scope: 'join-challenge',
      subject: userId,
      limit: 20,
      windowSeconds: 300,
    });
    if (rateLimitError) {
      return rateLimitError;
    }

    const challengeCode = code.toUpperCase();
    const availableChallenges = await query<DbChallenge>(
      `SELECT * FROM challenges WHERE code = $1`,
      [challengeCode]
    );
    if (availableChallenges.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Challenge not found' }),
      };
    }

    const availableChallenge = availableChallenges[0];
    if (availableChallenge.creator_id === userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Cannot join your own challenge' }),
      };
    }
    if (availableChallenge.opponent_id !== null) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: 'Challenge already has an opponent' }),
      };
    }
    if (new Date(availableChallenge.expires_at) < new Date()) {
      return {
        statusCode: 410,
        headers,
        body: JSON.stringify({ error: 'Challenge has expired' }),
      };
    }
    if (!['pending', 'active'].includes(availableChallenge.status)) {
      return {
        statusCode: 410,
        headers,
        body: JSON.stringify({ error: `Challenge is ${availableChallenge.status}` }),
      };
    }

    // Read the immutable daily bundle before claiming the opponent slot. A source
    // outage therefore leaves the challenge safely retryable.
    const questions = await getDailyQuestionRows(availableChallenge.quiz_date, 'uk');

    // Atomic update: only succeeds if challenge exists, has no opponent, is joinable, not expired, and user isn't creator
    // This prevents race conditions when multiple users try to join simultaneously
    const updateResult = await query<DbChallenge>(
      `UPDATE challenges
       SET opponent_id = $1, opponent_display_name = $2, opponent_username = $3, status = 'active'
       WHERE code = $4
       AND opponent_id IS NULL
       AND status IN ('pending', 'active')
       AND expires_at > NOW()
       AND creator_id != $1
       RETURNING *`,
      [userId, identity.identity.username, identity.identity.username, challengeCode]
    );

    let challenge: DbChallenge;

    if (updateResult.length === 0) {
      // Update failed - determine specific error by checking the challenge
      const challenges = await query<DbChallenge>(
        `SELECT * FROM challenges WHERE code = $1`,
        [challengeCode]
      );

      if (challenges.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Challenge not found' }),
        };
      }

      const existingChallenge = challenges[0];

      if (existingChallenge.opponent_id !== null) {
        return {
          statusCode: 409,
          headers,
          body: JSON.stringify({ error: 'Challenge already has an opponent' }),
        };
      }

      if (existingChallenge.creator_id === userId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Cannot join your own challenge' }),
        };
      }

      if (new Date(existingChallenge.expires_at) < new Date()) {
        return {
          statusCode: 410,
          headers,
          body: JSON.stringify({ error: 'Challenge has expired' }),
        };
      }

      if (existingChallenge.status !== 'pending' && existingChallenge.status !== 'active') {
        return {
          statusCode: 410,
          headers,
          body: JSON.stringify({ error: `Challenge is ${existingChallenge.status}` }),
        };
      }

      // Fallback error
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Challenge is not available' }),
      };
    }

    // Success - we atomically claimed the opponent spot
    challenge = updateResult[0];

    // Format questions for response
    const formattedQuestions = formatDailyQuizQuestions(questions);

    const creatorUsers = await query<{ username: string | null }>(
      `SELECT username
       FROM users
       WHERE id = $1 AND onboarding_status = 'complete'`,
      [challenge.creator_id]
    );
    const creatorIdentity = resolveChallengeIdentity(
      challenge.creator_id,
      creatorUsers[0]?.username || null,
      challenge.creator_username
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        challengeId: challenge.id,
        creator: {
          userId: challenge.creator_id,
          username: creatorIdentity?.username || null,
          legacyLabel: creatorIdentity?.legacyLabel || null,
          isLegacyGuest: creatorIdentity?.isLegacyGuest || false,
          // Deprecated compatibility field for installed clients.
          displayName: getCompatibilityPlayerName(creatorIdentity),
        },
        creatorUsername: creatorIdentity?.username || null,
        opponentUsername: identity.identity.username,
        questions: formattedQuestions,
      }),
    };
  } catch (error) {
    console.error('Error joining challenge:', error);
    return {
      statusCode: error instanceof QuestionSourceError ? 503 : 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

export default withLambda(handler);
