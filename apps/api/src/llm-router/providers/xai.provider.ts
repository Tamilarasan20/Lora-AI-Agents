// xAI Grok uses an OpenAI-compatible API — reuses OpenAiProvider with a custom base URL.
import { OpenAiProvider } from './openai.provider';
import { LlmRequest, LlmResponse, ModelSpec } from '../llm-router.types';

const XAI_BASE_URL = 'https://api.x.ai/v1';

export class XAiProvider {
  private inner: OpenAiProvider;

  constructor(apiKey: string) {
    this.inner = new OpenAiProvider(apiKey, XAI_BASE_URL);
  }

  async call(request: LlmRequest, spec: ModelSpec): Promise<LlmResponse> {
    const response = await this.inner.call(request, spec);
    // Override provider tag so metrics/logs show 'xai' not 'openai'
    return { ...response, provider: 'xai' };
  }
}
