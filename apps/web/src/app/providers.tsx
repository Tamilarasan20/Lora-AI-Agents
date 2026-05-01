'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/stores/auth.store';

const ONBOARDING_PATH = '/onboarding';
const AUTH_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

function AuthSync({ children }: { children: React.ReactNode }) {
  const { syncFromSupabase, reset } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) syncFromSupabase(session.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        syncFromSupabase(session.user).then(() => {
          const user = useAuthStore.getState().user;
          const isAuthPage = AUTH_PATHS.some((p) => pathname?.startsWith(p));
          if (user && user.onboardingComplete === false && !pathname?.startsWith(ONBOARDING_PATH) && !isAuthPage) {
            router.push(ONBOARDING_PATH);
          }
        });
      } else {
        reset();
      }
    });

    return () => subscription.unsubscribe();
  }, [syncFromSupabase, reset, router, pathname]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, retry: 1 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthSync>{children}</AuthSync>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
