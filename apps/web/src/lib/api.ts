import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { supabase } from './supabase';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export const api = axios.create({
  baseURL: `${BASE_URL}/v1`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

// ── Request interceptor — attach Supabase Bearer token ───────────────────

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// ── Response interceptor — on 401 ask Supabase to refresh then retry ─────

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    original._retry = true;

    const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !session) {
      if (typeof window !== 'undefined') window.location.href = '/login';
      return Promise.reject(error);
    }

    original.headers.Authorization = `Bearer ${session.access_token}`;
    return api(original);
  },
);

// Kept for backward compat — no-ops since Supabase manages tokens
export const setTokens = (_a: string, _r: string) => {};
export const clearTokens = () => {};

export default api;
