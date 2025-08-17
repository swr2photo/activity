// src/components/common/ToastProvider.tsx
'use client';
import React from 'react';
import { SnackbarProvider } from 'notistack';

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <SnackbarProvider
      maxSnack={4}
      autoHideDuration={4000}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      {children}
    </SnackbarProvider>
  );
}
