import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';

// ── Workspaces ─────────────────────────────────────────────────────────────

export const useWorkspaces = () =>
  useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.get('/workspaces').then((r) => r.data),
  });

export const useWorkspace = (id: string) =>
  useQuery({
    queryKey: ['workspaces', id],
    queryFn: () => api.get(`/workspaces/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useCreateWorkspace = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; slug: string; description?: string }) =>
      api.post('/workspaces', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspaces'] }),
  });
};

// ── Projects ───────────────────────────────────────────────────────────────

export const useProjects = (workspaceId: string) =>
  useQuery({
    queryKey: ['projects', workspaceId],
    queryFn: () => api.get(`/workspaces/${workspaceId}/projects`).then((r) => r.data),
    enabled: !!workspaceId,
  });

export const useProject = (workspaceId: string, projectId: string) =>
  useQuery({
    queryKey: ['projects', workspaceId, projectId],
    queryFn: () => api.get(`/workspaces/${workspaceId}/projects/${projectId}`).then((r) => r.data),
    enabled: !!workspaceId && !!projectId,
  });

export const useCreateProject = (workspaceId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; websiteUrl: string; description?: string; crawlDepth?: number }) =>
      api.post(`/workspaces/${workspaceId}/projects`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', workspaceId] }),
  });
};

// ── Crawls ─────────────────────────────────────────────────────────────────

export const useStartCrawl = () =>
  useMutation({
    mutationFn: (data: { projectId: string; workspaceId: string; websiteUrl: string; depth?: number }) =>
      api.post('/crawls', data).then((r) => r.data),
  });

export const useCrawlStatus = (crawlId: string) =>
  useQuery({
    queryKey: ['crawl-status', crawlId],
    queryFn: () => api.get(`/crawls/${crawlId}/status`).then((r) => r.data),
    enabled: !!crawlId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'RUNNING' || status === 'PENDING' ? 5000 : false;
    },
  });

export const useProjectCrawls = (projectId: string) =>
  useQuery({
    queryKey: ['crawls', projectId],
    queryFn: () => api.get(`/crawls/project/${projectId}`).then((r) => r.data),
    enabled: !!projectId,
  });

// ── Knowledge ──────────────────────────────────────────────────────────────

export const useKnowledgeBase = (projectId: string) =>
  useQuery({
    queryKey: ['knowledge', projectId],
    queryFn: () => api.get(`/projects/${projectId}/knowledge`).then((r) => r.data),
    enabled: !!projectId,
    retry: false,
  });

// ── SEO ────────────────────────────────────────────────────────────────────

export const useSeoData = (projectId: string) =>
  useQuery({
    queryKey: ['seo', projectId],
    queryFn: () => api.get(`/projects/${projectId}/seo`).then((r) => r.data),
    enabled: !!projectId,
    retry: false,
  });

// ── Visual ─────────────────────────────────────────────────────────────────

export const useVisualAssets = (projectId: string) =>
  useQuery({
    queryKey: ['visual-assets', projectId],
    queryFn: () => api.get(`/projects/${projectId}/visual/assets`).then((r) => r.data),
    enabled: !!projectId,
  });

// ── Creatives ──────────────────────────────────────────────────────────────

export const useCreatives = (projectId: string, type?: string) =>
  useQuery({
    queryKey: ['creatives', projectId, type],
    queryFn: () =>
      api.get(`/projects/${projectId}/creatives`, { params: type ? { type } : {} }).then((r) => r.data),
    enabled: !!projectId,
  });

export const useGenerateCreative = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      type: string;
      count?: number;
      platform?: string;
      tone?: string;
      additionalContext?: string;
    }) => api.post(`/projects/${projectId}/creatives/generate`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['creatives', projectId] }),
  });
};
