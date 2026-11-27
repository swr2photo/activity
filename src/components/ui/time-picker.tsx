'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Clock, RotateCcw, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TimePickerProps {
  value?: string;
  onChange?: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  name?: string;
  id?: string;
  ariaLabel?: string;
}

const QUICK_TIME_PRESETS = [
  { label: 'เช้า', time: '08:30' },
  { label: 'เที่ยง', time: '12:00' },
  { label: 'บ่าย', time: '13:30' },
  { label: 'เย็น', time: '16:30' },
  { label: 'ค่ำ', time: '19:00' },
];

export function TimePicker({
  value = '',
  onChange,
  placeholder = 'เลือกเวลา (ชช:นน)',
  disabled = false,
  className = '',
  name,
  id,
  ariaLabel = 'เลือกเวลา',
}: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const inputId = id || generatedId;

  const [hour, setHour] = useState(() => (value ? value.split(':')[0] || '08' : '08'));
  const [minute, setMinute] = useState(() => (value ? value.split(':')[1] || '00' : '00'));

  useEffect(() => {
    if (value && value.includes(':')) {
      const [h, m] = value.split(':');
      if (h) setHour(h.padStart(2, '0'));
      if (m) setMinute(m.padStart(2, '0'));
    }
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleApply = (h = hour, m = minute) => {
    onChange?.(`${h.padStart(2, '0')}:${m.padStart(2, '0')}`);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange?.('');
    setIsOpen(false);
  };

  const handleSetNow = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    setHour(h);
    setMinute(m);
    handleApply(h, m);
  };

  const formattedDisplay = value ? `${value} น.` : '';

  return (
    <div ref={containerRef} className="relative inline-block w-full min-w-0">
      <input
        type="time"
        id={inputId}
        name={name}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        className="sr-only pointer-events-none"
        tabIndex={-1}
        aria-hidden="true"
      />

      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={cn(
          'w-full flex items-center justify-between gap-2.5 h-10 px-3.5 py-2 text-sm rounded-xl border border-input bg-background text-left font-medium transition-all shadow-xs hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
          !value && 'text-muted-foreground font-normal',
          className
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0 truncate">
          <Clock className="size-4 text-primary shrink-0" />
          <span className="truncate">{formattedDisplay || placeholder}</span>
        </div>

        {value && !disabled ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="ล้างเวลา"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                handleClear();
              }
            }}
            className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
          >
            <X className="size-3.5" />
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-muted-foreground px-1.5 py-0.5 rounded bg-muted border border-border">
            ชช:นน
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="เลือกเวลา"
          className="absolute z-[70] mt-1.5 w-72 sm:w-80 rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 left-0"
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <span className="text-xs font-bold">เลือกเวลา (24 ชั่วโมง)</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleSetNow}
              className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 border border-primary/20 cursor-pointer"
            >
              ตอนนี้
            </button>
            {QUICK_TIME_PRESETS.map((p) => (
              <button
                key={p.time}
                type="button"
                onClick={() => {
                  const [h, m] = p.time.split(':');
                  setHour(h);
                  setMinute(m);
                  handleApply(h, m);
                }}
                className="rounded-lg bg-muted/60 px-2 py-1 text-xs font-medium text-foreground hover:bg-muted border border-border cursor-pointer"
              >
                {p.label} {p.time}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 bg-muted/40 p-3 rounded-xl border border-border/60">
            <div className="space-y-1.5 text-center">
              <label className="text-[11px] font-bold text-muted-foreground block">
                ชั่วโมง ({hour})
              </label>
              <div className="max-h-40 overflow-y-auto overscroll-contain rounded-lg border border-border bg-background p-1 space-y-0.5">
                {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHour(h)}
                    className={cn(
                      'w-full rounded-md py-1 text-xs font-mono font-medium transition-colors cursor-pointer',
                      hour === h
                        ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 text-center">
              <label className="text-[11px] font-bold text-muted-foreground block">
                นาที ({minute})
              </label>
              <div className="max-h-40 overflow-y-auto overscroll-contain rounded-lg border border-border bg-background p-1 space-y-0.5">
                {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMinute(m)}
                    className={cn(
                      'w-full rounded-md py-1 text-xs font-mono font-medium transition-colors cursor-pointer',
                      minute === m
                        ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <RotateCcw className="size-3" />
              ล้าง
            </button>

            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-md border border-primary/20">
                {hour}:{minute} น.
              </span>
              <button
                type="button"
                onClick={() => handleApply()}
                className="flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 cursor-pointer"
              >
                <Check className="size-3.5" />
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
