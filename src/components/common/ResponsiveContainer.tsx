import React from 'react';
import { cn } from '@/lib/utils';

export type ResponsiveContainerProps = React.HTMLAttributes<HTMLDivElement> & {
  children?: React.ReactNode;
  /** Max width preset. Default "lg". */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
};

const maxWidthMap = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  '2xl': 'max-w-screen-2xl',
  full: 'max-w-full',
} as const;

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  className,
  maxWidth = 'lg',
  ...props
}) => {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 sm:px-6',
        maxWidthMap[maxWidth],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
