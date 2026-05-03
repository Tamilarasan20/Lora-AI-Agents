'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MarketingStrategy {
  id: string;
  title: string;
  goal: string;
  goalType: string;
  summary: string;
  targetAudience: string;
  brandVoiceDirection: string;
  positioning: string;
  channels: string[];
  contentPillars: string[];
  campaignIdeas: string[];
  executionPlan: unknown[];
  teamAssignments: unknown[];
  nextBestActions: string[];
  risks: string[];
  status: string;
  creditsUsed: number;
  createdAt: string;
  campaigns?: MarketingCampaign[];
  tasks?: MarketingTask[];
}

export interface MarketingCampaign {
  id: string;
  name: string;
  objective: string;
  channels: string[];
  status: string;
  startDate?: string;
  endDate?: string;
}

export interface MarketingTask {
  id: string;
  title: string;
  description: string;
  assignedAgent: string;
  priority: 'high' | 'medium' | 'low';
  status: string;
  reviewStatus: string;
  reviewedBy?: string;
  reviewNotes?: string;
  assignments?: AgentAssignment[];
  createdAt: string;
}

export interface AgentAssignment {
  id: string;
  agentName: string;
  agentRole: string;
  status: string;
}

export interface AgentOutput {
  id: string;
  agentName: string;
  outputType: string;
  content: unknown;
  status: string;
  qualityScore?: number;
  brandFitScore?: number;
  goalAlignmentScore?: number;
  reviewNotes?: string;
  reviewedByLora: boolean;
  createdAt: string;
}

export interface Approval {
  id: string;
  outputId: string;
  type: string;
  status: string;
  requestedBy: string;
  notes?: string;
  createdAt: string;
  output?: AgentOutput;
}

export interface CalendarItem {
  id: string;
  title: string;
  platform: string;
  contentType: string;
  scheduledAt?: string;
  publishStatus: string;
  assignedAgent?: string;
  approvalStatus: string;
}

export interface LoraDashboard {
  activeStrategies: MarketingStrategy[];
  pendingTasks: MarketingTask[];
  pendingApprovals: Approval[];
  upcomingCalendarItems: CalendarItem[];
  agentAssignments: unknown[];
  loraRecommendations: string[];
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useLoraDashboard() {
  return useQuery({
    queryKey: ['lora', 'dashboard'],
    queryFn: () => api.get('/lora/dashboard').then((r) => r.data as LoraDashboard),
    staleTime: 30_000,
  });
}

export function useCreateStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: {
      businessId: string;
      goal: string;
      timeline?: string;
      channels?: string[];
      targetAudience?: string;
      additionalContext?: string;
    }) => api.post('/lora/strategy', dto).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lora'] });
    },
  });
}

export function useStrategy(id: string) {
  return useQuery({
    queryKey: ['lora', 'strategy', id],
    queryFn: () => api.get(`/lora/strategy/${id}`).then((r) => r.data as MarketingStrategy),
    enabled: !!id,
  });
}

export function useStrategies() {
  return useQuery({
    queryKey: ['lora', 'strategies'],
    queryFn: () => api.get('/lora/strategies').then((r) => r.data as MarketingStrategy[]),
  });
}

export function useLoraTasks(status?: string) {
  return useQuery({
    queryKey: ['lora', 'tasks', status],
    queryFn: () =>
      api.get('/lora/tasks', { params: status ? { status } : {} }).then((r) => r.data as MarketingTask[]),
    staleTime: 15_000,
  });
}

export function useRunAgentTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { taskId: string; agentName: string }) =>
      api.post('/agents/run', dto).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lora', 'tasks'] });
      qc.invalidateQueries({ queryKey: ['lora', 'dashboard'] });
    },
  });
}

export function useLoraApprovals() {
  return useQuery({
    queryKey: ['lora', 'approvals'],
    queryFn: () => api.get('/lora/approvals').then((r) => r.data as Approval[]),
    staleTime: 15_000,
  });
}

export function useApproveOutput() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.post(`/approvals/${id}/approve`, { notes }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lora'] });
    },
  });
}

export function useRejectOutput() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.post(`/approvals/${id}/reject`, { notes }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lora'] });
    },
  });
}

export function useLoraCalendar(from?: string, to?: string) {
  return useQuery({
    queryKey: ['lora', 'calendar', from, to],
    queryFn: () =>
      api
        .get('/lora/calendar', { params: { from, to } })
        .then((r) => r.data as CalendarItem[]),
    staleTime: 60_000,
  });
}

export function useScheduleCalendarItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, scheduledAt }: { itemId: string; scheduledAt?: string }) =>
      api.post(`/lora/calendar/items/${itemId}/schedule`, { scheduledAt }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lora', 'calendar'] });
    },
  });
}

export function useStrategyLifecycle(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: 'activate' | 'pause' | 'complete' | 'archive') =>
      api.post(`/lora/strategy/${id}/${action}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lora', 'strategy', id] });
      qc.invalidateQueries({ queryKey: ['lora', 'strategies'] });
      qc.invalidateQueries({ queryKey: ['lora', 'dashboard'] });
    },
  });
}

export interface LoraConversation {
  id: string;
  title?: string;
  status: string;
  strategyId?: string;
  messages: LoraMessage[];
  createdAt: string;
}

export interface LoraMessage {
  id: string;
  role: string;
  agentName?: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export function useLoraConversation(id: string | null) {
  return useQuery({
    queryKey: ['lora', 'conversation', id],
    queryFn: () => api.get(`/lora/conversations/${id}`).then((r) => r.data as LoraConversation),
    enabled: !!id,
    staleTime: 10_000,
  });
}

export interface CreativeAsset {
  id: string;
  assetType: string;
  platform: string;
  title?: string;
  assetUrl: string;
  promptUsed?: string;
  provider?: string;
  model?: string;
  dimensions?: string;
  status: string;
  approvalStatus: string;
  slideNumber?: number;
  brandFitScore?: number;
  qualityScore?: number;
  createdAt: string;
}

export function useLoraAssets(platform?: string, status?: string) {
  return useQuery({
    queryKey: ['lora', 'assets', platform, status],
    queryFn: () =>
      api
        .get('/lora/assets', { params: { ...(platform ? { platform } : {}), ...(status ? { status } : {}) } })
        .then((r) => r.data as CreativeAsset[]),
    staleTime: 30_000,
  });
}

export interface CreditUsage {
  total: number;
  byAgent: Record<string, number>;
  byStrategy: Record<string, number>;
  transactions: Array<{
    id: string;
    agentName: string;
    action: string;
    credits: number;
    createdAt: string;
    metadata: Record<string, unknown>;
  }>;
}

export function useCreditUsage() {
  return useQuery({
    queryKey: ['lora', 'credits'],
    queryFn: () => api.get('/lora/credits/usage').then((r) => r.data as CreditUsage),
    staleTime: 60_000,
  });
}
