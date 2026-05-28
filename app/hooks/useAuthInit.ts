import { useEffect, useState } from 'react';
import { useAuthStore } from '../state/useAuthStore';
import { logError, logInfo, logWarn } from '../services/debugLog';

export default function useAuthInit(): boolean {
  const [isReady, setIsReady] = useState(false);
  const { bootstrapFromStorage, restoreAuthState, isAuth0Available } = useAuthStore();

  useEffect(() => {
    let isMounted = true;
    logInfo('auth.init.start', { isAuth0Available });
    const bootstrapTimeout = setTimeout(() => {
      logWarn('auth.init.timeout');
    }, 8000);

    async function initAuth() {
      try {
        if (isAuth0Available) {
          await bootstrapFromStorage();
          logInfo('auth.init.bootstrap.complete');
          await restoreAuthState();
          logInfo('auth.init.restore.complete');
          return;
        }
      } catch (error) {
        console.error('Error initializing auth bootstrap:', error);
        logError('auth.init.error', error);
      } finally {
        clearTimeout(bootstrapTimeout);
        if (isMounted) {
          setIsReady(true);
        }
      }
    }

    void initAuth();

    return () => {
      isMounted = false;
      clearTimeout(bootstrapTimeout);
    };
  }, [bootstrapFromStorage, isAuth0Available, restoreAuthState]);

  return isReady;
}
