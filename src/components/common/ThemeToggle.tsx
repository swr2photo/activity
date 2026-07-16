'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Monitor } from 'lucide-react';
import { IconButton, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { cn } from '@/lib/utils';

type Variant = 'icon' | 'menu' | 'segmented';

interface ThemeToggleProps {
  variant?: Variant;
  className?: string;
  /** สำหรับปุ่มแบบ shadcn/admin (ไม่ใช้ MUI) */
  appearance?: 'mui' | 'plain';
}

const OPTIONS = [
  { value: 'light', label: 'สว่าง', icon: Sun },
  { value: 'dark', label: 'มืด', icon: Moon },
  { value: 'system', label: 'ตามระบบ', icon: Monitor },
] as const;

export default function ThemeToggle({
  variant = 'icon',
  className,
  appearance = 'mui',
}: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="สลับธีม"
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground',
          className
        )}
        disabled
      >
        <Sun className="h-4 w-4 opacity-40" />
      </button>
    );
  }

  const CurrentIcon = resolvedTheme === 'dark' ? Moon : Sun;

  if (variant === 'segmented') {
    return (
      <div
        className={cn(
          'inline-flex rounded-lg border border-border bg-muted/40 p-0.5',
          className
        )}
        role="group"
        aria-label="เลือกธีม"
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
              theme === value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
    );
  }

  if (appearance === 'plain' || variant === 'menu') {
    return (
      <>
        <button
          type="button"
          title="สลับธีม"
          aria-label="สลับธีม"
          onClick={(e) => setAnchor(e.currentTarget)}
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors',
            className
          )}
        >
          <CurrentIcon className="h-4 w-4" />
        </button>
        <Menu
          anchorEl={anchor}
          open={Boolean(anchor)}
          onClose={() => setAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          {OPTIONS.map(({ value, label, icon: Icon }) => (
            <MenuItem
              key={value}
              selected={theme === value}
              onClick={() => {
                setTheme(value);
                setAnchor(null);
              }}
            >
              <ListItemIcon>
                <Icon className="h-4 w-4" />
              </ListItemIcon>
              <ListItemText>{label}</ListItemText>
            </MenuItem>
          ))}
        </Menu>
      </>
    );
  }

  // MUI icon button + menu
  return (
    <>
      <Tooltip title="ธีมสว่าง / มืด">
        <IconButton
          aria-label="สลับธีม"
          onClick={(e) => setAnchor(e.currentTarget)}
          className={className}
          size="small"
          sx={{ color: 'text.secondary' }}
        >
          <CurrentIcon size={18} />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <MenuItem
            key={value}
            selected={theme === value}
            onClick={() => {
              setTheme(value);
              setAnchor(null);
            }}
          >
            <ListItemIcon>
              <Icon className="h-4 w-4" />
            </ListItemIcon>
            <ListItemText>{label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
