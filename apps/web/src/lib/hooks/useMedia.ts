import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export function useMediaAssets(params?: { type?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['media', params],
    queryFn: () => api.get('/media', { params }).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useUploadMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['media'] }),
  });
}

export function usePresignedUpload() {
  return useMutation({
    mutationFn: (data: { filename: string; contentType: string; size: number }) =>
      api.post('/media/presigned-upload', data).then((r) => r.data),
  });
}

export function useDeleteMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/media/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['media'] }),
  });
}
