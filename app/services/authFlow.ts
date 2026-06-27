import { useEffect } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';
import { auth0Config, fetchUserInfo, useAuthRequest } from './auth0';
import { syncAuthenticatedSession } from './dailyLoop';
import { logError, logInfo, logWarn } from './debugLog';
import { useAuthStore } from '../state/useAuthStore';

export type AuthFlowIntent = 'signup' | 'login';

interface AuthFlowRequest {
  codeVerifier?: string;
  redirectUri?: string;
  state?: string;
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
let handledResponseKey: string | null = null;

function normalizeParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parseRedirectResult(url: string, request: AuthFlowRequest): AuthSession.AuthSessionResult | null {
  const redirectUri = request.redirectUri ?? AuthSession.makeRedirectUri({ scheme: 'pundit-app' });
  if (!url.startsWith(redirectUri) && !url.startsWith('pundit-app://')) {
    return null;
  }

  const parsed = Linking.parse(url);
  const queryParams = parsed.queryParams ?? {};
  const code = normalizeParam(queryParams.code);
  const state = normalizeParam(queryParams.state);
  const error = normalizeParam(queryParams.error);
  const errorDescription = normalizeParam(queryParams.error_description);

  if (!code && !error) {
    return null;
  }

  const params: Record<string, string> = {};
  if (code) params.code = code;
  if (state) params.state = state;
  if (error) params.error = error;
  if (errorDescription) params.error_description = errorDescription;

  return {
    type: error ? 'error' : 'success',
    params,
  } as AuthSession.AuthSessionResult;
}

function waitForRedirectResult(request: AuthFlowRequest): {
  promise: Promise<AuthSession.AuthSessionResult>;
  dispose: () => void;
} {
  let subscription: { remove: () => void } | null = null;

  const promise = new Promise<AuthSession.AuthSessionResult>((resolve) => {
    subscription = Linking.addEventListener('url', (event) => {
      const result = parseRedirectResult(event.url, request);
      if (result) {
        resolve(result);
      }
    });
  });

  return {
    promise,
    dispose: () => {
      subscription?.remove();
      subscription = null;
    },
  };
}

function delayResult<T>(durationMs: number, result: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(result), durationMs);
  });
}

async function resolveAuthResult(
  request: AuthFlowRequest,
  promptAsync: (options: AuthSession.AuthRequestPromptOptions) => Promise<AuthSession.AuthSessionResult>
): Promise<AuthSession.AuthSessionResult> {
  const redirectWait = waitForRedirectResult(request);

  try {
    const promptPromise = promptAsync({ preferEphemeralSession: true });
    const firstResult = await Promise.race([promptPromise, redirectWait.promise]);

    if (firstResult.type === 'success') {
      return firstResult;
    }

    return Promise.race([
      redirectWait.promise,
      delayResult(1500, firstResult),
    ]);
  } finally {
    redirectWait.dispose();
  }
}

async function completeAuthResult(
  intent: AuthFlowIntent,
  request: AuthFlowRequest,
  authResult: AuthSession.AuthSessionResult
): Promise<AuthFlowUser | null> {
  if (authResult.type !== 'success') {
    logInfo('auth.flow.login.cancelled', { intent, type: authResult.type });
    return null;
  }

  const code = authResult.params?.code;
  if (!code) {
    throw new Error('Authentication did not return an authorization code.');
  }

  if (request.state && authResult.params?.state && authResult.params.state !== request.state) {
    throw new Error('Authentication returned an unexpected state value.');
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
      email: userInfo.email,
      avatarUrl: userInfo.picture,
    },
  });

  logInfo('auth.flow.login.success', { intent, userId: userInfo.sub });
  return userInfo;
}

export function useAuthFlowRequest({
  intent,
  forceInteractive = false,
}: {
  intent: AuthFlowIntent;
  forceInteractive?: boolean;
}) {
  const [request, response, promptAsync] = useAuthRequest({ intent, forceInteractive });

  useEffect(() => {
    if (!request || !response || response.type !== 'success') {
      return;
    }

    const responseKey = `${intent}:${response.params?.code ?? ''}:${response.params?.state ?? ''}`;
    if (!response.params?.code || handledResponseKey === responseKey) {
      return;
    }

    handledResponseKey = responseKey;
    void loginWithAuth0({
      intent,
      request,
      promptAsync: async () => response,
    }).catch((error) => {
      logError('auth.flow.response_handler.error', error);
    });
  }, [intent, promptAsync, request, response]);

  return [request, promptAsync] as const;
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
    const authResult = await resolveAuthResult(request, promptAsync);

    return completeAuthResult(intent, request, authResult);
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
