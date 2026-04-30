'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';

export interface EngagementItem {
  id: string;
  platform: string;
  type: string;
  authorUsername: string;
  text: string;
  replyText?: string;
  replied: boolean;
  repliedBy?: string;
  repliedAt?: string;
  isRead: boolean;
  escalated: boolean;
  engagementCreatedAt: string;
}

export function useEngagementInbox(filters?: {
  platform?: string; type?: string; replied?: boolean;
  escalated?: boolean; page?: number; limit?: number;
}) {
  return useQuery({
    queryKey: ['engagement', 'inbox', filters],
    queryFn: async () => {
      const { data } = await api.get<{
        items: EngagementItem[]; total: number; page: number; totalPages: number;
      }>('/engagement/inbox', { params: filters });
      return data;
    },
    refetchInterval: 30_000,
  });
}

export function useEngagementItem(id: string) {
  return useQuery({
    queryKey: ['engagement', id],
    queryFn: async () => {
      const { data } = await api.get<EngagementItem>(`/engagement/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['engagement', 'unread'],
    queryFn: async () => {
      const { data } = await api.get<{ unread: number }>('/engagement/unread-count');
      return data;
    },
    refetchInterval: 30_000,
  });
}

export function useApproveReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/engagement/${id}/approve-reply`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['engagement'] }),
  });
}

export function useManualReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, replyText }: { id: string; replyText: string }) =>
      api.post(`/engagement/${id}/reply`, { replyText }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['engagement'] }),
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/engagement/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['engagement'] });
    },
  });
}
