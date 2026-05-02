import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  BrandDnaRecord,
  BrandMemoryRecord,
  BrandProfileRecord,
  BrandValidationRecord,
  CompetitorRecord,
} from '@/lib/brand-types';

async function brandRequest<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/brand${input}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? `Brand request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function useBrandProfile() {
  return useQuery<BrandProfileRecord>({
    queryKey: ['brand'],
    queryFn: () => brandRequest(''),
    staleTime: 60_000,
  });
}

export function useUpdateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) =>
      brandRequest('', { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brand'] }),
  });
}

export function useBrandVoice() {
  return useQuery<{
    tone: string;
    voiceCharacteristics: string[];
    brandDescription: string;
    valueProposition: string;
    autoReplyEnabled: boolean;
    sentimentThreshold: number;
  }>({
    queryKey: ['brand', 'voice'],
    queryFn: () => brandRequest('/voice'),
    staleTime: 60_000,
  });
}

export function useUpdateBrandVoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) =>
      brandRequest('/voice', { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brand'] }),
  });
}

export function useCompetitors() {
  return useQuery<CompetitorRecord[]>({
    queryKey: ['brand', 'competitors'],
    queryFn: () => brandRequest('/competitors'),
    staleTime: 60_000,
  });
}

export function useAddCompetitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { platform: string; handle: string }) =>
      brandRequest('/competitors', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brand', 'competitors'] }),
  });
}

export function useRemoveCompetitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => brandRequest(`/competitors/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brand', 'competitors'] }),
  });
}

export function useAnalyzeBrandWebsite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (websiteUrl: string) =>
      brandRequest('/analyze-website', { method: 'POST', body: JSON.stringify({ websiteUrl }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brand'] });
      qc.invalidateQueries({ queryKey: ['brand', 'voice'] });
      qc.invalidateQueries({ queryKey: ['brand', 'documents'] });
      qc.invalidateQueries({ queryKey: ['brand', 'validation-history'] });
      qc.invalidateQueries({ queryKey: ['brand', 'intelligence', 'dna'] });
      qc.invalidateQueries({ queryKey: ['brand', 'intelligence', 'memory'] });
    },
  });
}

// ─── Pomelli-style async knowledge-base generation ───────────────────────
// These hooks talk directly to the NestJS API (via the authenticated axios
// client) instead of the local brand-store, because the long-running
// generation job lives on the backend.

export type BrandAnalysisJobStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'AWAITING_REVIEW'
  | 'APPROVED'
  | 'FAILED'
  | 'CANCELLED';

export interface BrandAnalysisJobStage {
  key: 'crawl' | 'images' | 'extract' | 'documents' | 'finalize';
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface BrandAnalysisJob {
  id: string;
  websiteUrl: string;
  status: BrandAnalysisJobStatus;
  currentStage: string | null;
  progressPct: number;
  stages: BrandAnalysisJobStage[];
  draftResult: Record<string, unknown> | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  approvedAt: string | null;
}

export function useStartBrandKnowledgeJob() {
  return useMutation({
    mutationFn: async (websiteUrl: string) => {
      const { default: api } = await import('@/lib/api');
      const { data } = await api.post<{ jobId: string; status: BrandAnalysisJobStatus; websiteUrl: string }>(
        '/brand/analyze-website',
        { websiteUrl },
      );
      return data;
    },
  });
}

/** Polls the job until it reaches a terminal-or-review state. */
export function useBrandKnowledgeJob(jobId: string | null | undefined) {
  return useQuery<BrandAnalysisJob>({
    queryKey: ['brand', 'analyze-job', jobId],
    queryFn: async () => {
      const { default: api } = await import('@/lib/api');
      const { data } = await api.get<BrandAnalysisJob>(`/brand/analyze-website/jobs/${jobId}`);
      return data;
    },
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status) return 2_000;
      // Stop polling once we reach a terminal/review state
      if (['AWAITING_REVIEW', 'APPROVED', 'FAILED', 'CANCELLED'].includes(status)) return false;
      return 2_000;
    },
  });
}

