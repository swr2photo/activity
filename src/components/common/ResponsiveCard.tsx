// components/common/ResponsiveCard.tsx
import React from 'react';
import { Card, CardContent, SxProps, Theme } from '@mui/material';

export interface ResponsiveCardProps {
  children: React.ReactNode;
  sx?: SxProps<Theme>;
  elevation?: number;
  variant?: 'elevation' | 'outlined';
  onClick?: () => void;
}

export const ResponsiveCard: React.FC<ResponsiveCardProps> = ({ 
  children, 
  sx,
  elevation = 1,
  variant = 'elevation',
  onClick
}) => (
  <Card 
    sx={{ 
      p: { xs: 2, md: 3 }, 
      borderRadius: 2,
      transition: 'all 0.3s ease-in-out',
      cursor: onClick ? 'pointer' : 'default',
      '&:hover': onClick ? {
        transform: 'translateY(-2px)',
        boxShadow: 3
      } : {},
      ...sx 
    }}
    elevation={elevation}
    variant={variant}
    onClick={onClick}
  >
    <CardContent sx={{ '&:last-child': { pb: 2 } }}>
      {children}
    </CardContent>
  </Card>
);