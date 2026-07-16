'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from 'next-themes';
import { ThemeProvider as MuiThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { thTH } from '@mui/material/locale';

type Props = { children: React.ReactNode };

function MuiThemeBridge({ children }: Props) {
  const { resolvedTheme } = useNextTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const mode = mounted && resolvedTheme === 'dark' ? 'dark' : 'light';

  const theme = useMemo(
    () =>
      createTheme(
        {
          palette: {
            mode,
            primary: { main: mode === 'dark' ? '#818cf8' : '#4f46e5' },
            secondary: { main: mode === 'dark' ? '#94a3b8' : '#64748b' },
            background: {
              default: mode === 'dark' ? '#0b0f1a' : '#f5f5f7',
              paper: mode === 'dark' ? '#121826' : '#ffffff',
            },
            text: {
              primary: mode === 'dark' ? '#f1f5f9' : '#1d1d1f',
              secondary: mode === 'dark' ? '#94a3b8' : '#86868b',
            },
            divider: mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
            error: { main: mode === 'dark' ? '#f87171' : '#ff3b30' },
            warning: { main: mode === 'dark' ? '#fbbf24' : '#ff9500' },
            success: { main: mode === 'dark' ? '#4ade80' : '#34c759' },
            info: { main: mode === 'dark' ? '#60a5fa' : '#007aff' },
          },
          shape: { borderRadius: 12 },
          typography: {
            fontFamily: 'var(--font-sans, Inter, ui-sans-serif, system-ui, sans-serif)',
          },
          components: {
            MuiCssBaseline: {
              styleOverrides: {
                body: {
                  backgroundColor: 'transparent',
                },
              },
            },
            MuiPaper: {
              styleOverrides: {
                root: {
                  backgroundImage: 'none',
                },
              },
            },
            MuiButton: {
              styleOverrides: {
                root: {
                  textTransform: 'none',
                  fontWeight: 600,
                },
              },
            },
          },
        },
        thTH
      ),
    [mode]
  );

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      {children}
    </MuiThemeProvider>
  );
}

export default function AppThemeProvider({ children }: Props) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="psu-theme"
    >
      <MuiThemeBridge>{children}</MuiThemeBridge>
    </NextThemesProvider>
  );
}
