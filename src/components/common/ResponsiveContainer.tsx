// components/common/ResponsiveContainer.tsx
import React from 'react';
import { Box, Container, SxProps, Theme } from '@mui/material';

export interface ResponsiveContainerProps {
  children: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  sx?: SxProps<Theme>;
  disableGutters?: boolean;
  component?: React.ElementType;
}

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({ 
  children, 
  maxWidth = 'lg',
  sx,
  disableGutters = false,
  component = 'div'
}) => (
  <Container
    component={component}
    maxWidth={maxWidth}
    disableGutters={disableGutters}
    sx={{ 
      px: { xs: 2, sm: 3, md: 4 },
      py: { xs: 2, md: 3 },
      ...sx 
    }}
  >
    {children}
  </Container>
);