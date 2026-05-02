import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from '@google/generative-ai';
import {
  LlmRequest, LlmResponse, LlmMessage, LlmContentBlock, ModelSpec,
} from '../llm-router.types';

export class GoogleProvider {
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async call(request: LlmRequest, spec: ModelSpec): Promise<LlmResponse> {
    const start = Date.now();

    const tools: FunctionDeclaration[] | undefined = request.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: this.toGeminiSchema(t.inputSchema),
    }));

    const model = this.client.getGenerativeModel({
      model: spec.modelId,
      systemInstruction: request.systemPrompt,
      tools: tools?.length ? [{ functionDeclarations: tools }] : undefined,
      generationConfig: {
        maxOutputTokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
      },
    });

    // Convert messages to Gemini history format
    const history = request.messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: this.toGeminiParts(m),
    }));

    const lastMessage = request.messages[request.messages.length - 1];
    const chat = model.startChat({ history });

    const result = await chat.sendMessage(this.toGeminiParts(lastMessage));
    const response = result.response;

    const latencyMs = Date.now() - start;
    const inputTokens = response.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;
    const costUsd = this.calcCost(spec, inputTokens, outputTokens);

    const candidate = response.candidates?.[0];
    const textParts = candidate?.content?.parts?.filter((p) => p.text) ?? [];
    const fnCalls = candidate?.content?.parts?.filter((p) => p.functionCall) ?? [];

    const toolCalls = fnCalls.map((p, i) => ({
      id: `gemini-tc-${i}`,
      name: p.functionCall!.name,
      input: p.functionCall!.args as Record<string, unknown>,
    }));

    const finishReason = candidate?.finishReason;
    const stopReason =
      fnCalls.length > 0 ? 'tool_use' :
      finishReason === 'MAX_TOKENS' ? 'max_tokens' : 'end_turn';

    return {
      content: textParts.map((p) => p.text).join('\n'),
      toolCalls: toolCalls.length ? toolCalls : undefined,
      stopReason,
      usage: { inputTokens, outputTokens },
      model: spec.modelId,
      provider: 'google',
      latencyMs,
      costUsd,
    };
  }

  private toGeminiParts(msg: LlmMessage): any[] {
    if (typeof msg.content === 'string') return [{ text: msg.content }];

    return (msg.content as LlmContentBlock[]).reduce<any[]>((acc, block) => {
      if (block.type === 'text') return [...acc, { text: block.text }];
      if (block.type === 'tool_use') return [...acc, { functionCall: { name: block.toolName, args: block.toolInput } }];
      if (block.type === 'tool_result') return [...acc, { functionResponse: { name: block.toolName ?? 'unknown', response: { result: block.toolResult } } }];
      return acc;
    }, []);
  }

  private toGeminiSchema(schema: Record<string, unknown>): any {
    const props = schema.properties as Record<string, any> | undefined;
    if (!props) return { type: SchemaType.OBJECT, properties: {} };

    const converted: Record<string, any> = {};
    for (const [key, val] of Object.entries(props)) {
      converted[key] = {
        type: this.mapType(val.type as string),
        description: val.description,
        ...(val.enum ? { enum: val.enum } : {}),
      };
    }

    return {
      type: SchemaType.OBJECT,
      properties: converted,
      required: (schema.required as string[]) ?? [],
    };
  }

  private mapType(type: string): SchemaType {
    const map: Record<string, SchemaType> = {
      string:  SchemaType.STRING,
      number:  SchemaType.NUMBER,
      integer: SchemaType.INTEGER,
      boolean: SchemaType.BOOLEAN,
      array:   SchemaType.ARRAY,
      object:  SchemaType.OBJECT,
    };
    return map[type] ?? SchemaType.STRING;
  }

  private calcCost(spec: ModelSpec, input: number, output: number): number {
    return (input / 1_000_000) * spec.inputCostPer1M +
           (output / 1_000_000) * spec.outputCostPer1M;
  }
}
