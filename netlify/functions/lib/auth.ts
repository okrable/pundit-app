import type { HandlerEvent, HandlerResponse } from '@netlify/functions';
import {
  authVerificationCache,
  type AuthVerificationCache,
} from './authVerificationCache';

export interface Auth0UserInfo {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

interface Auth0UserInfoPayload extends Partial<Auth0UserInfo> {
  email_verified?: boolean;
}

interface AuthorizeOptions {
  allowGuest?: boolean;
}

interface AuthorizeUserOptions {
  verificationCache?: AuthVerificationCache;
}

export type Auth0VerificationFailureKind = 'invalid' | 'unavailable';

interface Auth0VerificationFailure {
  kind: Auth0VerificationFailureKind;
  upstreamStatus?: number;
  retryAfter?: string;
}

type Auth0UserInfoResult =
  | { user: Auth0UserInfo; failure: null }
  | { user: null; failure: Auth0VerificationFailure };

export function classifyAuth0VerificationFailure(
  upstreamStatus?: number
): Auth0VerificationFailureKind {
  return upstreamStatus === 401 ? 'invalid' : 'unavailable';
}

function getBearerToken(event: HandlerEvent): string | null {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

async function fetchAuth0UserInfo(accessToken: string): Promise<Auth0UserInfoResult> {
  const auth0Domain = process.env.AUTH0_DOMAIN;
  if (!auth0Domain) {
    console.error('AUTH0_DOMAIN is not configured on server');
    return {
      user: null,
      failure: { kind: 'unavailable' },
    };
  }

  try {
    const response = await fetch(`https://${auth0Domain}/userinfo`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const kind = classifyAuth0VerificationFailure(response.status);
      console.warn('Auth0 userinfo verification failed', {
        kind,
        upstreamStatus: response.status,
      });
      return {
        user: null,
        failure: {
          kind,
          upstreamStatus: response.status,
          retryAfter: response.headers.get('retry-after') || undefined,
        },
      };
    }

    const data = (await response.json()) as Auth0UserInfoPayload;
    if (!data.sub || typeof data.sub !== 'string') {
      console.warn('Auth0 userinfo response did not include a valid subject');
      return {
        user: null,
        failure: {
          kind: 'unavailable',
          upstreamStatus: response.status,
        },
      };
    }

    const verifiedEmail =
      data.email_verified === true && typeof data.email === 'string'
        ? data.email
        : undefined;

    return {
      user: {
        sub: data.sub,
        email: verifiedEmail,
        name: typeof data.name === 'string' ? data.name : undefined,
        picture: typeof data.picture === 'string' ? data.picture : undefined,
      },
      failure: null,
    };
  } catch (error) {
    console.error('Auth0 token verification failed:', error);
    return {
      user: null,
      failure: { kind: 'unavailable' },
    };
  }
}

export type AuthorizedUserResult =
  | { user: Auth0UserInfo; response: null }
  | { user: null; response: HandlerResponse };

export async function authorizeUser(
  event: HandlerEvent,
  expectedUserId: string,
  headers: Record<string, string>,
  options: AuthorizeUserOptions = {}
): Promise<AuthorizedUserResult> {
  const token = getBearerToken(event);
  if (!token) {
    return {
      user: null,
      response: {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Missing or invalid Authorization header' }),
      },
    };
  }

  const verificationCache = options.verificationCache ?? authVerificationCache;
  if (await verificationCache.has(token, expectedUserId)) {
    return {
      user: { sub: expectedUserId },
      response: null,
    };
  }

  const verification = await fetchAuth0UserInfo(token);
  if (!verification.user) {
    const isInvalidToken = verification.failure.kind === 'invalid';
    const responseHeaders = verification.failure.retryAfter
      ? { ...headers, 'Retry-After': verification.failure.retryAfter }
      : headers;
    return {
      user: null,
      response: {
        statusCode: isInvalidToken ? 401 : 503,
        headers: responseHeaders,
        body: JSON.stringify(
          isInvalidToken
            ? { error: 'Invalid or expired access token' }
            : {
                error: 'Authentication service temporarily unavailable',
                code: 'AUTH_VERIFICATION_UNAVAILABLE',
              }
        ),
      },
    };
  }

  const userInfo = verification.user;
  if (userInfo.sub !== expectedUserId) {
    return {
      user: null,
      response: {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          error: 'Authenticated user does not match requested userId',
        }),
      },
    };
  }

  await verificationCache.remember(token, userInfo.sub);

  return { user: userInfo, response: null };
}

export async function assertAuthorizedUser(
  event: HandlerEvent,
  expectedUserId: string,
  headers: Record<string, string>,
  options: AuthorizeOptions = {}
): Promise<HandlerResponse | null> {
  const { allowGuest = false } = options;

  if (allowGuest && expectedUserId.startsWith('guest_')) {
    return null;
  }

  const authorization = await authorizeUser(event, expectedUserId, headers);
  return authorization.response;
}
