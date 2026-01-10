// src/components/common/ResponsiveGrid.tsx
'use client';

import React from 'react';
import Grid, { GridProps } from '@mui/material/Grid';

// --- Container ---
export interface ResponsiveGridContainerProps extends GridProps {
  children: React.ReactNode;
}

export const ResponsiveGridContainer: React.FC<ResponsiveGridContainerProps> = ({
  children,
  ...props
}) => {
  return (
    <Grid container {...props}>
      {children}
    </Grid>
  );
};

// --- Item ---
export interface ResponsiveGridItemProps extends Omit<GridProps, 'container'> {
  children: React.ReactNode;
}

export const ResponsiveGridItem: React.FC<ResponsiveGridItemProps> = ({
  children,
  ...props
}) => {
  return <Grid {...props}>{children}</Grid>;
};