'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, Calendar, Inbox, BarChart2,
  Image, Link2, Palette, Bell, Settings, LogOut, Zap, MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useNotificationsStore } from '@/lib/stores/notifications.store';
import { useRouter } from 'next/navigation';

const NAV = [
  { href: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/chat',          icon: MessageSquare,   label: 'Chat with AI' },
  { href: '/content',       icon: FileText,         label: 'Content' },
  { href: '/calendar',      icon: Calendar,         label: 'Calendar' },
  { href: '/engagement',    icon: Inbox,            label: 'Engagement', badge: true },
  { href: '/analytics',     icon: BarChart2,        label: 'Analytics' },
  { href: '/media',         icon: Image,            label: 'Media' },
  { href: '/connections',   icon: Link2,            label: 'Connections' },
  { href: '/brand',         icon: Palette,          label: 'Brand' },
  { href: '/notifications', icon: Bell,             label: 'Notifications' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { unreadCount } = useNotificationsStore();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-gray-950 text-white flex flex-col z-40">
      {/* Logo */}
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-lg tracking-tight">Loraloop</span>
        <span className="ml-auto text-xs bg-brand-600/30 text-brand-300 px-2 py-0.5 rounded-full font-medium">AI</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label, badge }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/8',
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
              {badge && unreadCount > 0 && (
                <span className="ml-auto text-xs bg-red-500 text-white rounded-full min-w-5 h-5 flex items-center justify-center px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-white/10 p-3 space-y-0.5">
        <Link href="/settings"
          className={cn('flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/8 transition-colors',
            pathname === '/settings' && 'bg-brand-600 text-white')}>
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/8 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
        <div className="flex items-center gap-3 px-3 py-2 mt-1">
          <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user?.name ?? user?.email}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.plan ?? 'free'}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
