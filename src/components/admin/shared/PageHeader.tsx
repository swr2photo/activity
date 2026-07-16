import React from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: string;
  subtitle?: string | React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, icon, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col md:flex-row gap-4 justify-between items-start md:items-center w-full", className)}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className="p-3 bg-primary/10 text-primary rounded-xl shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 truncate">{title}</h1>
          {subtitle && (
            <div className="text-sm text-muted-foreground truncate">
              {subtitle}
            </div>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap gap-2 w-full md:w-auto shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
