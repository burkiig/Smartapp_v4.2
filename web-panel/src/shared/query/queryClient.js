import { QueryClient } from '@tanstack/react-query';

/**
 * Shared TanStack Query client: cache + automatic retries on flaky networks.
 */
export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 2,
        refetchOnWindowFocus: true,
        networkMode: 'online',
      },
      mutations: {
        retry: 1,
      },
    },
  });
}
