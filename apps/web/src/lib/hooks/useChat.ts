'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
const nanoid = () => Math.random().toString(36).slice(2, 11);

export type AgentType = 'lora' | 'clara' | 'sarah' | 'mark';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agent: AgentType;
  timestamp: Date;
  isStreaming?: boolean;
}

export const AGENT_META: Record<AgentType, { name: string; emoji: string; color: string; tagline: string }> = {
  lora:  { name: 'Lora',  emoji: '✨', color: '#4f5eff', tagline: 'Your AI command centre' },
  clara: { name: 'Clara', emoji: '🎨', color: '#8b5cf6', tagline: 'Content creation expert' },
  sarah: { name: 'Sarah', emoji: '💬', color: '#06b6d4', tagline: 'Engagement & community' },
  mark:  { name: 'Mark',  emoji: '📊', color: '#10b981', tagline: 'Analytics & strategy' },
};

const WELCOME_MESSAGES: Record<AgentType, string> = {
  lora:  "Hi! I'm Lora, your AI command centre for Loraloop. I can help you navigate the platform, answer questions, or connect you with Clara (content), Sarah (engagement), or Mark (analytics). What can I help you with today?",
  clara: "Hey! I'm Clara, your content creation specialist. I can help you write captions, adapt content for different platforms, refine your brand voice, or brainstorm campaign ideas. What are we creating today?",
  sarah: "Hello! I'm Sarah, your engagement and community manager. I help craft replies to comments and DMs, build community connections, and handle tricky situations. What engagement challenge can I help with?",
  mark:  "Hi there! I'm Mark, your analytics and strategy AI. I can interpret your performance data, identify trends, benchmark against competitors, and recommend optimal posting strategies. What would you like to analyse?",
};

export function useChat(sessionId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeAgent, setActiveAgent] = useState<AgentType>('lora');
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const streamingIdRef = useRef<string | null>(null);

  // Initialise welcome message when agent changes
  const initAgent = useCallback((agent: AgentType) => {
    setActiveAgent(agent);
    setMessages([{
      id: nanoid(),
      role: 'assistant',
      content: WELCOME_MESSAGES[agent],
      agent,
      timestamp: new Date(),
    }]);
  }, []);

  useEffect(() => {
    initAgent('lora');
  }, []);

  // Socket.io connection
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3000';
    const token = localStorage.getItem('access_token');

    const socket = io(`${wsUrl}/chat`, {
      auth: { token },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('chat:chunk', ({ sessionId: sid, text }: { sessionId: string; text: string }) => {
      if (sid !== sessionId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingIdRef.current
            ? { ...m, content: m.content + text }
            : m,
        ),
      );
    });

    socket.on('chat:done', ({ sessionId: sid }: { sessionId: string }) => {
      if (sid !== sessionId) return;
      setIsStreaming(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingIdRef.current ? { ...m, isStreaming: false } : m,
        ),
      );
      streamingIdRef.current = null;
    });

    socket.on('chat:error', ({ sessionId: sid, message }: { sessionId: string; message: string }) => {
      if (sid !== sessionId) return;
      setIsStreaming(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingIdRef.current
            ? { ...m, content: `Error: ${message}`, isStreaming: false }
            : m,
        ),
      );
      streamingIdRef.current = null;
    });

    socket.on('chat:cleared', ({ sessionId: sid }: { sessionId: string }) => {
      if (sid !== sessionId) return;
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim() || isStreaming || !socketRef.current) return;

      const userMsg: ChatMessage = {
        id: nanoid(),
        role: 'user',
        content,
        agent: activeAgent,
        timestamp: new Date(),
      };

      const assistantId = nanoid();
      streamingIdRef.current = assistantId;

      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        agent: activeAgent,
        timestamp: new Date(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      socketRef.current.emit('chat:message', {
        sessionId,
        message: content,
        agent: activeAgent,
      });
    },
    [activeAgent, isStreaming, sessionId],
  );

  const clearChat = useCallback(() => {
    socketRef.current?.emit('chat:clear', { sessionId });
    initAgent(activeAgent);
  }, [activeAgent, initAgent, sessionId]);

  const switchAgent = useCallback(
    (agent: AgentType) => {
      socketRef.current?.emit('chat:clear', { sessionId });
      initAgent(agent);
    },
    [initAgent, sessionId],
  );

  return { messages, activeAgent, isConnected, isStreaming, sendMessage, clearChat, switchAgent };
}
