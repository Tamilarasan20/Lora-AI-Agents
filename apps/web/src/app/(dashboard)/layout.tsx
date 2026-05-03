'use client';
import { Sidebar } from '@/components/layout/Sidebar';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();

  useNotifications(user?.id);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const next = pathname && pathname !== '/dashboard' ? `?next=${encodeURIComponent(pathname)}` : '';
      router.replace(`/login${next}`);
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f9fbff_0%,#eef4ff_100%)] text-slate-900">
      <Sidebar />
      <main className="flex min-h-screen flex-col pt-16 md:ml-[336px] md:pt-0">
        {children}
      </main>
    </div>
  );
}
