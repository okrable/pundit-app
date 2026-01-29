import { useEffect, useState } from 'react';
import { useAuthStore } from '../state/useAuthStore';

export default function useAuthInit(): boolean {
  const [isReady, setIsReady] = useState(false);
  const { restoreAuthState, isAuth0Available } = useAuthStore();

  useEffect(() => {
    const initAuth = async () => {
      if (isAuth0Available) {
        await restoreAuthState();
      }
      setIsReady(true);
    };

    initAuth();
  }, []);

  return isReady;
}
