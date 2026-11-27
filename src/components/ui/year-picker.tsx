'use client';

import { cn } from '@/lib/utils';
import { CalendarRange, ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

export interface YearPickerProps {
  value?: string | number;
  onChange?: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  min?: number;
  max?: number;
  name?: string;
  id?: string;
  ariaLabel?: string;
}

export function YearPicker({
  value = '',
  onChange,
  placeholder = 'เลือกปี (พ.ศ. / ค.ศ.)',
  disabled = false,
  className = '',
  min = 1900,
  max = 2650,
  name,
  id,
  ariaLabel = 'เลือกปี',
}: YearPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const inputId = id || generatedId;

  const strVal = value !== undefined && value !== null ? String(value).trim() : '';
  const numVal = parseInt(strVal, 10);

  const now = new Date();
  const currentCE = now.getFullYear();
  const currentBE = currentCE + 543;
  const isThaiBE = !isNaN(numVal) && numVal > 2400;

  const [baseYearBE, setBaseYearBE] = useState(() =>
    !isNaN(numVal) ? (isThaiBE ? numVal : numVal + 543) : currentBE
  );
  const [customInput, setCustomInput] = useState(strVal);

  useEffect(() => {
    if (strVal) {
      setCustomInput(strVal);
      const n = parseInt(strVal, 10);
      if (!isNaN(n)) setBaseYearBE(n > 2400 ? n : n + 543);
    } else {
      setCustomInput('');
    }
  }, [strVal]);

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

  const minCE = min > 2400 ? min - 543 : min;
  const maxCE = max > 2400 ? max - 543 : max;
  const handleSelectYear = (beYear: number) => {
    const normalizedBE = beYear > 2400 ? beYear : beYear + 543;
    if (normalizedBE - 543 < minCE || normalizedBE - 543 > maxCE) return;
    onChange?.(String(normalizedBE));
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange?.('');
    setIsOpen(false);
  };

  const displayLabel = (() => {
    if (!strVal || isNaN(numVal)) return '';
    if (numVal > 2400) return `พ.ศ. ${numVal} (ค.ศ. ${numVal - 543})`;
    return `ค.ศ. ${numVal} (พ.ศ. ${numVal + 543})`;
  })();

  const startYear = Math.floor(baseYearBE / 12) * 12;
  const years = Array.from({ length: 12 }, (_, i) => startYear + i);

  return (
    <div ref={containerRef} className="relative inline-block w-full min-w-0">
      <input
        type="number"
        id={inputId}
        name={name}
        value={strVal}
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
          !strVal && 'text-muted-foreground font-normal',
          className
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0 truncate">
          <CalendarRange className="size-4 text-primary shrink-0" />
          <span className="truncate">{displayLabel || placeholder}</span>
        </div>

        {strVal && !disabled ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="ล้างปี"
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
            พ.ศ./ค.ศ.
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="เลือกปี"
          className="absolute z-[70] mt-1.5 w-72 sm:w-80 rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 left-0"
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <button
              type="button"
              onClick={() => setBaseYearBE((y) => y - 12)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              aria-label="ช่วงปีก่อนหน้า"
            >
              <ChevronLeft className="size-4" />
            </button>

            <div className="text-center">
              <span className="text-sm font-bold">
                พ.ศ. {years[0]} – {years[years.length - 1]}
              </span>
              <span className="text-xs text-muted-foreground block font-mono">
                (ค.ศ. {years[0] - 543} – {years[years.length - 1] - 543})
              </span>
            </div>

            <button
              type="button"
              onClick={() => setBaseYearBE((y) => y + 12)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              aria-label="ช่วงปีถัดไป"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSelectYear(currentBE)}
              className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/20 border border-primary/20 cursor-pointer"
            >
              ปีปัจจุบัน ({currentBE})
            </button>
            <button
              type="button"
              onClick={() => handleSelectYear(currentBE - 1)}
              className="rounded-lg bg-muted/60 px-2 py-1 text-xs font-medium text-foreground hover:bg-muted border border-border cursor-pointer"
            >
              ปีที่แล้ว ({currentBE - 1})
            </button>
          </div>

          <div className="mt-3.5 grid grid-cols-3 gap-2">
            {years.map((yBE) => {
              const yCE = yBE - 543;
              const isSelected = !isNaN(numVal) && (numVal === yBE || numVal === yCE);
              const isCurrent = yBE === currentBE;
              return (
                <button
                  key={yBE}
                  type="button"
                  onClick={() => handleSelectYear(yBE)}
                  disabled={yCE < minCE || yCE > maxCE}
                  className={cn(
                    'flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40',
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-xs font-bold scale-[1.02]'
                      : isCurrent
                        ? 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 font-semibold'
                        : 'text-foreground bg-muted/40 hover:bg-muted border border-border/60 font-medium'
                  )}
                >
                  <span className="font-bold">{yBE}</span>
                  <span
                    className={cn(
                      'text-[10px] font-mono',
                      isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                    )}
                  >
                    {yCE}
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

            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder="ระบุปี..."
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customInput) {
                    const n = parseInt(customInput, 10);
                    if (!isNaN(n)) handleSelectYear(n);
                  }
                }}
                className="w-24 rounded-lg border border-input bg-background px-2 py-1 text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => {
                  if (customInput) {
                    const n = parseInt(customInput, 10);
                    if (!isNaN(n)) handleSelectYear(n);
                  }
                }}
                className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 cursor-pointer"
              >
                ใส่
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
