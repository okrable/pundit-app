import { withLambda, type LambdaHandler } from '@netlify/aws-lambda-compat';
import { query } from './lib/db';
import { enforceRateLimit } from './lib/rateLimit';

// Username validation rules:
// - 3-20 characters
// - Lowercase letters, numbers, underscores only
// - No leading/trailing underscore
const USERNAME_REGEX = /^[a-z0-9][a-z0-9_]{1,18}[a-z0-9]$/;
const MIN_LENGTH = 3;
const MAX_LENGTH = 20;

const handler: LambdaHandler = async (event) => {
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
    const { username } = event.queryStringParameters || {};

    if (!username) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ available: false, error: 'Username is required' }),
      };
    }

    const rateLimitError = await enforceRateLimit(event, headers, {
      scope: 'check-username',
      limit: 30,
      windowSeconds: 60,
    });
    if (rateLimitError) {
      return rateLimitError;
    }

    // Normalize for validation
    const normalized = username.toLowerCase().trim();

    // Validate length
    if (normalized.length < MIN_LENGTH) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          available: false,
          error: `Username must be at least ${MIN_LENGTH} characters`,
        }),
      };
    }

    if (normalized.length > MAX_LENGTH) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          available: false,
          error: `Username must be at most ${MAX_LENGTH} characters`,
        }),
      };
    }

    // Validate format
    if (!USERNAME_REGEX.test(normalized)) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          available: false,
          error: 'Only lowercase letters, numbers, and underscores (not at start/end)',
        }),
      };
    }

    // Check availability in database
    const existing = await query<{ id: string }>(
      'SELECT id FROM users WHERE username_normalized = $1',
      [normalized]
    );

    const available = existing.length === 0;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        available,
        error: available ? undefined : 'Username is already taken',
      }),
    };
  } catch (error) {
    console.error('Error checking username:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        available: false,
        error: 'Internal server error',
      }),
    };
  }
};

export default withLambda(handler);
