// src/components/common/ToastProvider.tsx
'use client';

import React from 'react';
import { SnackbarProvider, useSnackbar } from 'notistack';
import type { SnackbarKey } from 'notistack';
import { IconButton, Slide, useMediaQuery, useTheme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

function SlideDown(props: any) {
  return <Slide {...props} direction="down" />;
}
function SlideUp(props: any) {
  return <Slide {...props} direction="up" />;
}

/** ปุ่มปิดที่ดึง closeSnackbar จาก context ของ notistack (ไม่มีปัญหา type) */
const CloseAction: React.FC<{ id: SnackbarKey }> = ({ id }) => {
  const { closeSnackbar } = useSnackbar();
  return (
    <IconButton
      aria-label="close"
      size="small"
      onClick={() => closeSnackbar(id)}
      sx={{ color: 'inherit' }}
    >
      <CloseIcon fontSize="small" />
    </IconButton>
  );
};

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <SnackbarProvider
      maxSnack={isMobile ? 3 : 5}
      dense={isMobile}
      preventDuplicate
      autoHideDuration={isMobile ? 3500 : 4500}
      anchorOrigin={
        isMobile
          ? { vertical: 'bottom', horizontal: 'center' }
          : { vertical: 'top', horizontal: 'right' }
      }
      TransitionComponent={isMobile ? SlideUp : SlideDown}
      action={(key) => <CloseAction id={key} />}
      // กัน toast ไปชนขอบจอที่มี notch / gesture bar
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {children}
    </SnackbarProvider>
  );
}
