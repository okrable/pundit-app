import * as AuthSession from 'expo-auth-session';
import { auth0Config, fetchUserInfo } from './auth0';
import { syncAuthenticatedSession } from './dailyLoop';
import { logError, logInfo, logWarn } from './debugLog';
import { useAuthStore } from '../state/useAuthStore';

export type AuthFlowIntent = 'signup' | 'login';

interface AuthFlowRequest {
  codeVerifier?: string;
  redirectUri?: string;
}

interface AuthFlowLoginOptions {
  intent: AuthFlowIntent;
  request: AuthFlowRequest | null;
  promptAsync: (options: AuthSession.AuthRequestPromptOptions) => Promise<AuthSession.AuthSessionResult>;
}

interface AuthFlowUser {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

let inflightLogin: Promise<AuthFlowUser | null> | null = null;

export async function loginWithAuth0({
  intent,
  request,
  promptAsync,
}: AuthFlowLoginOptions): Promise<AuthFlowUser | null> {
  if (inflightLogin) {
    logWarn('auth.flow.login.reused_inflight', { intent });
    return inflightLogin;
  }

  inflightLogin = (async () => {
    useAuthStore.getState().clearError();
    AuthSession.dismiss();

    if (!request) {
      throw new Error('Authentication is still preparing. Please try again.');
    }

    logInfo('auth.flow.login.start', { intent });
    const authResult = await promptAsync({ preferEphemeralSession: true });

    if (authResult.type !== 'success') {
      logInfo('auth.flow.login.cancelled', { intent, type: authResult.type });
      return null;
    }

    const code = authResult.params?.code;
    if (!code) {
      throw new Error('Authentication did not return an authorization code.');
    }

    if (!request.codeVerifier) {
      throw new Error('Authentication request is missing its code verifier.');
    }

    const redirectUri = request.redirectUri ?? AuthSession.makeRedirectUri({ scheme: 'pundit-app' });
    const tokenResponse = await AuthSession.exchangeCodeAsync(
      {
        code,
        clientId: auth0Config.clientId || '',
        redirectUri,
        extraParams: {
          code_verifier: request.codeVerifier,
        },
      },
      {
        tokenEndpoint: auth0Config.tokenEndpoint,
      }
    );

    const userInfo = await fetchUserInfo(tokenResponse.accessToken);
    if (!userInfo) {
      throw new Error('Unable to load Auth0 profile after login.');
    }

    await useAuthStore.getState().setAuthResult(
      tokenResponse.accessToken,
      userInfo,
      tokenResponse.refreshToken
    );
    await syncAuthenticatedSession({
      userId: userInfo.sub,
      source: 'login',
      userProfile: {
        displayName: userInfo.name,
        email: userInfo.email,
        avatarUrl: userInfo.picture,
      },
    });

    logInfo('auth.flow.login.success', { intent, userId: userInfo.sub });
    return userInfo;
  })()
    .catch((error) => {
      logError('auth.flow.login.error', error);
      throw error;
    })
    .finally(() => {
      inflightLogin = null;
    });

  return inflightLogin;
}

export async function logoutWithAuth0(): Promise<void> {
  logInfo('auth.flow.logout.start');
  AuthSession.dismiss();
  await useAuthStore.getState().logout();
  logInfo('auth.flow.logout.end');
}
