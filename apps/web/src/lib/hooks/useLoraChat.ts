'use client';

import { useState, useCallback } from 'react';
import { api } from '../api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'lora' | 'agent' | 'system';
  agentName?: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export function useLoraChat({ businessId, userId }: { businessId: string; userId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addMessage = useCallback((msg: Omit<ChatMessage, 'id'>) => {
    setMessages((prev) => [
      ...prev,
      { ...msg, id: `${Date.now()}-${Math.random()}` },
    ]);
  }, []);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || isWorking) return;

      setError(null);
      setIsWorking(true);

      addMessage({ role: 'user', content: message, createdAt: new Date().toISOString() });

      try {
        const res = await api.post('/lora/chat', {
          businessId,
          message,
          conversationId: conversationId ?? undefined,
        });

        const data = res.data as { conversationId: string; jobId: string; message: string };
        setConversationId(data.conversationId);

        addMessage({
          role: 'lora',
          agentName: 'Lora',
          content: data.message,
          metadata: { jobId: data.jobId, status: 'queued' },
          createdAt: new Date().toISOString(),
        });

        return data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to reach Lora. Please try again.';
        setError(msg);
        addMessage({
          role: 'system',
          content: `Something went wrong: ${msg}`,
          createdAt: new Date().toISOString(),
        });
      } finally {
        setIsWorking(false);
      }
    },
    [businessId, conversationId, isWorking, addMessage],
  );

  const addAgentEvent = useCallback(
    (agentName: string, content: string, metadata?: Record<string, unknown>) => {
      addMessage({ role: 'agent', agentName, content, metadata, createdAt: new Date().toISOString() });
    },
    [addMessage],
  );

  const loadConversation = useCallback(async (id: string) => {
    const res = await api.get(`/lora/conversations/${id}`);
    const conv = res.data as { messages: ChatMessage[] };
    setConversationId(id);
    setMessages(conv.messages ?? []);
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setIsWorking(false);
    setError(null);
  }, []);

  return {
    messages,
    conversationId,
    isWorking,
    error,
    sendMessage,
    addAgentEvent,
    loadConversation,
    reset,
  };
}
