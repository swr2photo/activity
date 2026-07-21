"use client";

import React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

type Props = { children: React.ReactNode };

const STORAGE_KEY = "psu-theme";

export default function AppThemeProvider({ children }: Props) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey={STORAGE_KEY}
    >
      {children}
    </NextThemesProvider>
  );
}
