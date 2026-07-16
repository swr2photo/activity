'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AlertTriangle, Ban, HelpCircle, Info, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type ConfirmVariant = 'default' | 'destructive' | 'warning' | 'info';

export type ConfirmOptions = {
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** ซ่อนปุ่มยกเลิก — ใช้เป็นกล่องแจ้งเตือนกดตกลงอย่างเดียว */
  alertOnly?: boolean;
  variant?: ConfirmVariant;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

const VARIANT_UI: Record<
  ConfirmVariant,
  { icon: React.ElementType; iconWrap: string; confirmClass: string }
> = {
  default: {
    icon: HelpCircle,
    iconWrap: 'bg-primary/10 text-primary',
    confirmClass: 'bg-primary hover:bg-primary/90 text-primary-foreground',
  },
  destructive: {
    icon: Trash2,
    iconWrap: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    confirmClass: 'bg-rose-600 hover:bg-rose-700 text-white',
  },
  warning: {
    icon: Ban,
    iconWrap: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    confirmClass: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  info: {
    icon: Info,
    iconWrap: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    confirmClass: 'bg-sky-600 hover:bg-sky-700 text-white',
  },
};

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOpen(false);
  }, []);

  const confirm = useCallback<ConfirmFn>((opts) => {
    // ปิดคิวเก่าถ้ามี (กันค้าง)
    resolverRef.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOptions({
        confirmText: opts.alertOnly ? 'ตกลง' : 'ยืนยัน',
        cancelText: 'ยกเลิก',
        variant: opts.alertOnly ? 'info' : 'default',
        ...opts,
      });
      setOpen(true);
    });
  }, []);

  const variant = options?.variant ?? 'default';
  const ui = VARIANT_UI[variant];
  const Icon = ui.icon;

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}

      <DialogPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          if (!next) settle(false);
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            className={cn(
              'fixed left-1/2 top-1/2 z-[101] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2',
              'rounded-2xl border border-border bg-background p-6 shadow-2xl outline-none',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
            )}
            onOpenAutoFocus={(e) => {
              // โฟกัสปุ่มยืนยันแทน X
              e.preventDefault();
              const el = document.getElementById('app-confirm-primary');
              el?.focus();
            }}
          >
            <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left gap-4">
              <div className={cn('shrink-0 inline-flex h-12 w-12 items-center justify-center rounded-2xl', ui.iconWrap)}>
                {variant === 'warning' ? <AlertTriangle className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <DialogPrimitive.Title className="text-lg font-bold text-foreground leading-snug">
                  {options?.title}
                </DialogPrimitive.Title>
                {options?.description && (
                  <DialogPrimitive.Description className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {options.description}
                  </DialogPrimitive.Description>
                )}
              </div>
            </div>

            <div className={cn(
              'mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
              options?.alertOnly && 'sm:justify-center'
            )}>
              {!options?.alertOnly && (
                <Button
                  type="button"
                  variant="outline"
                  className="sm:min-w-[100px]"
                  onClick={() => settle(false)}
                >
                  {options?.cancelText || 'ยกเลิก'}
                </Button>
              )}
              <Button
                id="app-confirm-primary"
                type="button"
                className={cn('sm:min-w-[100px]', ui.confirmClass)}
                onClick={() => settle(true)}
              >
                {options?.confirmText || 'ยืนยัน'}
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </ConfirmContext.Provider>
  );
}

/** ยืนยันก่อนทำกระบวนการ — คืน true เมื่อกดยืนยัน */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm ต้องอยู่ภายใน ConfirmDialogProvider');
  }
  return ctx;
}

/** แจ้งเตือนแบบปุ่มเดียว (แทน alert) */
export function useAlertDialog() {
  const confirm = useConfirm();
  return useCallback(
    async (title: string, description?: React.ReactNode, variant: ConfirmVariant = 'info') => {
      await confirm({ title, description, alertOnly: true, variant, confirmText: 'ตกลง' });
    },
    [confirm]
  );
}