export function useUpdateBrandKnowledgeDraft(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { default: api } = await import('@/lib/api');
      const { data } = await api.patch<BrandAnalysisJob>(
        `/brand/analyze-website/jobs/${jobId}/draft`,
        patch,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brand', 'analyze-job', jobId] }),
  });
}

export function useApproveBrandKnowledgeJob(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { default: api } = await import('@/lib/api');
      const { data } = await api.post<BrandAnalysisJob>(`/brand/analyze-website/jobs/${jobId}/approve`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brand'] });
      qc.invalidateQueries({ queryKey: ['brand', 'analyze-job', jobId] });
    },
  });
}

export function useCancelBrandKnowledgeJob(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { default: api } = await import('@/lib/api');
      const { data } = await api.post<BrandAnalysisJob>(`/brand/analyze-website/jobs/${jobId}/cancel`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brand', 'analyze-job', jobId] }),
  });
}

export function useBrandMarkdown() {
  return useQuery({
    queryKey: ['brand', 'markdown'],
    queryFn: () => brandRequest('/documents'),
    enabled: false,
  });
}

export function useBrandDocuments() {
  return useQuery<Record<string, string | null>>({
    queryKey: ['brand', 'documents'],
    queryFn: () => brandRequest('/documents'),
    enabled: false,
  });
}

export function useBrandValidationHistory() {
  return useQuery<BrandValidationRecord[]>({
    queryKey: ['brand', 'validation-history'],
    queryFn: () => brandRequest('/validation-history'),
    staleTime: 5 * 60_000,
  });
}

// ── Intelligence hooks ─────────────────────────────────────────────────────

export function useBrandDna() {
  return useQuery<BrandDnaRecord>({
    queryKey: ['brand', 'intelligence', 'dna'],
    queryFn: () => brandRequest('/intelligence/dna'),
    staleTime: 5 * 60_000,
  });
}

export function useExtractDna() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => brandRequest('/intelligence/dna/extract', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brand', 'intelligence', 'dna'] }),
  });
}

export function useBrandMemory(limit?: number) {
  return useQuery<BrandMemoryRecord[]>({
    queryKey: ['brand', 'intelligence', 'memory', limit],
    queryFn: () => brandRequest(`/intelligence/memory?limit=${limit ?? 10}`),
    staleTime: 30_000,
  });
}

export function useCustomerVoice() {
  return useQuery({
    queryKey: ['brand', 'intelligence', 'voice'],
    queryFn: () => api.get('/brand/intelligence/customer-voice').then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useIngestCustomerVoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { sourceType: string; texts: string[]; sourceUrl?: string }) =>
      api.post('/brand/intelligence/customer-voice', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brand', 'intelligence', 'voice'] }),
  });
}

export function useCompetitorSnapshots() {
  return useQuery({
    queryKey: ['brand', 'intelligence', 'competitors'],
    queryFn: () => api.get('/brand/intelligence/competitors').then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useCompetitiveReport() {
  return useQuery({
    queryKey: ['brand', 'intelligence', 'competitive-report'],
    queryFn: () => api.get('/brand/intelligence/competitors/report').then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useAnalyzeCompetitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { platform: string; handle: string; websiteUrl?: string }) =>
      api.post('/brand/intelligence/competitors/analyze', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brand', 'intelligence', 'competitors'] }),
  });
}

export function useBrandDrift() {
  return useQuery({
    queryKey: ['brand', 'intelligence', 'drift'],
    queryFn: () => api.get('/brand/intelligence/drift').then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useFullEnrich() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/brand/intelligence/enrich').then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brand', 'intelligence'] });
      qc.invalidateQueries({ queryKey: ['brand'] });
    },
  });
}

export function useAgentContext(agent: string) {
  return useQuery({
    queryKey: ['brand', 'intelligence', 'agent', agent],
    queryFn: () => api.get(`/brand/intelligence/agent/${agent}`).then((r) => r.data),
    staleTime: 2 * 60_000,
    enabled: !!agent,
  });
}
