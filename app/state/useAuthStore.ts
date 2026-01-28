import { create } from 'zustand';
import { isAuth0Configured, auth0Domain } from '../services/auth0';

interface User {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  username?: string;
  usernameRequired?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAuth0Available: boolean;
  error: string | null;
  setAuthResult: (token: string, user: User) => void;
  setUsername: (username: string) => void;
  setDisplayName: (name: string) => void;
  setUsernameRequired: (required: boolean) => void;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isAuth0Available: isAuth0Configured(),
  error: null,

  setAuthResult: (token: string, user: User) => {
    set({
      token,
      user,
      isAuthenticated: true,
      error: null,
    });
  },

  setUsername: (username: string) => {
    set((state) => ({
      user: state.user
        ? { ...state.user, username, usernameRequired: false }
        : null,
    }));
  },

  setDisplayName: (name: string) => {
    set((state) => ({
      user: state.user ? { ...state.user, name } : null,
    }));
  },

  setUsernameRequired: (required: boolean) => {
    set((state) => ({
      user: state.user ? { ...state.user, usernameRequired: required } : null,
    }));
  },

  logout: () => {
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
    });
  },

  clearError: () => {
    set({ error: null });
  },
}));