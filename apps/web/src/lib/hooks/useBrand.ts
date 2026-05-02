import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export function useBrandProfile() {
  return useQuery({
    queryKey: ['brand'],
    queryFn: () => api.get('/brand').then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useUpdateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) => api.put('/brand', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brand'] }),
  });
}

export function useBrandVoice() {
  return useQuery({
    queryKey: ['brand', 'voice'],
    queryFn: () => api.get('/brand/voice').then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useUpdateBrandVoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) => api.put('/brand/voice', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brand'] }),
  });
}

export function useCompetitors() {
  return useQuery({
    queryKey: ['brand', 'competitors'],
    queryFn: () => api.get('/brand/competitors').then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useAddCompetitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { platform: string; handle: string }) =>
      api.post('/brand/competitors', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brand', 'competitors'] }),
  });
}

export function useRemoveCompetitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/brand/competitors/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brand', 'competitors'] }),
  });
}

export function useAnalyzeBrandWebsite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (websiteUrl: string) =>
      api.post('/brand/analyze-website', { websiteUrl }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brand'] });
      qc.invalidateQueries({ queryKey: ['brand', 'voice'] });
    },
  });
}

export function useBrandMarkdown() {
  return useQuery({
    queryKey: ['brand', 'markdown'],
    queryFn: () => api.get('/brand/markdown').then((r) => r.data),
    enabled: false,
  });
}

export function useBrandDocuments() {
  return useQuery({
    queryKey: ['brand', 'documents'],
    queryFn: () => api.get('/brand/documents').then((r) => r.data),
    enabled: false,
  });
}

export function useBrandValidationHistory() {
  return useQuery({
    queryKey: ['brand', 'validation-history'],
    queryFn: () => api.get('/brand/validation-history').then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

// ── Intelligence hooks ─────────────────────────────────────────────────────

export function useBrandDna() {
  return useQuery({
    queryKey: ['brand', 'intelligence', 'dna'],
    queryFn: () => api.get('/brand/intelligence/dna').then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useExtractDna() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/brand/intelligence/dna/extract').then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brand', 'intelligence', 'dna'] }),
  });
}

export function useBrandMemory(limit?: number) {
  return useQuery({
    queryKey: ['brand', 'intelligence', 'memory', limit],
    queryFn: () => api.get('/brand/intelligence/memory', { params: { limit } }).then((r) => r.data),
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
