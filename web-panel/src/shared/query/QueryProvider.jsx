import React, { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createAppQueryClient } from './queryClient';

export function QueryProvider({ children }) {
  const [client] = useState(() => createAppQueryClient());
  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
}
