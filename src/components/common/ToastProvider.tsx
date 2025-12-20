// src/components/common/ToastProvider.tsx
'use client';

import React, { useMemo } from 'react';
import { SnackbarProvider, useSnackbar } from 'notistack';
import type { SnackbarKey } from 'notistack';
import { IconButton, Slide, useMediaQuery, useTheme, Box } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

/**
 * Slide direction:
 * - Mobile: bottom -> up (เหมาะกับ gesture bar)
 * - Desktop: top -> down
 */
function SlideDown(props: any) {
  return <Slide {...props} direction="down" />;
}
function SlideUp(props: any) {
  return <Slide {...props} direction="up" />;
}

/** Close action (safe typing) */
const CloseAction: React.FC<{ id: SnackbarKey }> = ({ id }) => {
  const { closeSnackbar } = useSnackbar();
  return (
    <IconButton
      aria-label="close"
      size="small"
      onClick={() => closeSnackbar(id)}
      sx={{
        color: 'inherit',
        opacity: 0.9,
        '&:hover': { opacity: 1 },
      }}
    >
      <CloseIcon fontSize="small" />
    </IconButton>
  );
};

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const anchorOrigin = useMemo(
    () =>
      isMobile
        ? ({ vertical: 'bottom', horizontal: 'center' } as const)
        : ({ vertical: 'top', horizontal: 'right' } as const),
    [isMobile]
  );

  return (
    <SnackbarProvider
      maxSnack={isMobile ? 3 : 5}
      dense={isMobile}
      preventDuplicate
      autoHideDuration={isMobile ? 3500 : 4500}
      anchorOrigin={anchorOrigin}
      TransitionComponent={isMobile ? SlideUp : SlideDown}
      action={(key) => <CloseAction id={key} />}
      // Liquid-glass styling (MUI Snackbar/Notistack renders as inline styles)
      // NOTE: Notistack container uses this `style`; for per-snackbar styling, set variants elsewhere.
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 10px)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 10px)',
        paddingLeft: '12px',
        paddingRight: '12px',
        // Helps avoid overlap with top nav on desktop / with bottom bar on mobile
        pointerEvents: 'none', // container ignores pointer; actual snackbar still clickable
      }}
      // Notistack exposes className for the container; we can attach a wrapper to restore pointerEvents for snackbars.
      // Some versions ignore container pointer events. We add a wrapper as a safe fallback.
      classes={{
        containerRoot: 'toast-container-root',
      }}
    >
      {/* restore pointer events for children snackbars via CSS scope */}
      <Box
        sx={{
          '& .toast-container-root': { pointerEvents: 'none' },
          '& .toast-container-root .SnackbarItem-variantSuccess, & .toast-container-root .SnackbarItem-variantError, & .toast-container-root .SnackbarItem-variantWarning, & .toast-container-root .SnackbarItem-variantInfo, & .toast-container-root .SnackbarItem-variantDefault': {
            pointerEvents: 'auto',
          },
        }}
      >
        {children}
      </Box>
    </SnackbarProvider>
  );
}
