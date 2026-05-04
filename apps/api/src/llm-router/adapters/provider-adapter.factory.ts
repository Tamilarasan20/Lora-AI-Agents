import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmProviderAdapter } from './llm-provider.interface';
import { OpenAiAdapter } from './openai.adapter';
import { AnthropicAdapter } from './anthropic.adapter';
import { GeminiAdapter } from './gemini.adapter';
import { PerplexityAdapter } from './perplexity.adapter';
import { XaiAdapter } from './xai.adapter';
import { MetaAdapter } from './meta.adapter';

@Injectable()
export class ProviderAdapterFactory {
  private readonly logger = new Logger(ProviderAdapterFactory.name);
  private readonly adapters = new Map<string, LlmProviderAdapter>();

  constructor(private readonly config: ConfigService) {
    this.initAdapters();
  }

  get(providerName: string, modelId: string): LlmProviderAdapter | undefined {
    const key = `${providerName}:${modelId}`;
    if (this.adapters.has(key)) return this.adapters.get(key);

    // Create on demand for dynamic model selection
    const adapter = this.createAdapter(providerName, modelId);
    if (adapter) this.adapters.set(key, adapter);
    return adapter;
  }

  getHealthyProviders(): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const key of this.adapters.keys()) {
      const provider = key.split(':')[0];
      if (!seen.has(provider)) {
        seen.add(provider);
        result.push(provider);
      }
    }
    return result;
  }

  private initAdapters(): void {
    const pairs: Array<[string, string, string]> = [
      ['OPENAI_API_KEY',      'openai',      'gpt-4o-mini'],
      ['ANTHROPIC_API_KEY',   'anthropic',   'claude-haiku-4-5-20251001'],
      ['GEMINI_API_KEY',      'gemini',      'gemini-2.0-flash'],
      ['PERPLEXITY_API_KEY',  'perplexity',  'sonar'],
      ['XAI_API_KEY',         'xai',         'grok-3-mini'],
      ['GROQ_API_KEY',        'meta',        'meta-llama/llama-4-maverick-17b-128e-instruct'],
    ];

    for (const [envKey, provider, defaultModel] of pairs) {
      const apiKey = this.config.get<string>(envKey);
      if (apiKey) {
        const adapter = this.createAdapter(provider, defaultModel, apiKey);
        if (adapter) {
          this.adapters.set(`${provider}:${defaultModel}`, adapter);
          this.logger.log(`✅ Provider adapter ready: ${provider}`);
        }
      }
    }

    if (this.adapters.size === 0) {
      this.logger.warn('⚠️  No provider adapters configured — set at least one API key');
    }
  }

  private createAdapter(providerName: string, modelId: string, apiKeyOverride?: string): LlmProviderAdapter | undefined {
    const keyMap: Record<string, string> = {
      openai:     'OPENAI_API_KEY',
      anthropic:  'ANTHROPIC_API_KEY',
      gemini:     'GEMINI_API_KEY',
      perplexity: 'PERPLEXITY_API_KEY',
      xai:        'XAI_API_KEY',
      meta:       'GROQ_API_KEY',
    };

    const apiKey = apiKeyOverride ?? this.config.get<string>(keyMap[providerName] ?? '');
    if (!apiKey) return undefined;

    switch (providerName) {
      case 'openai':     return new OpenAiAdapter(apiKey, modelId);
      case 'anthropic':  return new AnthropicAdapter(apiKey, modelId);
      case 'gemini':     return new GeminiAdapter(apiKey, modelId);
      case 'perplexity': return new PerplexityAdapter(apiKey, modelId);
      case 'xai':        return new XaiAdapter(apiKey, modelId);
      case 'meta':       return new MetaAdapter(apiKey, modelId);
      default:
        this.logger.warn(`Unknown provider: ${providerName}`);
        return undefined;
    }
  }
}
