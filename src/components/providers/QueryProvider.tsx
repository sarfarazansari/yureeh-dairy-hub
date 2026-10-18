'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

const QUERY_STALE_TIME = 30_000;

/**
 * Provides the shared TanStack Query client to the client-side application.
 *
 * The client is created once per browser session and is not shared between
 * server requests.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: QUERY_STALE_TIME,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );

  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user.id ?? null;
      if (previousUserId.current !== undefined && previousUserId.current !== nextUserId) {
        // A browser QueryClient survives auth transitions; never retain one user's cached farm data for another.
        queryClient.clear();
      }
      previousUserId.current = nextUserId;
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
