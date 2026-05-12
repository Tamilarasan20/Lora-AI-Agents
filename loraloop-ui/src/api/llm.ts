import { api } from "./client";

export interface ModelInfo {
  id: string;
  provider: string;
  tier: string;
  context_window: number;
  max_output_tokens: number;
  cost_input_per_1m_usd: number;
  cost_output_per_1m_usd: number;
  capabilities: string[];
  quality_score: number;
}

export interface ModelsResponse {
  count: number;
  models: ModelInfo[];
}

export const llmApi = {
  models: () => api.get<ModelsResponse>("/llm/models"),
  costExplain: (model: string, inputTokens: number, outputTokens: number) =>
    api.get<Record<string, unknown>>(
      `/llm/cost-explain?model=${model}&input_tokens=${inputTokens}&output_tokens=${outputTokens}`
    ),
};
