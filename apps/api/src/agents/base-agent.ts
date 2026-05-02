import { Logger } from '@nestjs/common';
import { LlmRouterService } from '../llm-router/llm-router.service';
import {
  LlmMessage,
  LlmTool,
  LlmToolCall,
  RoutingConfig,
} from '../llm-router/llm-router.types';

export interface AgentRunOptions {
  maxTurns?: number;
  temperature?: number;
  maxTokens?: number;
  /** Task type key used for routing (e.g. 'clara-generate-content') */
  taskType?: string;
  /** Override routing strategy for this run */
  routing?: RoutingConfig;
}

export interface AgentRunResult {
  output: string;
  tokensUsed: number;
  turns: number;
  toolCallCount: number;
  modelUsed?: string;
  providerUsed?: string;
  costUsd?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: Record<string, unknown>) => Promise<unknown>;
}

export abstract class BaseAgent {
  protected abstract readonly agentName: string;
  protected abstract readonly systemPrompt: string;
  protected abstract readonly tools: ToolDefinition[];
  protected readonly logger: Logger;
  protected router?: LlmRouterService;

  constructor() {
    this.logger = new Logger(this.constructor.name);
  }

  async run(
    userMessage: string,
    context: Record<string, unknown> = {},
    options: AgentRunOptions = {},
  ): Promise<AgentRunResult> {
    const { maxTurns = 10, temperature = 0.7, maxTokens = 4096, taskType, routing } = options;

    if (!this.router) {
      throw new Error(
        `${this.agentName}: LlmRouterService not injected. ` +
        'Assign this.router inside the subclass constructor.',
      );
    }

    const tools: LlmTool[] = this.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));

    const messages: LlmMessage[] = [
      { role: 'user', content: this.buildUserMessage(userMessage, context) },
    ];

    let totalTokens = 0;
    let totalCost = 0;
    let turns = 0;
    let toolCallCount = 0;
    let finalOutput = '';
    let lastModel: string | undefined;
    let lastProvider: string | undefined;

    while (turns < maxTurns) {
      turns++;

      const response = await this.router.route({
        systemPrompt: this.systemPrompt,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        maxTokens,
        temperature,
        taskType,
        routing,
      });

      lastModel = response.model;
      lastProvider = response.provider;
      totalTokens += response.usage.inputTokens + response.usage.outputTokens;
      totalCost += response.costUsd;

      if (response.stopReason === 'end_turn' || response.stopReason === 'max_tokens') {
        finalOutput = response.content;
        break;
      }

      if (response.stopReason === 'tool_use' && response.toolCalls?.length) {
        messages.push({
          role: 'assistant',
          content: this.buildAssistantContent(response.content, response.toolCalls),
        });

        const toolResults = await Promise.all(
          response.toolCalls.map(async (tc: LlmToolCall) => {
            toolCallCount++;
            const tool = this.tools.find((t) => t.name === tc.name);
            if (!tool) {
              return { toolUseId: tc.id, toolName: tc.name, result: `Tool ${tc.name} not found`, isError: true };
            }
            try {
              const result = await tool.handler(tc.input);
              return { toolUseId: tc.id, toolName: tc.name, result, isError: false };
            } catch (err) {
              this.logger.error(`Tool ${tc.name} failed`, err);
              return { toolUseId: tc.id, toolName: tc.name, result: String(err), isError: true };
            }
          }),
        );

        messages.push({
          role: 'user',
          content: toolResults.map((r) => ({
            type: 'tool_result' as const,
            toolUseId: r.toolUseId,
            toolName: r.toolName,
            toolResult: r.result,
            isError: r.isError,
          })),
        });

        continue;
      }

      finalOutput = response.content;
      break;
    }

    this.logger.debug(
      `${this.agentName}: turns=${turns} tokens=${totalTokens} tools=${toolCallCount} ` +
      `model=${lastModel} provider=${lastProvider} cost=$${totalCost.toFixed(6)}`,
    );

    return { output: finalOutput, tokensUsed: totalTokens, turns, toolCallCount, modelUsed: lastModel, providerUsed: lastProvider, costUsd: totalCost };
  }

  private buildUserMessage(message: string, context: Record<string, unknown>): string {
    if (Object.keys(context).length === 0) return message;
    return `${message}\n\n<context>\n${JSON.stringify(context, null, 2)}\n</context>`;
  }

  private buildAssistantContent(text: string, toolCalls: LlmToolCall[]): LlmMessage['content'] {
    const blocks: any[] = [];
    if (text) blocks.push({ type: 'text', text });
    for (const tc of toolCalls) {
      blocks.push({ type: 'tool_use', toolUseId: tc.id, toolName: tc.name, toolInput: tc.input });
    }
    return blocks;
  }
}
