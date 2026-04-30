import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api, { setTokens, clearTokens } from '../api';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  plan: string;
  avatarUrl?: string;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,
      isAuthenticated: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post<{
            accessToken: string;
            refreshToken: string;
            user: AuthUser;
          }>('/auth/login', { email, password });
          setTokens(data.accessToken, data.refreshToken);
          set({ user: data.user, isAuthenticated: true });
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (email, password, name) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post<{
            accessToken: string;
            refreshToken: string;
            user: AuthUser;
          }>('/auth/register', { email, password, name });
          setTokens(data.accessToken, data.refreshToken);
          set({ user: data.user, isAuthenticated: true });
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        clearTokens();
        set({ user: null, isAuthenticated: false });
      },

      fetchMe: async () => {
        try {
          const { data } = await api.get<AuthUser>('/auth/me');
          set({ user: data, isAuthenticated: true });
        } catch {
          clearTokens();
          set({ user: null, isAuthenticated: false });
        }
      },
    }),
    {
      name: 'lora-auth',
      partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }),
    },
  ),
);
