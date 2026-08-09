import type { Handler } from '@netlify/functions';
import { authorizeUser } from './lib/auth';
import {
  syncIdentityRecord,
  type IdentityIntent,
} from './lib/identity';
import {
  createRequestId,
  logRequestEnd,
  logRequestError,
  logRequestStart,
  type LogContext,
} from './lib/observability';

const VALID_INTENTS = new Set<IdentityIntent>(['signup', 'login', 'restore']);

type IdentityPhase = 'auth' | 'db';

interface PhaseTiming {
  name: IdentityPhase | 'total';
  durationMs: number;
}

function buildServerTimingHeader(timings: PhaseTiming[]): string {
  return timings
    .map(({ name, durationMs }) => `${name};dur=${durationMs}`)
    .join(', ');
}

function logIdentityTimings(
  context: LogContext,
  statusCode: number,
  timings: PhaseTiming[],
  isError = false
) {
  const payload = JSON.stringify({
    ...context,
    statusCode,
    timings,
  });

  if (isError) {
    console.error('[api.identity.sync.timing]', payload);
    return;
  }

  console.info('[api.identity.sync.timing]', payload);
}

export const handler: Handler = async (event) => {
  const requestStartedAt = Date.now();
  const requestId = createRequestId();
  const timings: PhaseTiming[] = [];
  let activePhase: IdentityPhase | null = null;
  let phaseStartedAt = requestStartedAt;
  let userId: string | undefined;
  const requestContext = (): LogContext => ({
    endpoint: 'syncIdentity',
    requestId,
    ...(userId ? { userId } : {}),
  });
  const startPhase = (phase: IdentityPhase) => {
    activePhase = phase;
    phaseStartedAt = Date.now();
  };
  const finishPhase = () => {
    if (!activePhase) {
      return;
    }

    timings.push({
      name: activePhase,
      durationMs: Date.now() - phaseStartedAt,
    });
    activePhase = null;
  };
  const finishTimings = () => {
    finishPhase();
    timings.push({
      name: 'total',
      durationMs: Date.now() - requestStartedAt,
    });
  };
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Expose-Headers': 'Server-Timing, X-Request-ID',
    'X-Request-ID': requestId,
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
    const body = JSON.parse(event.body || '{}') as {
      userId?: string;
      intent?: IdentityIntent;
    };
    userId = body.userId;
    const { intent } = body;

    if (!userId || !intent || !VALID_INTENTS.has(intent)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'userId and a valid intent are required' }),
      };
    }

    logRequestStart(requestContext());

    if (userId.startsWith('guest_')) {
      finishTimings();
      const context = requestContext();
      logRequestEnd(context, Date.now() - requestStartedAt, 403);
      logIdentityTimings(context, 403, timings);
      return {
        statusCode: 403,
        headers: {
          ...headers,
          'Server-Timing': buildServerTimingHeader(timings),
        },
        body: JSON.stringify({ error: 'Guest identities cannot be synchronized' }),
      };
    }

    startPhase('auth');
    const authorization = await authorizeUser(event, userId, headers);
    finishPhase();
    if (authorization.response) {
      finishTimings();
      const context = requestContext();
      logRequestEnd(
        context,
        Date.now() - requestStartedAt,
        authorization.response.statusCode
      );
      logIdentityTimings(context, authorization.response.statusCode, timings);
      return {
        ...authorization.response,
        headers: {
          ...headers,
          ...authorization.response.headers,
          'Server-Timing': buildServerTimingHeader(timings),
        },
      };
    }

    startPhase('db');
    const identity = await syncIdentityRecord(authorization.user, intent);
    finishPhase();
    finishTimings();
    const context = requestContext();
    logRequestEnd(context, Date.now() - requestStartedAt, 200);
    logIdentityTimings(context, 200, timings);
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Server-Timing': buildServerTimingHeader(timings),
      },
      body: JSON.stringify(identity),
    };
  } catch (error) {
    finishTimings();
    const context = requestContext();
    logRequestError(context, Date.now() - requestStartedAt, error);
    logIdentityTimings(context, 500, timings, true);
    return {
      statusCode: 500,
      headers: {
        ...headers,
        'Server-Timing': buildServerTimingHeader(timings),
      },
      body: JSON.stringify({ error: 'Unable to synchronize identity' }),
    };
  }
};
