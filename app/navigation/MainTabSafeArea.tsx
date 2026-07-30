import React, { createContext, useContext } from 'react';
import type { Edge } from 'react-native-safe-area-context';

const MainTabUsesNativeBarContext = createContext(false);

interface MainTabSafeAreaProviderProps {
  children: React.ReactNode;
  usesNativeTabBar: boolean;
}

export function MainTabSafeAreaProvider({
  children,
  usesNativeTabBar,
}: MainTabSafeAreaProviderProps) {
  return (
    <MainTabUsesNativeBarContext.Provider value={usesNativeTabBar}>
      {children}
    </MainTabUsesNativeBarContext.Provider>
  );
}

export function useMainTabSafeAreaEdges(edges: readonly Edge[]): Edge[] {
  const usesNativeTabBar = useContext(MainTabUsesNativeBarContext);

  if (!usesNativeTabBar) {
    return [...edges];
  }

  return edges.filter((edge) => edge !== 'bottom');
}
