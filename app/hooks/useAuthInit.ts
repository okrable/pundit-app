import { useEffect, useState } from 'react';
import { useAuthStore } from '../state/useAuthStore';

export default function useAuthInit(): boolean {
  const [isReady, setIsReady] = useState(false);
  const { bootstrapFromStorage, restoreAuthState, isAuth0Available } = useAuthStore();

  useEffect(() => {
    let isMounted = true;
    const bootstrapTimeout = setTimeout(() => {
      if (isMounted) {
        setIsReady(true);
      }
    }, 2000);

    async function initAuth() {
      try {
        if (isAuth0Available) {
          await bootstrapFromStorage();
          if (isMounted) {
            setIsReady(true);
          }
          void restoreAuthState();
          return;
        }
      } catch (error) {
        console.error('Error initializing auth bootstrap:', error);
      } finally {
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
