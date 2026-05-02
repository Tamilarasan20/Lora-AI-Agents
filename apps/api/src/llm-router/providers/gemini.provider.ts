import { GoogleGenerativeAI, Content, Part, SchemaType } from '@google/generative-ai';
import {
  LlmRequest, LlmResponse, LlmMessage, LlmContentBlock, ModelSpec,
  ImageGenerationRequest, ImageGenerationResponse,
  VideoGenerationRequest, VideoGenerationResponse,
  AudioRequest, AudioResponse,
} from '../llm-router.types';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiProvider {
  private readonly genAI: GoogleGenerativeAI;

  constructor(private readonly apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  // ─── Text generation ────────────────────────────────────────────────────────

  async generateText(request: LlmRequest, spec: ModelSpec): Promise<LlmResponse> {
    const start = Date.now();
    const model = this.genAI.getGenerativeModel({ model: spec.modelId });

    const { history, lastMessage } = this.toGeminiHistory(request.messages);

    const tools = request.tools?.length
      ? [{
          functionDeclarations: request.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: {
              type: SchemaType.OBJECT,
              properties: t.inputSchema.properties ?? {},
              required: t.inputSchema.required ?? [],
            },
          })) as any[],
        }] as any
      : undefined;

    const chat = model.startChat({
      systemInstruction: request.systemPrompt
        ? { role: 'user', parts: [{ text: request.systemPrompt }] }
        : undefined,
      history,
      tools,
      generationConfig: {
        maxOutputTokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
      },
    });

    const result = await chat.sendMessage(lastMessage);
    const response = result.response;
    const latencyMs = Date.now() - start;

    const textContent = response.candidates?.[0]?.content?.parts
      ?.filter((p) => 'text' in p)
      .map((p) => (p as { text: string }).text)
      .join('\n') ?? '';

    const fnCalls = response.candidates?.[0]?.content?.parts
      ?.filter((p) => 'functionCall' in p)
      .map((p) => {
        const fc = (p as { functionCall: { name: string; args: Record<string, unknown> } }).functionCall;
        return { id: `${fc.name}-${Date.now()}`, name: fc.name, input: fc.args };
      }) ?? [];

    const usage = response.usageMetadata;
    const inputTokens = usage?.promptTokenCount ?? 0;
    const outputTokens = usage?.candidatesTokenCount ?? 0;

    return {
      content: textContent,
      toolCalls: fnCalls.length ? fnCalls : undefined,
      stopReason: fnCalls.length ? 'tool_use' : 'end_turn',
      usage: { inputTokens, outputTokens },
      model: spec.modelId,
      provider: 'google',
      latencyMs,
      costUsd: this.calcCost(spec, inputTokens, outputTokens),
    };
  }

  /** Backward-compat alias */
  async call(request: LlmRequest, spec: ModelSpec): Promise<LlmResponse> {
    return this.generateText(request, spec);
  }

  // ─── Image generation (Imagen 3) ────────────────────────────────────────────

  async generateImage(req: ImageGenerationRequest, modelId: string): Promise<ImageGenerationResponse> {
    const start = Date.now();

    const res = await fetch(
      `${GEMINI_API_BASE}/models/${modelId}:predict?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: req.prompt }],
          parameters: { sampleCount: 1 },
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Imagen generation failed: ${err}`);
    }

    const data = await res.json() as {
      predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
    };

    const prediction = data.predictions?.[0];
    if (!prediction?.bytesBase64Encoded) {
      throw new Error('Imagen returned no image data');
    }

    const url = `data:${prediction.mimeType ?? 'image/png'};base64,${prediction.bytesBase64Encoded}`;

    return {
      url,
      model: modelId,
      provider: 'google',
      latencyMs: Date.now() - start,
      costUsd: 0.02, // ~$0.02 per Imagen 3 image
    };
  }

  // ─── Video generation (Veo 3) ───────────────────────────────────────────────

  async generateVideo(req: VideoGenerationRequest, modelId: string): Promise<VideoGenerationResponse> {
    const start = Date.now();

    // Submit video generation job
    const submitRes = await fetch(
      `${GEMINI_API_BASE}/models/${modelId}:predictLongRunning?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{
            prompt: req.prompt,
            ...(req.imageUrl ? { image: { url: req.imageUrl } } : {}),
          }],
          parameters: {
            aspectRatio: req.aspectRatio ?? '16:9',
            durationSeconds: req.durationSeconds ?? 5,
          },
        }),
      },
    );

    if (!submitRes.ok) {
      const err = await submitRes.text();
      throw new Error(`Veo 3 submission failed: ${err}`);
    }

    const operation = await submitRes.json() as { name: string };
    const videoUrl = await this.pollVideoOperation(operation.name, 600_000);

    return {
      url: videoUrl,
      model: modelId,
      provider: 'google',
      latencyMs: Date.now() - start,
      costUsd: (req.durationSeconds ?? 5) * 0.35, // ~$0.35/s for Veo 3
    };
  }

  // ─── Audio (Gemini for transcription via multimodal) ─────────────────────────

  async processAudio(req: AudioRequest): Promise<AudioResponse> {
    if (req.type !== 'transcribe') {
      throw new Error('Gemini provider only supports audio transcription (type=transcribe)');
    }
    if (!req.audioUrl) throw new Error('audioUrl required for transcription');

    const start = Date.now();
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent([
      { text: 'Transcribe the following audio accurately:' },
      {
        fileData: {
          mimeType: 'audio/mpeg',
          fileUri: req.audioUrl,
        },
      },
    ]);

    return {
      text: result.response.text(),
      model: 'gemini-2.0-flash',
      provider: 'google',
      latencyMs: Date.now() - start,
      costUsd: 0.001,
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private toGeminiHistory(messages: LlmMessage[]): { history: Content[]; lastMessage: Part[] } {
    if (messages.length === 0) {
      return { history: [], lastMessage: [{ text: '' }] };
    }

    const history: Content[] = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: this.toGeminiParts(m),
    }));

    const last = messages[messages.length - 1];
    return { history, lastMessage: this.toGeminiParts(last) };
  }

  private toGeminiParts(msg: LlmMessage): Part[] {
    if (typeof msg.content === 'string') return [{ text: msg.content }];
    return (msg.content as LlmContentBlock[]).reduce<Part[]>((acc, block) => {
      if (block.type === 'text' && block.text) acc.push({ text: block.text });
      if (block.type === 'tool_result') {
        acc.push({ text: JSON.stringify(block.toolResult) });
      }
      return acc;
    }, []);
  }

  private async pollVideoOperation(operationName: string, timeoutMs: number): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await fetch(
        `${GEMINI_API_BASE}/${operationName}?key=${this.apiKey}`,
      );
      const op = await res.json() as {
        done?: boolean;
        response?: { predictions?: Array<{ video?: { uri?: string } }> };
        error?: { message: string };
      };

      if (op.error) throw new Error(`Veo 3 error: ${op.error.message}`);
      if (op.done) {
        const uri = op.response?.predictions?.[0]?.video?.uri;
        if (!uri) throw new Error('Veo 3 returned no video URI');
        return uri;
      }
      await new Promise((r) => setTimeout(r, 10_000));
    }
    throw new Error('Veo 3 operation timed out');
  }

  private calcCost(spec: ModelSpec, input: number, output: number): number {
    return (input / 1_000_000) * spec.inputCostPer1M +
           (output / 1_000_000) * spec.outputCostPer1M;
  }
}
