'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';

export interface ScheduledPost {
  id: string;
  contentId: string;
  platform: string;
  scheduledAt: string;
  status: string;
  timezone: string;
  publishAttempts: number;
  createdAt: string;
}

export function useScheduledPosts(params?: { platform?: string; status?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['scheduler', params],
    queryFn: async () => {
      const { data } = await api.get<{ items: ScheduledPost[]; total: number }>('/scheduler', { params });
      return data;
    },
  });
}

export function useSchedulePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: {
      contentId: string; platform: string;
      scheduledFor: string; timezone?: string;
    }) => api.post<ScheduledPost>('/scheduler', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduler'] }),
  });
}

export function useScheduleWithAI() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { contentId: string; platform: string; timezone?: string }) =>
      api.post('/scheduler/ai', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduler'] }),
  });
}

export function useCancelScheduled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/scheduler/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduler'] }),
  });
}
