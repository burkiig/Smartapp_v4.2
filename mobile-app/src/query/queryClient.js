import { QueryClient } from '@tanstack/react-query';

export function createMobileQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 20_000,
        gcTime: 10 * 60_000,
        retry: 2,
        networkMode: 'online',
      },
      mutations: { retry: 1 },
    },
  });
}
