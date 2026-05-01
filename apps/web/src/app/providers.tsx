'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/stores/auth.store';

function AuthSync({ children }: { children: React.ReactNode }) {
  const { syncFromSupabase, reset } = useAuthStore();

  useEffect(() => {
    // Restore session on page load
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) syncFromSupabase(session.user);
    });

    // Keep store in sync as auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        syncFromSupabase(session.user);
      } else {
        reset();
      }
    });

    return () => subscription.unsubscribe();
  }, [syncFromSupabase, reset]);

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
