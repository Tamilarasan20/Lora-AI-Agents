import { Test, TestingModule } from '@nestjs/testing';
import { ChatService, AgentType } from './chat.service';
import { ClaraAgent } from '../agents/clara/clara.agent';
import { SarahAgent } from '../agents/sarah/sarah.agent';
import { MarkAgent } from '../agents/mark/mark.agent';

// Mock Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        stream: jest.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {
            yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello ' } };
            yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'world!' } };
            yield { type: 'message_delta', usage: { output_tokens: 10 } };
          },
          finalMessage: jest.fn().mockResolvedValue({
            usage: { input_tokens: 20, output_tokens: 10 },
          }),
        }),
      },
    })),
  };
});

const mockAgent = { generateContent: jest.fn(), run: jest.fn() };

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: ClaraAgent, useValue: mockAgent },
        { provide: SarahAgent, useValue: mockAgent },
        { provide: MarkAgent, useValue: mockAgent },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('returns agent meta for all 4 agents', () => {
    const agents: AgentType[] = ['lora', 'clara', 'sarah', 'mark'];
    agents.forEach((a) => {
      const meta = service.getAgentMeta(a);
      expect(meta).toHaveProperty('name');
      expect(meta).toHaveProperty('emoji');
      expect(meta).toHaveProperty('color');
    });
  });

  it('starts with empty history for new session', () => {
    expect(service.getHistory('new-session')).toEqual([]);
  });

  it('clears session history', async () => {
    const session = 'session-1';
    // Drain the async generator to populate history
    const gen = service.streamMessage(session, 'Hello', 'lora');
    for await (const _ of gen) { /* consume */ }

    service.clearSession(session);
    expect(service.getHistory(session)).toEqual([]);
  });

  it('streams chunks and then done event', async () => {
    const events: any[] = [];
    for await (const event of service.streamMessage('s1', 'Hi there', 'lora')) {
      events.push(event);
    }

    const chunks = events.filter((e) => e.type === 'chunk');
    const done = events.find((e) => e.type === 'done');

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].text).toBeTruthy();
    expect(done).toBeDefined();
    expect(done.tokensUsed).toBeGreaterThan(0);
  });

  it('accumulates conversation history across turns', async () => {
    const session = 'session-history';

    for await (const _ of service.streamMessage(session, 'First message', 'lora')) {}
    const history = service.getHistory(session);

    // Should have user message + assistant message
    expect(history.length).toBe(2);
    expect(history[0].role).toBe('user');
    expect(history[1].role).toBe('assistant');
  });

  it('works with all agent types', async () => {
    const agents: AgentType[] = ['lora', 'clara', 'sarah', 'mark'];

    for (const agent of agents) {
      const events: any[] = [];
      for await (const event of service.streamMessage(`session-${agent}`, 'Test', agent)) {
        events.push(event);
      }
      expect(events.some((e) => e.type === 'done')).toBe(true);
    }
  });
});
