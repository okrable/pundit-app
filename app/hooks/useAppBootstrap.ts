import { useEffect, useState } from 'react';
import {
  hydrateDailyLoopFromCache,
  prefetchDailyLoop,
  resolveEffectiveUserId,
} from '../services/dailyLoop';
import { activateAuthenticatedSession } from '../services/authFlow';
import { useAuthStore } from '../state/useAuthStore';
import { logError, logInfo, logWarn } from '../services/debugLog';

export default function useAppBootstrap(localAuthReady: boolean): boolean {
  const [hydratedAuthStateVersion, setHydratedAuthStateVersion] = useState<number | null>(null);
  const { user, isAuthenticated, token, identitySource, authStateVersion } = useAuthStore();

  useEffect(() => {
    let isMounted = true;
    if (!localAuthReady) return undefined;

    const expectedAuthStateVersion = authStateVersion;
    logInfo('bootstrap.app.start', { localAuthReady, expectedAuthStateVersion });
    const bootstrapTimeout = setTimeout(() => {
      logWarn('bootstrap.app.timeout', { expectedAuthStateVersion });
    }, 10000);

    async function bootstrap() {
      try {
        const userId = await resolveEffectiveUserId();
        logInfo('bootstrap.app.user_resolved', { userId, expectedAuthStateVersion });
        await hydrateDailyLoopFromCache(userId, expectedAuthStateVersion);

        if (
          !isMounted ||
          useAuthStore.getState().authStateVersion !== expectedAuthStateVersion
        ) {
          logWarn('bootstrap.app.cache_discarded_stale', { userId, expectedAuthStateVersion });
          return;
        }

        logInfo('bootstrap.app.cache_hydrated', { userId, expectedAuthStateVersion });
        setHydratedAuthStateVersion(expectedAuthStateVersion);

        void prefetchDailyLoop({ userId, mode: 'public-warm' }).catch((error) => {
          logError('bootstrap.app.prefetch.error', error);
        });
      } catch (error) {
        console.error('Error bootstrapping app state:', error);
        logError('bootstrap.app.error', error);
        if (
          isMounted &&
          useAuthStore.getState().authStateVersion === expectedAuthStateVersion
        ) {
          setHydratedAuthStateVersion(expectedAuthStateVersion);
        }
      } finally {
        clearTimeout(bootstrapTimeout);
      }
    }

    void bootstrap();

    return () => {
      isMounted = false;
      clearTimeout(bootstrapTimeout);
    };
  }, [authStateVersion, localAuthReady]);

  useEffect(() => {
    if (
      !localAuthReady ||
      !isAuthenticated ||
      !user?.sub ||
      !token ||
      identitySource !== 'restore'
    ) {
      return;
    }

    void activateAuthenticatedSession({
      userId: user.sub,
      intent: 'restore',
      source: 'restore',
      userProfile: {
        email: user.email,
        avatarUrl: user.picture,
      },
    }).catch((error) => {
      logError('bootstrap.app.restore_activation.error', error);
    });
  }, [identitySource, isAuthenticated, localAuthReady, token, user?.sub]);

  return localAuthReady && hydratedAuthStateVersion === authStateVersion;
}
