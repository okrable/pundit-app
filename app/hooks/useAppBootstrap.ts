import { useEffect, useState } from 'react';
import { hydrateDailyLoopFromCache, prefetchDailyLoop, resolveEffectiveUserId } from '../services/dailyLoop';
import { useAuthStore } from '../state/useAuthStore';
import { logError, logInfo, logWarn } from '../services/debugLog';

export default function useAppBootstrap(isAuthReady: boolean): boolean {
  const [isReady, setIsReady] = useState(false);
  const { user, isAuthenticated, token } = useAuthStore();

  useEffect(() => {
    let isMounted = true;
    logInfo('bootstrap.app.start', { isAuthReady });
    const bootstrapTimeout = setTimeout(() => {
      if (isMounted) {
        logWarn('bootstrap.app.timeout');
        setIsReady(true);
      }
    }, 2500);

    async function bootstrap() {
      if (!isAuthReady) {
        return;
      }

      try {
        const userId = await resolveEffectiveUserId();
        logInfo('bootstrap.app.user_resolved', { userId });
        await hydrateDailyLoopFromCache(userId);
        logInfo('bootstrap.app.cache_hydrated', { userId });

        if (isMounted) {
          setIsReady(true);
        }

        void prefetchDailyLoop(userId).catch((error) => {
          logError('bootstrap.app.prefetch.error', error);
        });
      } catch (error) {
        console.error('Error bootstrapping app state:', error);
        logError('bootstrap.app.error', error);
        if (isMounted) {
          setIsReady(true);
        }
      }
    }

    void bootstrap();

    return () => {
      isMounted = false;
      clearTimeout(bootstrapTimeout);
    };
  }, [isAuthReady]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const nextUserId = isAuthenticated && user?.sub ? user.sub : null;
    if (!nextUserId && !token) {
      void resolveEffectiveUserId().then((userId) => {
        logInfo('bootstrap.refresh.guest', { userId });
        void hydrateDailyLoopFromCache(userId);
        void prefetchDailyLoop(userId);
      }).catch((error) => {
        console.error('Error refreshing guest bootstrap state:', error);
        logError('bootstrap.refresh.guest.error', error);
      });
      return;
    }

    if (nextUserId) {
      logInfo('bootstrap.refresh.authenticated', { userId: nextUserId, hasToken: Boolean(token) });
      void hydrateDailyLoopFromCache(nextUserId).catch((error) => {
        console.error('Error hydrating authenticated bootstrap state:', error);
        logError('bootstrap.refresh.authenticated.hydrate.error', error);
      });
      if (token) {
        void prefetchDailyLoop(nextUserId).catch((error) => {
          console.error('Error prefetching authenticated daily loop:', error);
          logError('bootstrap.refresh.authenticated.prefetch.error', error);
        });
      }
    }
  }, [isReady, isAuthenticated, token, user?.sub]);

  return isReady;
}
