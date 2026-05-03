'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Bell,
  Brain,
  Calendar,
  ChevronDown,
  Home,
  Inbox,
  LogOut,
  Menu,
  MessageCircleMore,
  PanelLeft,
  Sparkles,
  WalletCards,
  X,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useNotificationsStore } from '@/lib/stores/notifications.store';

const primaryNav = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/engagement', icon: Inbox, label: 'Inbox', badge: true },
  { href: '/chat', icon: MessageCircleMore, label: 'Chat' },
  { href: '/calendar', icon: Calendar, label: 'Calendar' },
  { href: '/content', icon: WalletCards, label: 'Ads' },
];

const manageNav = [
  { href: '/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/brand/knowledge', icon: Brain, label: 'Lora Knowledge Base' },
  { href: '/connections', icon: Zap, label: 'Integration' },
];

function NavList({
  items,
  unreadCount,
  onNavClick,
}: {
  items: { href: string; icon: React.ComponentType<{ className?: string }>; label: string; badge?: boolean }[];
  unreadCount: number;
  onNavClick?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-1.5">
      {items.map(({ href, icon: Icon, label, badge }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavClick}
            className={cn(
              'flex items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-semibold transition-all',
              active
                ? 'bg-[#2f80ed] text-white shadow-[0_16px_32px_rgba(47,128,237,0.24)]'
                : 'text-slate-700 hover:bg-slate-100',
            )}
          >
            <Icon className={cn('h-5 w-5', active ? 'text-white' : 'text-slate-700')} />
            <span className="truncate">{label}</span>
            {badge && unreadCount > 0 && (
              <span className={cn(
                'ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold',
                active ? 'bg-white/20 text-white' : 'bg-red-500 text-white',
              )}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { unreadCount } = useNotificationsStore();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="flex h-full flex-col bg-white px-6 py-7 text-slate-900">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#19b15a] text-white shadow-[0_12px_24px_rgba(25,177,90,0.28)]">
          <Zap className="h-5 w-5" />
        </div>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500"
          aria-label="Toggle panel"
        >
          <PanelLeft className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-[18px] px-2.5 py-2 text-left"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#16a34a] text-xl font-bold text-white">
            W
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-slate-800">Work Space 1</p>
          </div>
          <ChevronDown className="h-5 w-5 text-slate-400" />
        </button>
      </div>

      <div className="mt-8">
        <NavList items={primaryNav} unreadCount={unreadCount} onNavClick={onNavClick} />
      </div>

      <div className="mt-8">
        <p className="px-2 text-sm font-medium text-slate-400">Manage</p>
        <div className="mt-3">
          <NavList items={manageNav} unreadCount={unreadCount} onNavClick={onNavClick} />
        </div>
      </div>

      <div className="mt-auto space-y-4 pt-8">
        <div className="rounded-3xl bg-[#f8fafc] p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-semibold text-slate-800">Earn AI Credits</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">100 credits per paid referral</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-[#e8f0ff] px-5 py-4 text-[#2f80ed] shadow-[0_16px_40px_rgba(47,128,237,0.1)]">
          <div className="flex items-center gap-2 text-[15px] font-semibold">
            <Sparkles className="h-4 w-4" />
            <span>250 AI Credits</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#16a34a] text-lg font-semibold text-white">
            {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'T'}
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-[15px] font-semibold text-slate-700 shadow-sm"
          >
            Upgrade
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="ml-auto flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50"
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" />
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
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:z-40 md:flex md:w-[336px] md:border-r md:border-slate-200/80">
        <SidebarContent />
      </aside>

      <div className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-600"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#19b15a] text-white">
            <Zap className="h-4 w-4" />
          </div>
          <span className="text-base font-semibold text-slate-900">Loraloop</span>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500">
          <Bell className="h-4 w-4" />
        </div>
      </div>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/25 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu overlay"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[88vw] max-w-[336px] border-r border-slate-200 bg-white transition-transform duration-300 md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
        <SidebarContent onNavClick={() => setMobileOpen(false)} />
      </aside>
    </>
  );
}
