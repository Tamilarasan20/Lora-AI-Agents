import { api } from "./client";

export interface SophieRequest {
  topic: string;
  brand_name: string;
  brand_voice?: string;
  platform?: string;
  target_keywords?: string[];
  audience?: string;
}

export interface SophieResponse {
  agent: string;
  brief: Record<string, unknown>;
  router: {
    model: string;
    provider: string;
    cost_tier: string;
    cost_usd: number;
    latency_ms: number;
    fallback_path: string[];
  };
}

export const agentsApi = {
  sophie: (req: SophieRequest) =>
    api.post<SophieResponse>("/agents/sophie", req),
};
