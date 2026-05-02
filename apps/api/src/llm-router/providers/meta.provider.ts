import { OpenAiProvider } from './openai.provider';
import { LlmRequest, LlmResponse, ModelSpec } from '../llm-router.types';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

export class MetaProvider extends OpenAiProvider {
  constructor(apiKey: string) {
    super(apiKey, GROQ_BASE_URL);
  }

  async generateText(request: LlmRequest, spec: ModelSpec): Promise<LlmResponse> {
    const response = await super.generateText(request, spec);
    return { ...response, provider: 'meta' };
  }

  async call(request: LlmRequest, spec: ModelSpec): Promise<LlmResponse> {
    return this.generateText(request, spec);
  }
}
