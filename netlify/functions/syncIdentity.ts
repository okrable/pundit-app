import type { Handler } from '@netlify/functions';
import { authorizeUser } from './lib/auth';
import {
  syncIdentityRecord,
  type IdentityIntent,
} from './lib/identity';

const VALID_INTENTS = new Set<IdentityIntent>(['signup', 'login', 'restore']);

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
    const { userId, intent } = JSON.parse(event.body || '{}') as {
      userId?: string;
      intent?: IdentityIntent;
    };

    if (!userId || !intent || !VALID_INTENTS.has(intent)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'userId and a valid intent are required' }),
      };
    }

    if (userId.startsWith('guest_')) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Guest identities cannot be synchronized' }),
      };
    }

    const authorization = await authorizeUser(event, userId, headers);
    if (authorization.response) {
      return authorization.response;
    }

    const identity = await syncIdentityRecord(authorization.user, intent);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(identity),
    };
  } catch (error) {
    console.error('[api.identity.sync.error]', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Unable to synchronize identity' }),
    };
  }
};
