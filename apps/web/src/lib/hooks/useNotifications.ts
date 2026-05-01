'use client';
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import api from '../api';
import { supabase } from '../supabase';
import { useNotificationsStore } from '../stores/notifications.store';
import type { Notification } from '../stores/notifications.store';

let socket: Socket | null = null;

export function useNotifications(userId?: string) {
  const qc = useQueryClient();
  const { setNotifications, addNotification, setUnreadCount } = useNotificationsStore();

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await api.get<{ items: Notification[]; total: number }>('/notifications');
      setNotifications(data.items);
      return data;
    },
    enabled: !!userId,
  });

  useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: async () => {
      const { data } = await api.get<{ unread: number }>('/notifications/unread-count');
      setUnreadCount(data.unread);
      return data;
    },
    enabled: !!userId,
    refetchInterval: 60_000,
  });

  // Real-time via /notifications Socket.io namespace
  useEffect(() => {
    if (!userId) return;

    let mounted = true;

    const connect = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token || !mounted) return;

      const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3000';

      socket = io(`${wsUrl}/notifications`, {
        auth: { token },
        transports: ['websocket'],
        reconnectionAttempts: 5,
      });

      socket.on('notification', (n: Notification) => {
        addNotification(n);
        qc.invalidateQueries({ queryKey: ['notifications'] });
      });

      socket.on('unread_count', ({ unread }: { unread: number }) => {
        setUnreadCount(unread);
      });
    };

    connect();

    return () => {
      mounted = false;
      socket?.disconnect();
      socket = null;
    };
  }, [userId, addNotification, setUnreadCount, qc]);

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: (_, id) => {
      useNotificationsStore.getState().markRead(id);
      qc.invalidateQueries({ queryKey: ['notifications', 'unread'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      useNotificationsStore.getState().markAllRead();
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return { notificationsQuery, markRead, markAllRead };
}
