'use client';
import { useState } from 'react';
import { Bell, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useNotificationsStore } from '@/lib/stores/notifications.store';
import { formatRelative } from '@/lib/utils';

export function Header({ title }: { title?: string }) {
  const { unreadCount, notifications, markRead } = useNotificationsStore();
  const [showPanel, setShowPanel] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 gap-4 sticky top-0 z-30">
      {title && <h1 className="text-lg font-semibold text-gray-900">{title}</h1>}

      <div className="flex-1 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          placeholder="Search content, posts…"
          className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => setShowPanel(!showPanel)}
            className="relative p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>

          {showPanel && (
            <div className="absolute right-0 top-12 w-80 bg-white rounded-xl border border-gray-200 shadow-xl z-50 animate-fade-in">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-sm">Notifications</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={() => useNotificationsStore.getState().markAllRead()}
                      className="text-xs text-brand-600 hover:text-brand-700"
                    >
                      Mark all read
                    </button>
                  )}
                  <button onClick={() => setShowPanel(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">No notifications</div>
                ) : (
                  notifications.slice(0, 10).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markRead(n.id)}
                      className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${!n.isRead ? 'bg-brand-50/50' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.isRead && <span className="mt-1.5 w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />}
                        <div className={!n.isRead ? '' : 'pl-4'}>
                          <p className="text-sm font-medium text-gray-900">{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                          <p className="text-xs text-gray-400 mt-1">{formatRelative(n.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="px-4 py-3 border-t border-gray-100">
                <Link
                  href="/notifications"
                  onClick={() => setShowPanel(false)}
                  className="block text-center text-sm text-brand-600 hover:text-brand-700 font-medium"
                >
                  View all
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
