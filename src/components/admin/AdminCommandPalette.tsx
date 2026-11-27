'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { CornerDownLeft, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PaletteCommand = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: React.ElementType;
  keywords?: string;
  run: () => void;
};

/**
 * แถบคำสั่งด่วน (Ctrl/⌘ + K) — ค้นหาเมนูและคำสั่งได้จากคีย์บอร์ดทันที
 * เลื่อนด้วย ↑↓ กด Enter เพื่อเลือก, Esc เพื่อปิด
 */
export default function AdminCommandPalette({
  open,
  onOpenChange,
  commands,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: PaletteCommand[];
}) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // คีย์ลัดเปิด/ปิด
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return commands;
    return commands.filter((c) =>
      `${c.label} ${c.hint ?? ''} ${c.keywords ?? ''} ${c.group}`.toLowerCase().includes(t)
    );
  }, [q, commands]);

  useEffect(() => setActive(0), [q]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const runAt = (i: number) => {
    const cmd = filtered[i];
    if (!cmd) return;
    onOpenChange(false);
    // ปิดก่อนแล้วค่อยทำงาน ไม่ให้ focus ตีกับ dialog
    requestAnimationFrame(() => cmd.run());
  };

  let lastGroup = '';

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-slate-950/45 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          aria-label="ค้นหาคำสั่ง"
          className="fixed left-1/2 top-[12vh] z-[81] w-[min(36rem,calc(100vw-1.5rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-[0_30px_80px_-20px_rgba(2,6,23,0.5)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <DialogPrimitive.Title className="sr-only">ค้นหาคำสั่ง</DialogPrimitive.Title>
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((i) => Math.min(filtered.length - 1, i + 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((i) => Math.max(0, i - 1));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  runAt(active);
                }
              }}
              placeholder="ค้นหาเมนูหรือคำสั่ง…"
              className="h-14 w-full bg-transparent text-[0.95rem] outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:block">
              ESC
            </kbd>
          </div>

          <div ref={listRef} role="listbox" className="max-h-[min(60vh,420px)] overflow-y-auto overscroll-contain p-2">
            {filtered.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-muted-foreground">ไม่พบคำสั่งที่ตรงกับ “{q}”</p>
            ) : (
              filtered.map((c, i) => {
                const header = c.group !== lastGroup ? c.group : null;
                lastGroup = c.group;
                const Icon = c.icon;
                return (
                  <React.Fragment key={c.id}>
                    {header && (
                      <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground first:pt-1">
                        {header}
                      </p>
                    )}
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      data-index={i}
                      data-state={i === active ? 'active' : undefined}
                      onMouseMove={() => setActive(i)}
                      onClick={() => runAt(i)}
                      className={cn(
                        'motion-trigger flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                        i === active ? 'bg-primary/10 text-primary' : 'text-foreground'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                          i === active ? 'bg-brand-gradient text-white' : 'bg-muted text-muted-foreground'
                        )}
                      >
                        <Icon className="mi mi-pop h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{c.label}</span>
                        {c.hint && <span className="block truncate text-xs text-muted-foreground">{c.hint}</span>}
                      </span>
                      {i === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 opacity-60" />}
                    </button>
                  </React.Fragment>
                );
              })
            )}
          </div>

          <div className="flex items-center gap-3 border-t border-border bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
            <span><kbd className="font-sans font-semibold">↑↓</kbd> เลื่อน</span>
            <span><kbd className="font-sans font-semibold">Enter</kbd> เลือก</span>
            <span className="ml-auto"><kbd className="font-sans font-semibold">Ctrl/⌘ K</kbd> เปิด/ปิด</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
