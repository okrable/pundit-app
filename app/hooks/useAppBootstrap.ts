import { useEffect, useState } from 'react';
import {
  hydrateDailyLoopFromCache,
  prefetchDailyLoop,
  resolveEffectiveUserId,
} from '../services/dailyLoop';
import { activateAuthenticatedSession } from '../services/authFlow';
import { useAuthStore } from '../state/useAuthStore';
import { logError, logInfo, logWarn } from '../services/debugLog';

export default function useAppBootstrap(isAuthReady: boolean): boolean {
  const [isReady, setIsReady] = useState(false);
  const { user, isAuthenticated, token, identitySource } = useAuthStore();

  useEffect(() => {
    let isMounted = true;
    logInfo('bootstrap.app.start', { isAuthReady });
    const bootstrapTimeout = setTimeout(() => {
      logWarn('bootstrap.app.timeout');
    }, 10000);

    async function bootstrap() {
      if (!isAuthReady) {
        clearTimeout(bootstrapTimeout);
        return;
      }

      try {
        const userId = await resolveEffectiveUserId();
        logInfo('bootstrap.app.user_resolved', { userId });
        await hydrateDailyLoopFromCache(userId);
        logInfo('bootstrap.app.cache_hydrated', { userId });

        if (
          isAuthenticated &&
          user?.sub &&
          token &&
          identitySource === 'restore'
        ) {
          await activateAuthenticatedSession({
            userId: user.sub,
            intent: 'restore',
            source: 'restore',
            userProfile: {
              email: user.email,
              avatarUrl: user.picture,
            },
          });
        }

        if (isMounted) {
          setIsReady(true);
        }

        void prefetchDailyLoop({ userId, mode: 'public-warm' }).catch((error) => {
          logError('bootstrap.app.prefetch.error', error);
        });
      } catch (error) {
        console.error('Error bootstrapping app state:', error);
        logError('bootstrap.app.error', error);
        if (isMounted) {
          setIsReady(true);
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
  }, [isAuthReady, isAuthenticated, token, user?.sub]);

  return isReady;
}
