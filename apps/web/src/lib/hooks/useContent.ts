'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';

export interface Content {
  id: string;
  source: string;
  contentType: string;
  rawContent: Record<string, unknown>;
  targetPlatforms: string[];
  status: string;
  tone?: string;
  hashtags: string[];
  platformContent: Record<string, unknown>;
  agentProcessed: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useContentList(params?: {
  platform?: string; status?: string; page?: number; limit?: number;
}) {
  return useQuery({
    queryKey: ['content', params],
    queryFn: async () => {
      const { data } = await api.get<{ items: Content[]; total: number; page: number; totalPages: number }>('/content', { params });
      return data;
    },
  });
}

export function useContentItem(id: string) {
  return useQuery({
    queryKey: ['content', id],
    queryFn: async () => {
      const { data } = await api.get<Content>(`/content/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useGenerateContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: {
      topic: string; goal: string; targetPlatforms: string[];
      tone?: string; additionalContext?: string;
    }) => api.post<{ content: Content; platformContent: Record<string, unknown> }>('/content/generate', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['content'] }),
  });
}

export function useCreateContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: {
      rawContent: Record<string, unknown>;
      platformContent: Record<string, unknown>;
      targetPlatforms: string[];
      hashtags?: string[];
      status?: string;
    }) => api.post<Content>('/content', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['content'] }),
  });
}

export function useUpdateContent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { caption?: string; targetPlatforms?: string[]; tone?: string; hashtags?: string[] }) =>
      api.patch<Content>(`/content/${id}`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content', id] });
      qc.invalidateQueries({ queryKey: ['content'] });
    },
  });
}

export function useApproveContent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Content>(`/content/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content', id] });
      qc.invalidateQueries({ queryKey: ['content'] });
    },
  });
}

export function useDeleteContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/content/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['content'] }),
  });
}
