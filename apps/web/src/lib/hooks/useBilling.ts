'use client';
import { useMutation } from '@tanstack/react-query';
import api from '../api';

export function useCreateCheckout() {
  return useMutation({
    mutationFn: (body: { priceId: string; returnUrl: string }) =>
      api.post<{ url: string }>('/billing/checkout', body),
    onSuccess: ({ data }) => {
      if (data.url) window.location.href = data.url;
    },
  });
}

export function useOpenPortal() {
  return useMutation({
    mutationFn: (returnUrl: string) =>
      api.post<{ url: string }>('/billing/portal', { returnUrl }),
    onSuccess: ({ data }) => {
      if (data.url) window.location.href = data.url;
    },
  });
}
