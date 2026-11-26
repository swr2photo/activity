import React from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: string;
  subtitle?: string | React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/** หัวหน้าแอดมิน — ไอคอนไล่สี + เส้นแสงด้านล่าง + แอนิเมชันเข้า */
export function PageHeader({ title, subtitle, icon, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'relative flex w-full min-w-0 max-w-full animate-fade-down flex-col items-start justify-between gap-3 pb-1 sm:gap-4 md:flex-row md:items-center',
        className
      )}
    >
      <div className="flex min-w-0 max-w-full flex-1 items-center gap-3 sm:gap-4">
        {icon && (
          <div className="group relative shrink-0">
            <div className="absolute inset-0 rounded-2xl bg-brand-gradient opacity-40 blur-md transition-opacity duration-500 group-hover:opacity-70" />
            <div className="relative flex h-11 w-11 animate-pop-in items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-[0_8px_20px_-8px_rgba(10,107,207,0.7)] transition-transform duration-500 group-hover:-rotate-6 sm:h-12 sm:w-12 [&_svg]:h-5 [&_svg]:w-5 sm:[&_svg]:h-6 sm:[&_svg]:w-6">
              {icon}
            </div>
          </div>
        )}
        <div className="min-w-0 flex-1 overflow-hidden">
          <h1 className="truncate text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-50">
            {title}
          </h1>
          {subtitle && <div className="truncate text-sm text-muted-foreground">{subtitle}</div>}
        </div>
      </div>
      {actions && (
        <div className="flex w-full min-w-0 max-w-full shrink-0 flex-wrap gap-2 md:w-auto">{actions}</div>
      )}
    </div>
  );
}
