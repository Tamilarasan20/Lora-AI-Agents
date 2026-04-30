import { Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  MessageParam,
  Tool,
  ToolUseBlock,
  Message,
} from '@anthropic-ai/sdk/resources/messages';

export interface AgentRunOptions {
  maxTurns?: number;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentRunResult {
  output: string;
  tokensUsed: number;
  turns: number;
  toolCallCount: number;
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
  private readonly anthropic: Anthropic;

  constructor() {
    this.logger = new Logger(this.constructor.name);
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async run(
    userMessage: string,
    context: Record<string, unknown> = {},
    options: AgentRunOptions = {},
  ): Promise<AgentRunResult> {
    const { maxTurns = 10, temperature = 0.7, maxTokens = 4096 } = options;

    const messages: MessageParam[] = [
      { role: 'user', content: this.buildUserMessage(userMessage, context) },
    ];

    const anthropicTools: Tool[] = this.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: {
        type: 'object' as const,
        ...t.inputSchema,
      },
    }));

    let totalTokens = 0;
    let turns = 0;
    let toolCallCount = 0;
    let finalOutput = '';

    while (turns < maxTurns) {
      turns++;

      const response: Message = await this.anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-7',
        max_tokens: maxTokens,
        temperature,
        system: this.systemPrompt,
        tools: anthropicTools.length > 0 ? anthropicTools : undefined,
        messages,
      });

      totalTokens += response.usage.input_tokens + response.usage.output_tokens;

      if (response.stop_reason === 'end_turn') {
        finalOutput = response.content
          .filter((b) => b.type === 'text')
          .map((b) => (b as { type: 'text'; text: string }).text)
          .join('\n');
        break;
      }

      if (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter(
          (b): b is ToolUseBlock => b.type === 'tool_use',
        );

        messages.push({ role: 'assistant', content: response.content });

        const toolResults = await Promise.all(
          toolUseBlocks.map(async (block) => {
            toolCallCount++;
            const tool = this.tools.find((t) => t.name === block.name);
            if (!tool) {
              return {
                type: 'tool_result' as const,
                tool_use_id: block.id,
                content: `Tool ${block.name} not found`,
                is_error: true,
              };
            }
            try {
              const result = await tool.handler(block.input as Record<string, unknown>);
              return {
                type: 'tool_result' as const,
                tool_use_id: block.id,
                content: JSON.stringify(result),
              };
            } catch (err) {
              this.logger.error(`Tool ${block.name} failed`, err);
              return {
                type: 'tool_result' as const,
                tool_use_id: block.id,
                content: String(err),
                is_error: true,
              };
            }
          }),
        );

        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      // max_tokens or other stop reason
      finalOutput = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('\n');
      break;
    }

    this.logger.debug(
      `${this.agentName} run complete: turns=${turns} tokens=${totalTokens} tools=${toolCallCount}`,
    );

    return { output: finalOutput, tokensUsed: totalTokens, turns, toolCallCount };
  }

  private buildUserMessage(message: string, context: Record<string, unknown>): string {
    if (Object.keys(context).length === 0) return message;
    return `${message}\n\n<context>\n${JSON.stringify(context, null, 2)}\n</context>`;
  }
}
