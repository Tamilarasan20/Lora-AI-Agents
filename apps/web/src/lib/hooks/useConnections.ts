'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';

export interface PlatformConnection {
  id: string;
  platform: string;
  platformUsername?: string;
  platformDisplayName?: string;
  connectionStatus: string;
  followerCount?: number;
  createdAt: string;
}

export function useConnections() {
  return useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const { data } = await api.get<PlatformConnection[]>('/connections');
      return data;
    },
  });
}

export function useOAuthUrl() {
  return useMutation({
    mutationFn: (platform: string) =>
      api.post<{ url: string }>('/connections/oauth-url', { platform }),
  });
}

export function useDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/connections/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections'] }),
  });
}

export function useRefreshConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/connections/${id}/refresh`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections'] }),
  });
}
