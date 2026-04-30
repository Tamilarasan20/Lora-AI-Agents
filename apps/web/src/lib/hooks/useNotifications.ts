'use client';
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import api from '../api';
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
      const { data } = await api.get<{ unread: number }>('/engagement/unread-count');
      setUnreadCount(data.unread);
      return data;
    },
    enabled: !!userId,
    refetchInterval: 30_000,
  });

  // Real-time socket connection
  useEffect(() => {
    if (!userId) return;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3000';
    const token = localStorage.getItem('access_token');

    socket = io(wsUrl, { auth: { token }, transports: ['websocket'] });

    socket.on('notification', (n: Notification) => {
      addNotification(n);
      qc.invalidateQueries({ queryKey: ['notifications'] });
    });

    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, [userId, addNotification, qc]);

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: (_, id) => {
      useNotificationsStore.getState().markRead(id);
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
