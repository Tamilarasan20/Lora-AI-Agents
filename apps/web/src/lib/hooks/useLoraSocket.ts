'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { supabase, isSupabaseConfigured } from '../supabase';

export const LORA_EVENTS = [
  'lora.chat.queued',
  'lora.strategy.started',
  'lora.strategy.created',
  'lora.task.created',
  'lora.task.assigned',
  'agent.task.started',
  'agent.task.completed',
  'agent.task.failed',
  'steve.image.started',
  'steve.image.generated',
  'steve.carousel.started',
  'steve.carousel.slide.generated',
  'lora.review.started',
  'lora.output.reviewed',
  'approval.created',
  'approval.pending',
  'approval.approved',
  'approval.rejected',
  'calendar.item.created',
  'lora.calendar.updated',
  'workflow.completed',
  'workflow.failed',
] as const;

export type LoraEventName = (typeof LORA_EVENTS)[number];

export interface LoraSocketEvent {
  eventName: LoraEventName;
  payload: Record<string, unknown>;
  timestamp: string;
}

export function useLoraSocket({
  userId,
  businessId,
  conversationId,
  enabled = true,
}: {
  userId?: string | null;
  businessId?: string | null;
  conversationId?: string | null;
  enabled?: boolean;
}) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<LoraSocketEvent[]>([]);

  const pushEvent = useCallback((eventName: LoraEventName, payload: unknown) => {
    setEvents((prev) => [
      ...prev.slice(-99),
      { eventName, payload: payload as Record<string, unknown>, timestamp: new Date().toISOString() },
    ]);
  }, []);

  useEffect(() => {
    if (!enabled || !userId || !businessId) return;

    let socket: Socket;

    const connect = async () => {
      let token: string | null = null;

      if (isSupabaseConfigured) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token ?? null;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

      socket = io(`${apiUrl}/lora`, {
        transports: ['websocket'],
        auth: { token },
        query: {
          userId,
          businessId,
          ...(conversationId ? { conversationId } : {}),
        },
      });

      socket.on('connect', () => setConnected(true));
      socket.on('disconnect', () => setConnected(false));
      socket.on('connect_error', (err) => console.warn('[LoraSocket] connect error', err.message));

      LORA_EVENTS.forEach((event) => {
        socket.on(event, (payload) => pushEvent(event, payload));
      });

      socketRef.current = socket;
    };

    connect();

    return () => {
      if (socketRef.current) {
        LORA_EVENTS.forEach((e) => socketRef.current?.off(e));
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setConnected(false);
    };
  }, [enabled, userId, businessId, conversationId, pushEvent]);

  const clearEvents = useCallback(() => setEvents([]), []);

  const latestEvent = events[events.length - 1] ?? null;

  return { socket: socketRef.current, connected, events, latestEvent, clearEvents };
}
