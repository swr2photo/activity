// components/common/ResponsiveGrid.tsx
import React from 'react';
import { Grid, SxProps, Theme } from '@mui/material';

export interface ResponsiveGridProps {
  children: React.ReactNode;
  container?: boolean;
  item?: boolean;
  xs?: boolean | number;
  sm?: boolean | number;
  md?: boolean | number;
  lg?: boolean | number;
  xl?: boolean | number;
  spacing?: number;
  sx?: SxProps<Theme>;
  direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({ 
  children,
  container = false,
  item = false,
  xs,
  sm,
  md,
  lg,
  xl,
  spacing,
  sx,
  direction = 'row',
  justifyContent,
  alignItems
}) => (
  <Grid
    container={container}
    item={item}
    xs={xs}
    sm={sm}
    md={md}
    lg={lg}
    xl={xl}
    spacing={spacing}
    direction={direction}
    justifyContent={justifyContent}
    alignItems={alignItems}
    sx={sx}
  >
    {children}
  </Grid>
);