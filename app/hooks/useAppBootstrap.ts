import { useEffect, useState } from 'react';
import { hydrateDailyLoopFromCache, prefetchDailyLoop, resolveEffectiveUserId } from '../services/dailyLoop';
import { useAuthStore } from '../state/useAuthStore';

export default function useAppBootstrap(isAuthReady: boolean): boolean {
  const [isReady, setIsReady] = useState(false);
  const { user, isAuthenticated, token } = useAuthStore();

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      if (!isAuthReady) {
        return;
      }

      const userId = await resolveEffectiveUserId();
      await hydrateDailyLoopFromCache(userId);

      if (isMounted) {
        setIsReady(true);
      }

      void prefetchDailyLoop(userId);
    }

    void bootstrap();

    return () => {
      isMounted = false;
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
      });
      return;
    }

    if (nextUserId) {
      void hydrateDailyLoopFromCache(nextUserId);
      if (token) {
        void prefetchDailyLoop(nextUserId);
      }
    }
  }, [isReady, isAuthenticated, token, user?.sub]);

  return isReady;
}
