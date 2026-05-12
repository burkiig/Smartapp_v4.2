import React, { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMobileQueryClient } from './queryClient';

export function QueryProvider({ children }) {
  const [client] = useState(() => createMobileQueryClient());
  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
}
