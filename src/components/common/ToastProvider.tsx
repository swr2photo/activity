// src/components/common/ToastProvider.tsx
'use client';

import React, { useMemo } from 'react';
import { SnackbarProvider, useSnackbar, SnackbarKey, MaterialDesignContent } from 'notistack';
import { IconButton, Slide, useMediaQuery, useTheme, styled } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

// Custom Styled Component
const StyledMaterialDesignContent = styled(MaterialDesignContent)(({ theme }) => ({
  // Apply base styles directly to the root element instead of using the class selector
  borderRadius: (theme.shape.borderRadius as number) * 1.5,
  boxShadow: theme.shadows[4],
  fontWeight: 500,
  pointerEvents: 'all',
  
  '&.notistack-MuiContent-success': {
    backgroundColor: theme.palette.success.main,
  },
  '&.notistack-MuiContent-error': {
    backgroundColor: theme.palette.error.main,
  },
  '&.notistack-MuiContent-info': {
    backgroundColor: theme.palette.info.main,
  },
  '&.notistack-MuiContent-warning': {
    backgroundColor: theme.palette.warning.main,
  },
}));

function SlideDown(props: any) {
  return <Slide {...props} direction="down" />;
}
function SlideUp(props: any) {
  return <Slide {...props} direction="up" />;
}

const CloseAction: React.FC<{ id: SnackbarKey }> = ({ id }) => {
  const { closeSnackbar } = useSnackbar();
  return (
    <IconButton
      aria-label="close"
      size="small"
      onClick={() => closeSnackbar(id)}
      sx={{ color: 'inherit', opacity: 0.85, '&:hover': { opacity: 1 } }}
    >
      <CloseIcon fontSize="small" />
    </IconButton>
  );
};

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const isMobileQuery = useMediaQuery(theme.breakpoints.down('sm'));

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isMobile = mounted ? isMobileQuery : false;

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
      Components={{
        success: StyledMaterialDesignContent,
        error: StyledMaterialDesignContent,
        warning: StyledMaterialDesignContent,
        info: StyledMaterialDesignContent,
      }}
      style={{
        pointerEvents: 'none',
      }}
    >
      {children}
    </SnackbarProvider>
  );
}