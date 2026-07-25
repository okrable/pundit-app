import type { HandlerEvent, HandlerResponse } from '@netlify/functions';

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

function getBearerToken(event: HandlerEvent): string | null {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

async function fetchAuth0UserInfo(accessToken: string): Promise<Auth0UserInfo | null> {
  const auth0Domain = process.env.AUTH0_DOMAIN;
  if (!auth0Domain) {
    console.error('AUTH0_DOMAIN is not configured on server');
    return null;
  }

  try {
    const response = await fetch(`https://${auth0Domain}/userinfo`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as Auth0UserInfoPayload;
    if (!data.sub || typeof data.sub !== 'string') {
      return null;
    }

    const verifiedEmail =
      data.email_verified === true && typeof data.email === 'string'
        ? data.email
        : undefined;

    return {
      sub: data.sub,
      email: verifiedEmail,
      name: typeof data.name === 'string' ? data.name : undefined,
      picture: typeof data.picture === 'string' ? data.picture : undefined,
    };
  } catch (error) {
    console.error('Auth0 token verification failed:', error);
    return null;
  }
}

export type AuthorizedUserResult =
  | { user: Auth0UserInfo; response: null }
  | { user: null; response: HandlerResponse };

export async function authorizeUser(
  event: HandlerEvent,
  expectedUserId: string,
  headers: Record<string, string>
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

  const userInfo = await fetchAuth0UserInfo(token);
  if (!userInfo) {
    return {
      user: null,
      response: {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired access token' }),
      },
    };
  }

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
