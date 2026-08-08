import React, { createContext, useContext } from 'react';
import type { SharedCodeAction } from '../services/sharedCode';

interface SharedLinkContextValue {
  openSharedAction: (action: SharedCodeAction) => Promise<void>;
}

const SharedLinkContext = createContext<SharedLinkContextValue | null>(null);

export const SharedLinkProvider = SharedLinkContext.Provider;

export function useSharedLinkFlow(): SharedLinkContextValue {
  const value = useContext(SharedLinkContext);
  if (!value) throw new Error('useSharedLinkFlow must be used inside SharedLinkProvider');
  return value;
}
