import * as AuthSession from 'expo-auth-session';
import { Prompt } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

// Enable warm-up for better UX
WebBrowser.maybeCompleteAuthSession();

// Validate environment variables
export const auth0Domain = process.env.EXPO_PUBLIC_AUTH0_DOMAIN;
export const auth0ClientId = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID;

if (!auth0Domain || !auth0ClientId) {
  console.warn('Auth0 configuration missing. Auth0 features will be disabled.');
}

// Auth0 configuration
export const auth0Config = {
  domain: auth0Domain,
  clientId: auth0ClientId,
  // Construct the authorization and token URLs
  authorizationEndpoint: auth0Domain ? `https://${auth0Domain}/authorize` : '',
  tokenEndpoint: auth0Domain ? `https://${auth0Domain}/oauth/token` : '',
  revocationEndpoint: auth0Domain ? `https://${auth0Domain}/oauth/revoke` : '',
  logoutEndpoint: auth0Domain ? `https://${auth0Domain}/v2/logout` : '',
};

// Helper to check if Auth0 is configured
export const isAuth0Configured = (): boolean => {
  return !!(auth0Domain && auth0ClientId);
};

export type AuthIntent = 'signup' | 'login';

interface AuthRequestOptions {
  intent?: AuthIntent;
  forceInteractive?: boolean;
}

export const NATIVE_AUTH_REDIRECT_URI = 'pundit-app://callback';

export function getAuthRedirectUri(): string {
  return AuthSession.makeRedirectUri({
    scheme: 'pundit-app',
    native: NATIVE_AUTH_REDIRECT_URI,
  });
}

function getAuthPrompt(intent: AuthIntent | undefined, forceInteractive: boolean) {
  if (intent === 'login') {
    return Prompt.Login;
  }

  return undefined;
}

// Create redirect URI for Expo
export const useAuthRequest = ({ intent, forceInteractive = false }: AuthRequestOptions = {}) => {
  const discovery = {
    authorizationEndpoint: auth0Config.authorizationEndpoint,
    tokenEndpoint: auth0Config.tokenEndpoint,
    revocationEndpoint: auth0Config.revocationEndpoint,
  };

  const redirectUri = getAuthRedirectUri();
  const prompt = getAuthPrompt(intent, forceInteractive);
  const extraParams: Record<string, string> = {};

  if (intent) {
    extraParams.screen_hint = intent;
  }

  if (forceInteractive || intent === 'login') {
    extraParams.max_age = '0';
  }

  return AuthSession.useAuthRequest(
    {
      clientId: auth0ClientId || '',
      scopes: ['openid', 'profile', 'email', 'offline_access'],
      redirectUri,
      prompt,
      extraParams: Object.keys(extraParams).length > 0 ? extraParams : undefined,
    },
    discovery
  );
};

export async function logoutFromAuth0(): Promise<void> {
  if (!auth0Config.logoutEndpoint || !auth0Config.clientId) {
    return;
  }

  const returnTo = getAuthRedirectUri();
  const logoutUrl =
    `${auth0Config.logoutEndpoint}?client_id=${encodeURIComponent(auth0Config.clientId)}` +
    `&returnTo=${encodeURIComponent(returnTo)}`;

  try {
    await WebBrowser.openAuthSessionAsync(logoutUrl, returnTo);
  } catch (error) {
    console.error('Error logging out from Auth0 session:', error);
    throw error;
  }
}

// Refresh access token using refresh token
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken?: string;
} | null> {
  if (!auth0Domain || !auth0ClientId) {
    console.error('Auth0 not configured');
    return null;
  }

  try {
    const response = await fetch(`https://${auth0Domain}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: auth0ClientId,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Token refresh failed:', errorData);
      return null;
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token, // Auth0 may rotate refresh tokens
    };
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

// Fetch user info from Auth0
export async function fetchUserInfo(accessToken: string): Promise<{
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
} | null> {
  if (!auth0Domain) {
    return null;
  }

  try {
    const response = await fetch(`https://${auth0Domain}/userinfo`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch user info');
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching user info:', error);
    return null;
  }
}
