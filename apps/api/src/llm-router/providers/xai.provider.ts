import { OpenAiProvider } from './openai.provider';
import { LlmRequest, LlmResponse, ModelSpec } from '../llm-router.types';

const XAI_BASE_URL = 'https://api.x.ai/v1';

export class XAiProvider extends OpenAiProvider {
  constructor(apiKey: string) {
    super(apiKey, XAI_BASE_URL);
  }

  async generateText(request: LlmRequest, spec: ModelSpec): Promise<LlmResponse> {
    const response = await super.generateText(request, spec);
    return { ...response, provider: 'xai' };
  }

  async call(request: LlmRequest, spec: ModelSpec): Promise<LlmResponse> {
    return this.generateText(request, spec);
  }
}
