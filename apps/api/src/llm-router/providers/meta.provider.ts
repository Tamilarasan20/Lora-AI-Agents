// Meta Llama models are served via Groq (fastest inference) or Meta's own API.
// Both expose an OpenAI-compatible endpoint — reuses OpenAiProvider.
import { OpenAiProvider } from './openai.provider';
import { LlmRequest, LlmResponse, ModelSpec } from '../llm-router.types';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

export class MetaProvider {
  private inner: OpenAiProvider;

  constructor(apiKey: string) {
    // apiKey here is the GROQ_API_KEY
    this.inner = new OpenAiProvider(apiKey, GROQ_BASE_URL);
  }

  async call(request: LlmRequest, spec: ModelSpec): Promise<LlmResponse> {
    const response = await this.inner.call(request, spec);
    return { ...response, provider: 'meta' };
  }
}
