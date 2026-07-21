'use client';

import React from 'react';
import { cn } from '@/lib/utils';

type ColSpan = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

const COL_SPAN: Record<ColSpan, string> = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
  5: 'col-span-5',
  6: 'col-span-6',
  7: 'col-span-7',
  8: 'col-span-8',
  9: 'col-span-9',
  10: 'col-span-10',
  11: 'col-span-11',
  12: 'col-span-12',
};

const SM_COL_SPAN: Record<ColSpan, string> = {
  1: 'sm:col-span-1',
  2: 'sm:col-span-2',
  3: 'sm:col-span-3',
  4: 'sm:col-span-4',
  5: 'sm:col-span-5',
  6: 'sm:col-span-6',
  7: 'sm:col-span-7',
  8: 'sm:col-span-8',
  9: 'sm:col-span-9',
  10: 'sm:col-span-10',
  11: 'sm:col-span-11',
  12: 'sm:col-span-12',
};

const MD_COL_SPAN: Record<ColSpan, string> = {
  1: 'md:col-span-1',
  2: 'md:col-span-2',
  3: 'md:col-span-3',
  4: 'md:col-span-4',
  5: 'md:col-span-5',
  6: 'md:col-span-6',
  7: 'md:col-span-7',
  8: 'md:col-span-8',
  9: 'md:col-span-9',
  10: 'md:col-span-10',
  11: 'md:col-span-11',
  12: 'md:col-span-12',
};

const LG_COL_SPAN: Record<ColSpan, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
  5: 'lg:col-span-5',
  6: 'lg:col-span-6',
  7: 'lg:col-span-7',
  8: 'lg:col-span-8',
  9: 'lg:col-span-9',
  10: 'lg:col-span-10',
  11: 'lg:col-span-11',
  12: 'lg:col-span-12',
};

const XL_COL_SPAN: Record<ColSpan, string> = {
  1: 'xl:col-span-1',
  2: 'xl:col-span-2',
  3: 'xl:col-span-3',
  4: 'xl:col-span-4',
  5: 'xl:col-span-5',
  6: 'xl:col-span-6',
  7: 'xl:col-span-7',
  8: 'xl:col-span-8',
  9: 'xl:col-span-9',
  10: 'xl:col-span-10',
  11: 'xl:col-span-11',
  12: 'xl:col-span-12',
};

const GAP: Record<number, string> = {
  0: 'gap-0',
  1: 'gap-1',
  2: 'gap-2',
  3: 'gap-3',
  4: 'gap-4',
  5: 'gap-5',
  6: 'gap-6',
  8: 'gap-8',
};

export interface ResponsiveGridContainerProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Gap between items (Tailwind spacing). Default 4. */
  gap?: number;
}

export const ResponsiveGridContainer: React.FC<ResponsiveGridContainerProps> = ({
  children,
  className,
  gap = 4,
  ...props
}) => {
  return (
    <div
      className={cn('grid grid-cols-12', GAP[gap] ?? 'gap-4', className)}
      {...props}
    >
      {children}
    </div>
  );
};

export interface ResponsiveGridItemProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  xs?: ColSpan;
  sm?: ColSpan;
  md?: ColSpan;
  lg?: ColSpan;
  xl?: ColSpan;
}

export const ResponsiveGridItem: React.FC<ResponsiveGridItemProps> = ({
  children,
  className,
  xs = 12,
  sm,
  md,
  lg,
  xl,
  ...props
}) => {
  return (
    <div
      className={cn(
        COL_SPAN[xs],
        sm != null && SM_COL_SPAN[sm],
        md != null && MD_COL_SPAN[md],
        lg != null && LG_COL_SPAN[lg],
        xl != null && XL_COL_SPAN[xl],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
