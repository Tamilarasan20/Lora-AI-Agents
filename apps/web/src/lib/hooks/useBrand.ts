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
