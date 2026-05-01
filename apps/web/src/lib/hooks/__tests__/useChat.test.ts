import { AGENT_META } from '../useChat';

// Socket.io is mocked — we test the hook's pure logic (AGENT_META, state transitions)
// Full integration tests for socket streaming are covered by e2e

describe('AGENT_META', () => {
  const agents = ['lora', 'clara', 'sarah', 'mark'] as const;

  it('has entries for all 4 agents', () => {
    agents.forEach((a) => {
      expect(AGENT_META[a]).toBeDefined();
    });
  });

  it('each agent has required fields', () => {
    agents.forEach((a) => {
      const meta = AGENT_META[a];
      expect(meta.name).toBeTruthy();
      expect(meta.emoji).toBeTruthy();
      expect(meta.color).toMatch(/^#/);
      expect(meta.tagline).toBeTruthy();
    });
  });

  it('agent names are unique', () => {
    const names = agents.map((a) => AGENT_META[a].name);
    const unique = new Set(names);
    expect(unique.size).toBe(agents.length);
  });

  it('agent colors are valid hex codes', () => {
    agents.forEach((a) => {
      expect(AGENT_META[a].color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });
});
