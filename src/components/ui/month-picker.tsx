'use client';

import { cn } from '@/lib/utils';
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

export interface MonthPickerProps {
  value?: string;
  onChange?: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  name?: string;
  id?: string;
  ariaLabel?: string;
}

const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

export function MonthPicker({
  value = '',
  onChange,
  placeholder = 'เลือกเดือน (ดด/ปปปป)',
  disabled = false,
  className = '',
  name,
  id,
  ariaLabel = 'เลือกเดือน',
}: MonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const inputId = id || generatedId;

  const now = new Date();
  const currentYearCE = now.getFullYear();
  const currentMonthIdx = now.getMonth();

  const [selectedYear, setSelectedYear] = useState(() => {
    if (!value) return currentYearCE;
    const y = parseInt(value.split('-')[0], 10);
    return isNaN(y) ? currentYearCE : y;
  });

  const [selectedMonth, setSelectedMonth] = useState<number | null>(() => {
    if (!value) return null;
    const m = parseInt(value.split('-')[1], 10);
    return isNaN(m) ? null : m - 1;
  });

  useEffect(() => {
    if (value && value.includes('-')) {
      const [yStr, mStr] = value.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      if (!isNaN(y)) setSelectedYear(y);
      if (!isNaN(m)) setSelectedMonth(m - 1);
    } else if (!value) {
      setSelectedMonth(null);
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

  const handleSelectMonth = (mIdx: number) => {
    setSelectedMonth(mIdx);
    onChange?.(`${selectedYear}-${String(mIdx + 1).padStart(2, '0')}`);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelectedMonth(null);
    onChange?.('');
    setIsOpen(false);
  };

  const handleSelectCurrentMonth = () => {
    setSelectedYear(currentYearCE);
    const mStr = String(currentMonthIdx + 1).padStart(2, '0');
    setSelectedMonth(currentMonthIdx);
    onChange?.(`${currentYearCE}-${mStr}`);
    setIsOpen(false);
  };

  const displayLabel =
    value && selectedMonth !== null
      ? `${THAI_MONTHS_FULL[selectedMonth]} ${selectedYear + 543}`
      : '';

  return (
    <div ref={containerRef} className="relative inline-block w-full min-w-0">
      <input
        type="month"
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
          <CalendarDays className="size-4 text-primary shrink-0" />
          <span className="truncate">{displayLabel || placeholder}</span>
        </div>

        {value && !disabled ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="ล้างเดือน"
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
            ดด/ปปปป
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="เลือกเดือน"
          className="absolute z-[70] mt-1.5 w-72 sm:w-80 rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 left-0"
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <button
              type="button"
              onClick={() => setSelectedYear((y) => y - 1)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              aria-label="ปีก่อนหน้า"
            >
              <ChevronLeft className="size-4" />
            </button>

            <div className="text-center">
              <span className="text-sm font-bold">พ.ศ. {selectedYear + 543}</span>
              <span className="text-xs text-muted-foreground block font-mono">
                (ค.ศ. {selectedYear})
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSelectedYear((y) => y + 1)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              aria-label="ปีถัดไป"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="mt-3.5 grid grid-cols-3 gap-2">
            {THAI_MONTHS_SHORT.map((mShort, idx) => {
              const isSelected = selectedMonth === idx && value.startsWith(`${selectedYear}-`);
              const isCurrent = currentYearCE === selectedYear && currentMonthIdx === idx;
              return (
                <button
                  key={mShort}
                  type="button"
                  onClick={() => handleSelectMonth(idx)}
                  className={cn(
                    'flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-semibold transition-all cursor-pointer',
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-xs font-bold scale-[1.02]'
                      : isCurrent
                        ? 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20'
                        : 'text-foreground bg-muted/40 hover:bg-muted border border-border/60'
                  )}
                >
                  <span>{mShort}</span>
                  <span
                    className={cn(
                      'text-[10px] font-normal truncate max-w-full px-1',
                      isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                    )}
                  >
                    {THAI_MONTHS_FULL[idx]}
                  </span>
                </button>
              );
            })}
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

            <button
              type="button"
              onClick={handleSelectCurrentMonth}
              className="rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 border border-primary/20 cursor-pointer"
            >
              เดือนปัจจุบัน
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
