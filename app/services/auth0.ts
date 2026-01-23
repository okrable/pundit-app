import * as AuthSession from 'expo-auth-session';
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
};

// Helper to check if Auth0 is configured
export const isAuth0Configured = (): boolean => {
  return !!(auth0Domain && auth0ClientId);
};

// Create redirect URI for Expo
export const useAuthRequest = (screenHint?: 'signup' | 'login') => {
  const discovery = {
    authorizationEndpoint: auth0Config.authorizationEndpoint,
    tokenEndpoint: auth0Config.tokenEndpoint,
    revocationEndpoint: auth0Config.revocationEndpoint,
  };

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'pundit-app' });

  return AuthSession.useAuthRequest(
    {
      clientId: auth0ClientId || '',
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
      extraParams: screenHint ? { screen_hint: screenHint } : undefined,
    },
    discovery
  );
};