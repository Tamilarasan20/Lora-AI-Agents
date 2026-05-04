'use client';
import { useQuery } from '@tanstack/react-query';
import api from '../api';

export interface CreditsInfo {
  used: number;
  limit: number;
  remaining: number;
  plan: string;
  subscriptionStatus: string;
}

export interface SubscriptionDetails {
  plan: string;
  subscriptionStatus: string;
  renewsAt: string;
  credits: CreditsInfo;
  lastCreditReset: string | null;
}

export function useCredits() {
  return useQuery<CreditsInfo>({
    queryKey: ['billing', 'credits'],
    queryFn: () => api.get('/billing/credits').then((r) => r.data),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useSubscription() {
  return useQuery<SubscriptionDetails>({
    queryKey: ['billing', 'subscription'],
    queryFn: () => api.get('/billing/subscription').then((r) => r.data),
    staleTime: 60_000,
  });
}
