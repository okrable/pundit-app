import { useEffect, useState } from 'react';
import { useAuthStore } from '../state/useAuthStore';

export default function useAuthInit(): boolean {
  const [isReady, setIsReady] = useState(false);
  const { bootstrapFromStorage, restoreAuthState, isAuth0Available } = useAuthStore();

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      if (isAuth0Available) {
        await bootstrapFromStorage();
        if (isMounted) {
          setIsReady(true);
        }
        void restoreAuthState();
        return;
      }

      if (isMounted) {
        setIsReady(true);
      }
    }

    void initAuth();

    return () => {
      isMounted = false;
    };
  }, [bootstrapFromStorage, isAuth0Available, restoreAuthState]);

  return isReady;
}
