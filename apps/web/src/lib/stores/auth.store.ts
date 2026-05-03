import { create } from 'zustand';
import { isSupabaseConfigured, supabase } from '../supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;          // local DB UUID (returned by NestJS /auth/me)
  supabaseId: string;
  email: string;
  name?: string;
  plan: string;
  avatarUrl?: string;
  onboardingComplete?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setLoading: (isLoading: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  syncFromSupabase: (supabaseUser: SupabaseUser) => Promise<void>;
  reset: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setLoading: (isLoading) => set({ isLoading }),

  login: async (email, password) => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
    }
    set({ isLoading: true });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (email, password, name) => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
    }
    set({ isLoading: true });
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) throw new Error(error.message);
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    if (!isSupabaseConfigured) {
      set({ user: null, isAuthenticated: false });
      return;
    }
    await supabase.auth.signOut();
    set({ user: null, isAuthenticated: false });
  },

  syncFromSupabase: async (supabaseUser: SupabaseUser) => {
    if (!isSupabaseConfigured) {
      set({
        user: {
          id: '',
          supabaseId: supabaseUser.id,
          email: supabaseUser.email ?? '',
          plan: 'FREE',
        },
        isAuthenticated: true,
        isLoading: false,
      });
      return;
    }
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/v1/auth/me`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(5000),
        },
      );
      const profile = res.ok ? await res.json() : {};

      set({
        user: {
          id: profile.id ?? '',
          supabaseId: supabaseUser.id,
          email: supabaseUser.email ?? '',
          name: supabaseUser.user_metadata?.full_name ?? profile.name,
          plan: profile.plan ?? 'FREE',
          avatarUrl: supabaseUser.user_metadata?.avatar_url ?? profile.avatarUrl,
          onboardingComplete: profile.onboardingComplete ?? true,
        },
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      set({
        user: {
          id: '',
          supabaseId: supabaseUser.id,
          email: supabaseUser.email ?? '',
          plan: 'FREE',
        },
        isAuthenticated: true,
        isLoading: false,
      });
    }
  },

  reset: () => set({ user: null, isAuthenticated: false, isLoading: false }),
}));
