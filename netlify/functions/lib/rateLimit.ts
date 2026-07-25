import { createHash } from 'node:crypto';
import type { HandlerEvent, HandlerResponse } from '@netlify/functions';
import { query } from './db';

interface RateLimitOptions {
  scope: string;
  subject?: string | null;
  limit: number;
  windowSeconds: number;
}

interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface RateLimitRow {
  request_count: number;
}

function getClientAddress(event: HandlerEvent): string {
  return (
    event.headers['x-nf-client-connection-ip'] ||
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers['client-ip'] ||
    'unknown'
  );
}

function hashRateKey(scope: string, subject: string): string {
  return createHash('sha256').update(`${scope}:${subject}`).digest('hex');
}

export async function enforceRateLimit(
  event: HandlerEvent,
  headers: Record<string, string>,
  options: RateLimitOptions
): Promise<HandlerResponse | null> {
  const subject = options.subject || getClientAddress(event);
  const result = await consumeRateLimit({
    ...options,
    subject,
  });

  if (result.allowed) {
    return null;
  }

  return {
    statusCode: 429,
    headers: {
      ...headers,
      'Retry-After': String(result.retryAfterSeconds),
      'X-RateLimit-Limit': String(options.limit),
      'X-RateLimit-Remaining': '0',
    },
    body: JSON.stringify({
      error: 'Too many requests. Please wait and try again.',
      retryAfterSeconds: result.retryAfterSeconds,
    }),
  };
}

export async function consumeRateLimit(
  options: RateLimitOptions & { subject: string }
): Promise<RateLimitResult> {
  const rateKey = hashRateKey(options.scope, options.subject);
  const windowMs = options.windowSeconds * 1000;
  const windowStartedAt = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const expiresAt = new Date(windowStartedAt.getTime() + windowMs * 2);

  try {
    const rows = await query<RateLimitRow>(
      `INSERT INTO api_rate_limits (
         rate_key,
         window_started_at,
         request_count,
         expires_at
       )
       VALUES ($1, $2, 1, $3)
       ON CONFLICT (rate_key, window_started_at)
       DO UPDATE SET
         request_count = api_rate_limits.request_count + 1,
         expires_at = $3
       RETURNING request_count`,
      [rateKey, windowStartedAt.toISOString(), expiresAt.toISOString()]
    );

    const requestCount = Number(rows[0]?.request_count || 1);
    if (requestCount <= options.limit) {
      return { allowed: true, retryAfterSeconds: 0 };
    }

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((windowStartedAt.getTime() + windowMs - Date.now()) / 1000)
    );

    console.warn(
      '[api.rate_limit.exceeded]',
      JSON.stringify({
        scope: options.scope,
        limit: options.limit,
        windowSeconds: options.windowSeconds,
      })
    );

    return { allowed: false, retryAfterSeconds };
  } catch (error) {
    // Fail open during rollout so a missing migration cannot take the API offline.
    console.error(
      '[api.rate_limit.error]',
      JSON.stringify({
        scope: options.scope,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return { allowed: true, retryAfterSeconds: 0 };
  }
}
