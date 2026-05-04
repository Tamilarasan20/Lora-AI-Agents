'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, MessageSquare, Calendar, BarChart2, Zap, Search, Brain,
  ChevronDown, Settings, LogOut, Bell, Menu, X, Sparkles,
  FileText, Image, Link2, Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useNotificationsStore } from '@/lib/stores/notifications.store';

const MAIN_NAV = [
  { href: '/dashboard',  icon: Home,          label: 'Home' },
  { href: '/engagement', icon: Inbox,         label: 'Inbox', badge: true },
  { href: '/chat',       icon: MessageSquare, label: 'Chat' },
  { href: '/calendar',   icon: Calendar,      label: 'Calendar' },
  { href: '/analytics',  icon: BarChart2,     label: 'Analytics' },
];

const MANAGE_NAV = [
  { href: '/content',       icon: FileText, label: 'Content' },
  { href: '/media',         icon: Image,    label: 'Media' },
  { href: '/connections',   icon: Link2,    label: 'Connections' },
  { href: '/brand',         icon: Sparkles, label: 'Brand' },
  { href: '/lora/knowledge', icon: Search,  label: 'Lora Knowledge Base', highlight: true },
  { href: '/lora',          icon: Brain,    label: 'Lora AI' },
  { href: '/connections',   icon: Zap,      label: 'Integration' },
];

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { unreadCount } = useNotificationsStore();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const initials = (user?.name?.[0] ?? user?.email?.[0] ?? 'U').toUpperCase();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <div className="flex flex-col h-full bg-[#FAFBFC]">
      {/* Logo */}
      <div className="flex items-center px-6 py-6">
        <div className="w-8 h-8 bg-[#3B82F6] rounded-[8px] flex items-center justify-center shadow-sm shadow-blue-500/30">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M6 3H10V15H20V19H6V3Z" fill="white" />
          </svg>
        </div>
        <span className="ml-2.5 font-bold text-[16px] text-[#111111] tracking-tight">Loraloop</span>
        <span className="ml-1.5 text-[10px] bg-[#3B82F6]/10 text-[#3B82F6] px-1.5 py-0.5 rounded-full font-semibold">AI</span>
      </div>

      {/* Workspace Switcher */}
      <div className="px-4 mb-6">
        <button className="w-full flex items-center justify-between border border-[#E5E7EB] bg-white rounded-xl px-3 py-2 hover:bg-gray-50 transition-colors shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 bg-[#10B981] rounded-md flex items-center justify-center text-white font-bold text-[11px]">
              {initials}
            </div>
            <span className="text-[13px] font-medium text-[#111111] truncate max-w-[130px]">
              {user?.name ?? user?.email ?? 'My Workspace'}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 text-[#A1A1AA] shrink-0" />
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 flex flex-col px-3 overflow-y-auto gap-0.5">
        {MAIN_NAV.map(({ href, icon: Icon, label, badge }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavClick}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors text-[13.5px] font-semibold',
                active
                  ? 'bg-[#3B82F6] text-white shadow-md shadow-blue-500/20'
                  : 'text-[#3F3F46] hover:text-[#111111] hover:bg-[#F4F4F5]',
              )}
            >
              <Icon className="w-[17px] h-[17px] shrink-0" strokeWidth={2} />
              <span>{label}</span>
              {badge && unreadCount > 0 && (
                <span className="ml-auto text-[11px] bg-red-500 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 font-bold">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          );
        })}

        {/* Manage section */}
        <div className="mt-5 mb-1.5 text-[11px] font-bold text-[#A1A1AA] uppercase tracking-wider px-4">
          Manage
        </div>

        {MANAGE_NAV.map(({ href, icon: Icon, label, highlight }) => {
          const active = isActive(href);
          return (
            <Link
              key={href + label}
              href={href}
              onClick={onNavClick}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors text-[13.5px] font-semibold',
                active && highlight
                  ? 'bg-[#E0EEBA] text-[#111111]'
                  : active
                    ? 'bg-[#3B82F6] text-white shadow-md shadow-blue-500/20'
                    : 'text-[#3F3F46] hover:text-[#111111] hover:bg-[#F4F4F5]',
              )}
            >
              <Icon className="w-[17px] h-[17px] shrink-0" strokeWidth={2} />
              <span>{label}</span>
            </Link>
          );
        })}

        {/* Notifications + Settings */}
        <div className="mt-5 mb-1.5 text-[11px] font-bold text-[#A1A1AA] uppercase tracking-wider px-4">
          Account
        </div>
        <Link
          href="/notifications"
          onClick={onNavClick}
          className={cn(
            'flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors text-[13.5px] font-semibold',
            isActive('/notifications')
              ? 'bg-[#3B82F6] text-white'
              : 'text-[#3F3F46] hover:text-[#111111] hover:bg-[#F4F4F5]',
          )}
        >
          <Bell className="w-[17px] h-[17px] shrink-0" strokeWidth={2} />
          <span>Notifications</span>
        </Link>
        <Link
          href="/settings"
          onClick={onNavClick}
          className={cn(
            'flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors text-[13.5px] font-semibold',
            isActive('/settings')
              ? 'bg-[#3B82F6] text-white'
              : 'text-[#3F3F46] hover:text-[#111111] hover:bg-[#F4F4F5]',
          )}
        >
          <Settings className="w-[17px] h-[17px] shrink-0" strokeWidth={2} />
          <span>Settings</span>
        </Link>
      </nav>

      {/* User Profile Footer */}
      <div className="border-t border-[#E5E7EB] px-4 py-4 mt-auto">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#10B981] text-white flex items-center justify-center font-bold text-[13px] shadow-sm shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-[#111111] truncate">{user?.name ?? user?.email}</p>
            <p className="text-[11px] text-[#A1A1AA] capitalize">{user?.plan ?? 'free'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#EF4444] hover:bg-red-50 transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col z-40 border-r border-[#E5E7EB] shadow-sm">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 h-14 bg-white text-[#111111] flex items-center px-4 z-40 border-b border-[#E5E7EB]">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-lg hover:bg-[#F4F4F5] transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 mx-auto">
          <div className="w-7 h-7 rounded-lg bg-[#3B82F6] flex items-center justify-center">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M6 3H10V15H20V19H6V3Z" fill="white" />
            </svg>
          </div>
          <span className="font-bold text-base tracking-tight">Loraloop</span>
        </div>
        <div className="w-8" />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          'md:hidden fixed inset-y-0 left-0 w-72 z-50 transition-transform duration-300 border-r border-[#E5E7EB]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-[#F4F4F5] transition-colors text-[#71717A] z-10"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
        <SidebarContent onNavClick={() => setMobileOpen(false)} />
      </aside>
    </>
  );
}
