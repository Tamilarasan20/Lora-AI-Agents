import OpenAI from 'openai';
import {
  LlmRequest, LlmResponse, LlmMessage, LlmContentBlock, ModelSpec,
  ImageGenerationRequest, ImageGenerationResponse,
  AudioRequest, AudioResponse,
} from '../llm-router.types';

export class OpenAiProvider {
  protected readonly client: OpenAI;

  constructor(apiKey: string, baseUrl?: string) {
    this.client = new OpenAI({ apiKey, baseURL: baseUrl });
  }

  // ─── Text generation ────────────────────────────────────────────────────────

  async generateText(request: LlmRequest, spec: ModelSpec): Promise<LlmResponse> {
    const start = Date.now();

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: request.systemPrompt },
      ...request.messages.map((m) => this.toOpenAiMessage(m)),
    ];

    const tools: OpenAI.ChatCompletionTool[] | undefined = request.tools?.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: { type: 'object', ...t.inputSchema },
      },
    }));

    const params: OpenAI.ChatCompletionCreateParamsNonStreaming = {
      model: spec.modelId,
      messages,
      max_tokens: request.maxTokens ?? 4096,
      tools: tools?.length ? tools : undefined,
      tool_choice: tools?.length ? 'auto' : undefined,
    };

    // Reasoning models (o-series) don't support temperature
    if (!spec.modelId.startsWith('o')) {
      (params as any).temperature = request.temperature ?? 0.7;
    }

    const response = await this.client.chat.completions.create(params);
    const latencyMs = Date.now() - start;
    const choice = response.choices[0];
    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;

    const toolCalls = choice.message.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments) as Record<string, unknown>,
    }));

    return {
      content: choice.message.content ?? '',
      toolCalls: toolCalls?.length ? toolCalls : undefined,
      stopReason: choice.finish_reason === 'tool_calls' ? 'tool_use'
        : choice.finish_reason === 'length' ? 'max_tokens' : 'end_turn',
      usage: { inputTokens, outputTokens },
      model: spec.modelId,
      provider: spec.provider,
      latencyMs,
      costUsd: this.calcCost(spec, inputTokens, outputTokens),
    };
  }

  /** Backward-compat alias */
  async call(request: LlmRequest, spec: ModelSpec): Promise<LlmResponse> {
    return this.generateText(request, spec);
  }

  // ─── Image generation (DALL-E) ───────────────────────────────────────────────

  async generateImage(req: ImageGenerationRequest, modelId: string): Promise<ImageGenerationResponse> {
    const start = Date.now();
    const size = req.width && req.height
      ? (`${req.width}x${req.height}` as '1024x1024' | '512x512' | '256x256' | '1792x1024' | '1024x1792')
      : '1024x1024';

    const response = await this.client.images.generate({
      model: modelId,
      prompt: req.prompt,
      size,
      quality: req.quality ?? 'standard',
      n: 1,
    });

    const url = response.data?.[0]?.url ?? '';

    const costUsd = modelId === 'dall-e-3'
      ? (req.quality === 'hd' ? 0.080 : 0.040)
      : 0.020;

    return {
      url,
      model: modelId,
      provider: 'openai',
      latencyMs: Date.now() - start,
      costUsd,
    };
  }

  // ─── Audio processing ────────────────────────────────────────────────────────

  async processAudio(req: AudioRequest): Promise<AudioResponse> {
    if (req.type === 'transcribe') {
      return this.transcribe(req);
    }
    return this.synthesizeSpeech(req);
  }

  private async transcribe(req: AudioRequest): Promise<AudioResponse> {
    if (!req.audioUrl) throw new Error('audioUrl required for transcription');
    const start = Date.now();

    const audioRes = await fetch(req.audioUrl);
    if (!audioRes.ok) throw new Error(`Failed to fetch audio: ${req.audioUrl}`);
    const blob = await audioRes.blob();
    const file = new File([blob], 'audio.mp3', { type: blob.type || 'audio/mpeg' });

    const transcription = await this.client.audio.transcriptions.create({
      file,
      model: 'whisper-1',
    });

    const estimatedMinutes = blob.size / (128 * 1024 / 8 * 60);
    return {
      text: transcription.text,
      model: 'whisper-1',
      provider: 'openai',
      latencyMs: Date.now() - start,
      costUsd: Math.max(0.006, estimatedMinutes * 0.006),
    };
  }

  private async synthesizeSpeech(req: AudioRequest): Promise<AudioResponse> {
    if (!req.text) throw new Error('text required for TTS');
    const start = Date.now();

    const mp3 = await this.client.audio.speech.create({
      model: 'tts-1',
      voice: (req.voiceId as any) ?? 'alloy',
      input: req.text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    const audioUrl = `data:audio/mpeg;base64,${buffer.toString('base64')}`;

    return {
      audioUrl,
      model: 'tts-1',
      provider: 'openai',
      latencyMs: Date.now() - start,
      costUsd: (req.text.length / 1_000_000) * 15.00, // $15 per 1M chars
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private toOpenAiMessage(msg: LlmMessage): OpenAI.ChatCompletionMessageParam {
    if (typeof msg.content === 'string') {
      return { role: msg.role, content: msg.content } as OpenAI.ChatCompletionMessageParam;
    }

    const blocks = msg.content as LlmContentBlock[];
    const textBlocks = blocks.filter((b) => b.type === 'text');
    const toolUseBlocks = blocks.filter((b) => b.type === 'tool_use');
    const toolResultBlocks = blocks.filter((b) => b.type === 'tool_result');

    if (toolResultBlocks.length > 0) {
      return {
        role: 'tool',
        tool_call_id: toolResultBlocks[0].toolUseId!,
        content: JSON.stringify(toolResultBlocks[0].toolResult),
      };
    }

    if (toolUseBlocks.length > 0 && msg.role === 'assistant') {
      return {
        role: 'assistant',
        content: textBlocks[0]?.text ?? null,
        tool_calls: toolUseBlocks.map((b) => ({
          id: b.toolUseId!,
          type: 'function' as const,
          function: { name: b.toolName!, arguments: JSON.stringify(b.toolInput) },
        })),
      };
    }

    return {
      role: msg.role,
      content: textBlocks.map((b) => b.text).join('\n'),
    } as OpenAI.ChatCompletionMessageParam;
  }

  protected calcCost(spec: ModelSpec, input: number, output: number): number {
    return (input / 1_000_000) * spec.inputCostPer1M +
           (output / 1_000_000) * spec.outputCostPer1M;
  }
}
