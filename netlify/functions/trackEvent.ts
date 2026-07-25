import type { Config, Context } from '@netlify/functions';
import { query } from './lib/db';
import { consumeRateLimit } from './lib/rateLimit';

const ALLOWED_EVENTS = new Set([
  'quiz_started',
  'quiz_completed',
  'auth_completed',
  'challenge_created',
  'challenge_joined',
  'challenge_submitted',
]);

const ALLOWED_ACTOR_TYPES = new Set(['guest', 'authenticated']);
const ALLOWED_PLATFORMS = new Set(['ios', 'android', 'web']);
const ALLOWED_ENVIRONMENTS = new Set(['production', 'preview', 'local']);

interface AnalyticsPayload {
  eventName?: string;
  actorType?: string;
  platform?: string;
  appVersion?: string;
  appEnvironment?: string;
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}

export default async function trackEvent(
  request: Request,
  context: Context
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return jsonResponse(200, {});
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const startedAt = Date.now();
  const requestId = context.requestId;

  try {
    const clientAddress =
      request.headers.get('x-nf-client-connection-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown';
    const rateLimit = await consumeRateLimit({
      scope: 'track-event',
      subject: clientAddress,
      limit: 120,
      windowSeconds: 60,
    });
    if (!rateLimit.allowed) {
      return jsonResponse(429, {
        error: 'Too many requests',
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }

    const payload = (await request.json()) as AnalyticsPayload;
    const {
      eventName,
      actorType,
      platform,
      appVersion,
      appEnvironment,
    } = payload;

    if (
      !eventName ||
      !ALLOWED_EVENTS.has(eventName) ||
      !actorType ||
      !ALLOWED_ACTOR_TYPES.has(actorType) ||
      !platform ||
      !ALLOWED_PLATFORMS.has(platform) ||
      !appVersion ||
      appVersion.length > 20 ||
      !appEnvironment ||
      !ALLOWED_ENVIRONMENTS.has(appEnvironment)
    ) {
      return jsonResponse(400, { error: 'Invalid analytics event' });
    }

    await query(
      `INSERT INTO analytics_events (
         event_name,
         actor_type,
         platform,
         app_version,
         app_environment
       )
       VALUES ($1, $2, $3, $4, $5)`,
      [eventName, actorType, platform, appVersion, appEnvironment]
    );

    console.info(
      '[api.analytics.accepted]',
      JSON.stringify({
        requestId,
        eventName,
        durationMs: Date.now() - startedAt,
      })
    );

    return jsonResponse(202, { accepted: true });
  } catch (error) {
    console.error(
      '[api.analytics.error]',
      JSON.stringify({
        requestId,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return jsonResponse(500, { error: 'Unable to record analytics event' });
  }
}

export const config: Config = {
  method: ['POST', 'OPTIONS'],
};
