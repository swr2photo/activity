// components/common/ResponsiveGrid.tsx
'use client';

import React from 'react';
import Grid from '@mui/material/Grid';
import type { GridProps } from '@mui/material/Grid';

/**
 * MUI v7: แยกเป็น Container และ Item เพื่อหลีกเลี่ยง overload/type conflict
 */

export type ResponsiveGridContainerProps = Omit<GridProps, 'item'> & {
  children: React.ReactNode;
};

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

export type ResponsiveGridItemProps = Omit<GridProps, 'container'> & {
  children: React.ReactNode;
};

export const ResponsiveGridItem: React.FC<ResponsiveGridItemProps> = ({
  children,
  ...props
}) => {
  // ไม่ส่ง item prop เพื่อกัน type clash ใน MUI v7
  return <Grid {...props}>{children}</Grid>;
};
