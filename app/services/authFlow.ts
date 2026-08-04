import * as AuthSession from 'expo-auth-session';
import { auth0Config, fetchUserInfo, getAuthRedirectUri } from './auth0';
import { syncAuthenticatedSession } from './dailyLoop';
import { logError, logInfo, logWarn } from './debugLog';
import { useAuthStore } from '../state/useAuthStore';
import { trackAnalyticsEvent } from './analytics';
import { setUsername as setUsernameApi, syncIdentity } from './api';
import type { SetUsernameResponse } from '../types';
import type { AvatarId } from '../../shared/avatarCatalog';
import {
  buildIdentityActivationKey,
  isIdentityActivationCurrent,
} from '../../shared/clientIdentityPolicy';

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
const inflightIdentityActivations = new Map<string, Promise<boolean>>();

function isCurrentActivation(userId: string, authStateVersion: number): boolean {
  const authState = useAuthStore.getState();
  return isIdentityActivationCurrent(userId, authStateVersion, {
    userId: authState.user?.sub,
    token: authState.token,
    isAuthenticated: authState.isAuthenticated,
    authStateVersion: authState.authStateVersion,
  });
}

interface ActivateIdentityOptions {
  userId: string;
  intent: 'signup' | 'login' | 'restore';
  source: 'login' | 'restore';
  userProfile?: {
    email?: string;
    avatarUrl?: string;
  };
}

export async function activateAuthenticatedSession({
  userId,
  intent,
  source,
  userProfile,
}: ActivateIdentityOptions): Promise<boolean> {
  const authState = useAuthStore.getState();
  const authStateVersion = authState.authStateVersion;
  const activationKey = buildIdentityActivationKey(userId, authStateVersion);
  const existingActivation = inflightIdentityActivations.get(activationKey);
  if (existingActivation) return existingActivation;

  const activation = (async () => {
    if (!isCurrentActivation(userId, authStateVersion)) {
      logWarn('auth.flow.identity.discarded_before_start', { userId, source });
      return false;
    }

    authState.beginIdentitySync(source);
    logInfo('auth.flow.identity.start', { userId, intent, source });

    try {
      const identity = await syncIdentity(userId, intent);
      const latestAuthState = useAuthStore.getState();
      if (!isCurrentActivation(userId, authStateVersion)) {
        logWarn('auth.flow.identity.discarded_stale', { userId, source });
        return false;
      }

      if (!identity.usernameRequired && !identity.username) {
        throw new Error('Identity synchronization did not return a username');
      }

      if (!identity.usernameRequired && identity.username) {
        latestAuthState.beginAuthSync(source);
      }
      await latestAuthState.applyIdentity(identity);
      if (!isCurrentActivation(userId, authStateVersion)) {
        logWarn('auth.flow.identity.discarded_after_apply', { userId, source });
        return false;
      }
      if (identity.usernameRequired || !identity.username) {
        logInfo('auth.flow.identity.username_required', { userId, source });
        return false;
      }

      await syncAuthenticatedSession({
        userId,
        source,
        userProfile,
      });
      if (!isCurrentActivation(userId, authStateVersion)) {
        logWarn('auth.flow.identity.discarded_after_sync', { userId, source });
        return false;
      }
      logInfo('auth.flow.identity.complete', { userId, source });
      return true;
    } catch (error) {
      const latestAuthState = useAuthStore.getState();
      if (isCurrentActivation(userId, authStateVersion)) {
        latestAuthState.failIdentitySync(
          error instanceof Error ? error.message : 'Unable to synchronize your account'
        );
      }
      throw error;
    }
  })().finally(() => {
    inflightIdentityActivations.delete(activationKey);
  });

  inflightIdentityActivations.set(activationKey, activation);
  return activation;
}

export async function completeUsernameOnboarding(
  username: string,
  avatarId: AvatarId
): Promise<SetUsernameResponse> {
  const authState = useAuthStore.getState();
  const userId = authState.user?.sub;
  if (!userId || !authState.token) {
    return { success: false, error: 'Your session is no longer available' };
  }

  const authStateVersion = authState.authStateVersion;
  const response = await setUsernameApi(userId, username, avatarId);
  if (!response.success || !response.username || !response.avatarId) {
    return response;
  }

  const latestAuthState = useAuthStore.getState();
  if (!isCurrentActivation(userId, authStateVersion)) {
    return { success: false, error: 'Your session changed. Please try again.' };
  }

  const source = latestAuthState.identitySource ?? 'login';
  latestAuthState.beginAuthSync(source);
  await latestAuthState.applyIdentity({
    username: response.username,
    usernameRequired: false,
    onboardingStatus: 'complete',
    avatarId: response.avatarId,
  });
  if (!isCurrentActivation(userId, authStateVersion)) {
    return { success: false, error: 'Your session changed. Please try again.' };
  }
  trackAnalyticsEvent('username_onboarding_completed', 'authenticated');
  await syncAuthenticatedSession({
    userId,
    source,
    userProfile: {
      email: latestAuthState.user?.email,
      avatarUrl: latestAuthState.user?.picture,
    },
  });
  return response;
}

export async function retryIdentityActivation(): Promise<boolean> {
  const authState = useAuthStore.getState();
  if (!authState.user?.sub || !authState.token) {
    return false;
  }

  return activateAuthenticatedSession({
    userId: authState.user.sub,
    intent: 'restore',
    source: authState.identitySource ?? 'restore',
    userProfile: {
      email: authState.user.email,
      avatarUrl: authState.user.picture,
    },
  });
}

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

    const redirectUri = request.redirectUri ?? getAuthRedirectUri();
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
    await activateAuthenticatedSession({
      userId: userInfo.sub,
      intent,
      source: 'login',
      userProfile: {
        email: userInfo.email,
        avatarUrl: userInfo.picture,
      },
    });
    trackAnalyticsEvent('auth_completed', 'authenticated');

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
