// components/common/ResponsiveCard.tsx
'use client';

import React from 'react';
import Card, { CardProps } from '@mui/material/Card';

export type ResponsiveCardProps = React.PropsWithChildren<CardProps>;

/**
 * Wrapper เฉย ๆ เพื่อให้ import ใช้ร่วมกันง่าย (และเป็น module แน่นอน)
 */
export const ResponsiveCard: React.FC<ResponsiveCardProps> = ({ children, ...props }) => {
  return <Card {...props}>{children}</Card>;
};
