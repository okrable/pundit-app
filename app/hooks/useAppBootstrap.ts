import { useEffect, useState } from 'react';
import { hydrateDailyLoopFromCache, prefetchDailyLoop, resolveEffectiveUserId } from '../services/dailyLoop';
import { useAuthStore } from '../state/useAuthStore';

export default function useAppBootstrap(isAuthReady: boolean): boolean {
  const [isReady, setIsReady] = useState(false);
  const { user, isAuthenticated, token } = useAuthStore();

  useEffect(() => {
    let isMounted = true;
    const bootstrapTimeout = setTimeout(() => {
      if (isMounted) {
        setIsReady(true);
      }
    }, 2500);

    async function bootstrap() {
      if (!isAuthReady) {
        return;
      }

      try {
        const userId = await resolveEffectiveUserId();
        await hydrateDailyLoopFromCache(userId);

        if (isMounted) {
          setIsReady(true);
        }

        void prefetchDailyLoop(userId);
      } catch (error) {
        console.error('Error bootstrapping app state:', error);
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
        void hydrateDailyLoopFromCache(userId);
        void prefetchDailyLoop(userId);
      }).catch((error) => {
        console.error('Error refreshing guest bootstrap state:', error);
      });
      return;
    }

    if (nextUserId) {
      void hydrateDailyLoopFromCache(nextUserId).catch((error) => {
        console.error('Error hydrating authenticated bootstrap state:', error);
      });
      if (token) {
        void prefetchDailyLoop(nextUserId).catch((error) => {
          console.error('Error prefetching authenticated daily loop:', error);
        });
      }
    }
  }, [isReady, isAuthenticated, token, user?.sub]);

  return isReady;
}
