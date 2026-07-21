'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type ResponsiveCardProps = React.HTMLAttributes<HTMLDivElement> & {
  children?: React.ReactNode;
};

/**
 * Simple card wrapper for shared layout usage.
 */
export const ResponsiveCard: React.FC<ResponsiveCardProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card text-card-foreground shadow-sm',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
