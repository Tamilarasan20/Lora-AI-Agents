'use client';
import { Bell, CheckCheck, Trash2, Info, AlertCircle, CheckCircle, Zap } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useNotificationsStore } from '@/lib/stores/notifications.store';

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  INFO: { icon: <Info className="w-4 h-4" />, color: 'text-blue-500 bg-blue-50' },
  SUCCESS: { icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-500 bg-green-50' },
  WARNING: { icon: <AlertCircle className="w-4 h-4" />, color: 'text-amber-500 bg-amber-50' },
  ERROR: { icon: <AlertCircle className="w-4 h-4" />, color: 'text-red-500 bg-red-50' },
  AI_ACTION: { icon: <Zap className="w-4 h-4" />, color: 'text-brand-600 bg-brand-50' },
};

function useNotificationsList() {
  return useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => api.get('/notifications', { params: { limit: 50 } }).then((r) => r.data),
    staleTime: 30_000,
  });
}

function useMarkAllRead() {
  const qc = useQueryClient();
  const { markAllRead } = useNotificationsStore();
  return useMutation({
    mutationFn: () => api.post('/notifications/read-all').then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      markAllRead();
    },
  });
}

function useMarkOneRead() {
  const qc = useQueryClient();
  const { markRead } = useNotificationsStore();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`).then((r) => r.data),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      markRead(id);
    },
  });
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsPage() {
  const { data, isLoading } = useNotificationsList();
  const markAll = useMarkAllRead();
  const markOne = useMarkOneRead();

  const notifications = data?.items ?? [];
  const unread = notifications.filter((n: any) => !n.isRead).length;

  return (
    <>
      <Header title="Notifications" />
      <div className="flex-1 p-6 max-w-2xl">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-gray-500" />
            <span className="text-sm text-gray-600">
              {unread > 0 ? <><strong>{unread}</strong> unread</> : 'All caught up'}
            </span>
          </div>
          {unread > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAll.mutate()} loading={markAll.isPending}>
              <CheckCheck className="w-4 h-4" /> Mark all read
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <CheckCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="font-semibold text-gray-700">No notifications</p>
              <p className="text-sm text-gray-400 mt-1">You&apos;re all caught up</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map((n: any) => {
              const config = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.INFO;
              return (
                <Card
                  key={n.id}
                  className={!n.isRead ? 'border-brand-200 bg-brand-50/20' : ''}
                  onClick={() => !n.isRead && markOne.mutate(n.id)}
                >
                  <CardContent className="py-3.5">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${config.color}`}>
                        {config.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className={`text-sm font-medium ${!n.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                              {n.title}
                            </p>
                            {n.message && (
                              <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {!n.isRead && <div className="w-2 h-2 rounded-full bg-brand-500" />}
                            <span className="text-xs text-gray-400">{formatRelativeTime(n.createdAt)}</span>
                          </div>
                        </div>

                        {/* Action link */}
                        {n.actionUrl && (
                          <a
                            href={n.actionUrl}
                            className="text-xs text-brand-600 hover:underline mt-1 inline-block"
                          >
                            View →
                          </a>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
