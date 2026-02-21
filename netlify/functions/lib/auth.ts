import type { HandlerEvent, HandlerResponse } from '@netlify/functions';

interface Auth0UserInfo {
  sub: string;
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

    const data = (await response.json()) as Partial<Auth0UserInfo>;
    if (!data.sub || typeof data.sub !== 'string') {
      return null;
    }

    return { sub: data.sub };
  } catch (error) {
    console.error('Auth0 token verification failed:', error);
    return null;
  }
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

  const token = getBearerToken(event);
  if (!token) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Missing or invalid Authorization header' }),
    };
  }

  const userInfo = await fetchAuth0UserInfo(token);
  if (!userInfo) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Invalid or expired access token' }),
    };
  }

  if (userInfo.sub !== expectedUserId) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'Authenticated user does not match requested userId' }),
    };
  }

  return null;
}
