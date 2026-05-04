export const LLM_ROUTER_EVENTS = {
  ROUTE_STARTED:           'llm.route.started',
  ADVISOR_COMPLETED:       'llm.route.advisor_completed',
  GOVERNOR_COMPLETED:      'llm.route.governor_completed',
  MODEL_SELECTED:          'llm.route.model_selected',
  CREDIT_RESERVED:         'llm.route.credit_reserved',
  PROVIDER_STARTED:        'llm.route.provider_started',
  PROVIDER_COMPLETED:      'llm.route.provider_completed',
  FALLBACK_STARTED:        'llm.route.fallback_started',
  COMPLETED:               'llm.route.completed',
  FAILED:                  'llm.route.failed',
  INSUFFICIENT_CREDITS:    'llm.route.insufficient_credits',
} as const;

export type LlmRouterEventType = typeof LLM_ROUTER_EVENTS[keyof typeof LLM_ROUTER_EVENTS];

export interface LlmRouterEventPayload {
  requestId:         string;
  conversationId?:   string;
  agentName?:        string;
  status:            string;
  selectedProvider?: string;
  selectedModel?:    string;
  routeTier?:        string;
  estimatedCredits?: number;
  creditsDeducted?:  number;
  fallbackUsed?:     boolean;
  errorCode?:        string;
  message?:          string;
}
