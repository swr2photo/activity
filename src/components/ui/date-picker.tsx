'use client';

import { useMemo, useEffect, useId, useRef, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  RotateCcw,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

const WEEKDAYS_THAI = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

export interface DatePickerProps {
  value?: string;
  onChange?: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  includeTime?: boolean;
  min?: string;
  max?: string;
  name?: string;
  id?: string;
  ariaLabel?: string;
}

export function formatThaiDisplayDate(dateStr?: string, includeTime = false): string {
  if (!dateStr || dateStr.trim() === '') return '';
  const parts = dateStr.split('T');
  const dateParts = parts[0].split('-');
  if (dateParts.length !== 3) return dateStr;

  const y = parseInt(dateParts[0], 10);
  const m = parseInt(dateParts[1], 10) - 1;
  const d = parseInt(dateParts[2], 10);

  if (isNaN(y) || isNaN(m) || isNaN(d) || m < 0 || m > 11) return dateStr;

  const thaiYear = y > 2400 ? y : y + 543;
  let result = `${d} ${THAI_MONTHS_SHORT[m]} ${thaiYear}`;

  if (includeTime && parts[1]) {
    const timeParts = parts[1].split(':');
    if (timeParts.length >= 2) {
      result += ` ${timeParts[0]}:${timeParts[1]} น.`;
    }
  }
  return result;
}

export function DatePicker({
  value = '',
  onChange,
  placeholder = 'เลือกวันที่ (วว/ดด/ปปปป)',
  disabled = false,
  className,
  includeTime = false,
  min,
  max,
  name,
  id,
  ariaLabel,
}: DatePickerProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const parsedDate = useMemo(() => {
    if (!value) return null;
    const datePart = value.split('T')[0];
    const [y, m, d] = datePart.split('-').map(Number);
    if (!y || !m || !d) return null;
    return { year: y, month: m - 1, day: d };
  }, [value]);

  const parsedTime = (() => {
    if (!includeTime || !value || !value.includes('T')) return { hour: '09', minute: '00' };
    const [h, m] = value.split('T')[1].split(':');
    return {
      hour: h ? h.padStart(2, '0') : '09',
      minute: m ? m.padStart(2, '0') : '00',
    };
  })();

  const today = new Date();
  const [viewYear, setViewYear] = useState<number>(parsedDate ? parsedDate.year : today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(parsedDate ? parsedDate.month : today.getMonth());
  const [viewMode, setViewMode] = useState<'days' | 'months' | 'years'>('days');
  const [timeHour, setTimeHour] = useState(parsedTime.hour);
  const [timeMinute, setTimeMinute] = useState(parsedTime.minute);

  useEffect(() => {
    if (parsedDate) {
      setViewYear(parsedDate.year);
      setViewMonth(parsedDate.month);
    }
    if (includeTime && value.includes('T')) {
      const parts = value.split('T')[1].split(':');
      if (parts[0]) setTimeHour(parts[0].padStart(2, '0'));
      if (parts[1]) setTimeMinute(parts[1].padStart(2, '0'));
    }
  }, [value, includeTime, parsedDate]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setViewMode('days');
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setViewMode('days');
      }
    }
    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  function handleSelectDate(day: number) {
    const formattedDate = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const finalVal = includeTime ? `${formattedDate}T${timeHour}:${timeMinute}` : formattedDate;
    onChange?.(finalVal);
    if (!includeTime) setIsOpen(false);
  }

  function handleClear(e: React.SyntheticEvent) {
    e.stopPropagation();
    onChange?.('');
    setIsOpen(false);
  }

  function handleToday(e: React.MouseEvent) {
    e.stopPropagation();
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const finalVal = includeTime ? `${formattedDate}T${timeHour}:${timeMinute}` : formattedDate;
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    onChange?.(finalVal);
    if (!includeTime) setIsOpen(false);
  }

  function handlePrevMonth(e: React.MouseEvent) {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function handleNextMonth(e: React.MouseEvent) {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function handleTimeChange(h: string, m: string) {
    setTimeHour(h);
    setTimeMinute(m);
    if (value) {
      const datePart = value.split('T')[0];
      onChange?.(`${datePart}T${h}:${m}`);
    }
  }

  const isSelected = (day: number) =>
    Boolean(parsedDate && parsedDate.year === viewYear && parsedDate.month === viewMonth && parsedDate.day === day);

  const isTodayDate = (day: number) =>
    today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;

  const thaiBuddhistYear = viewYear > 2400 ? viewYear : viewYear + 543;

  return (
    <div ref={containerRef} className="relative inline-block w-full">
      <input
        type={includeTime ? 'datetime-local' : 'date'}
        id={inputId}
        name={name}
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange?.(e.target.value)}
        className="sr-only pointer-events-none"
        tabIndex={-1}
        aria-hidden="true"
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={ariaLabel ?? placeholder}
        className={cn(
          'group flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background hover:bg-muted/40 px-3 py-2 text-xs sm:text-sm font-medium transition-colors shadow-xs cursor-pointer',
          'focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary',
          isOpen && 'border-primary ring-2 ring-primary/20',
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <CalendarIcon className="size-4 shrink-0 text-primary" />
          <span className={cn('truncate font-medium', value ? 'text-foreground' : 'text-muted-foreground')}>
            {value ? formatThaiDisplayDate(value, includeTime) : placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleClear(e);
              }}
              title="ล้างวันที่"
              className="flex size-5 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <X className="size-3" />
            </span>
          )}
          <ChevronDown
            className={cn(
              'size-3.5 text-muted-foreground transition-transform duration-200',
              isOpen && 'rotate-180 text-primary'
            )}
          />
        </div>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="absolute left-0 top-[calc(100%+6px)] z-[70] w-72 sm:w-80 rounded-2xl border border-border bg-popover p-3.5 text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 duration-150 space-y-3"
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="เดือนก่อนหน้า"
            >
              <ChevronLeft className="size-4" />
            </button>

            <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs sm:text-sm">
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'months' ? 'days' : 'months')}
                className="rounded-lg px-2 py-1 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                title="คลิกเพื่อเลือกเดือน"
              >
                {THAI_MONTHS_FULL[viewMonth]}
              </button>
              <span className="text-muted-foreground/50">/</span>
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'years' ? 'days' : 'years')}
                className="rounded-lg px-2 py-1 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer font-mono"
                title="คลิกเพื่อเลือกปี"
              >
                {thaiBuddhistYear}
                <span className="text-[10px] text-muted-foreground font-normal ml-1">({viewYear})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="เดือนถัดไป"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {viewMode === 'months' && (
            <div className="grid grid-cols-3 gap-1.5 py-1">
              {THAI_MONTHS_SHORT.map((mName, idx) => (
                <button
                  key={mName}
                  type="button"
                  onClick={() => {
                    setViewMonth(idx);
                    setViewMode('days');
                  }}
                  className={cn(
                    'rounded-xl py-2 text-xs font-medium transition-colors cursor-pointer',
                    viewMonth === idx
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : 'text-foreground hover:bg-primary/10 hover:text-primary'
                  )}
                >
                  {mName}
                </button>
              ))}
            </div>
          )}

          {viewMode === 'years' && (
            <div className="max-h-48 overflow-y-auto overscroll-contain grid grid-cols-3 gap-1.5 py-1">
              {Array.from({ length: 30 }, (_, i) => viewYear - 15 + i).map((y) => {
                const bYear = y > 2400 ? y : y + 543;
                return (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      setViewYear(y);
                      setViewMode('days');
                    }}
                    className={cn(
                      'rounded-xl py-2 text-xs font-medium font-mono transition-colors cursor-pointer',
                      viewYear === y
                        ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                        : 'text-foreground hover:bg-primary/10 hover:text-primary'
                    )}
                  >
                    {bYear}
                  </button>
                );
              })}
            </div>
          )}

          {viewMode === 'days' && (
            <div className="space-y-1">
              <div className="grid grid-cols-7 text-center">
                {WEEKDAYS_THAI.map((d, i) => (
                  <span
                    key={d}
                    className={cn(
                      'py-1 text-[11px] font-semibold',
                      i === 0 ? 'text-destructive' : 'text-muted-foreground'
                    )}
                  >
                    {d}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => {
                  const prevDay = daysInPrevMonth - firstDayOfWeek + i + 1;
                  return (
                    <span
                      key={`prev-${prevDay}`}
                      className="flex h-8 items-center justify-center text-xs text-muted-foreground/40 select-none"
                    >
                      {prevDay}
                    </span>
                  );
                })}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const selected = isSelected(day);
                  const isCurrentDay = isTodayDate(day);

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleSelectDate(day)}
                      className={cn(
                        'relative flex h-8 w-full items-center justify-center rounded-xl text-xs font-medium transition-all cursor-pointer',
                        selected
                          ? 'bg-primary text-primary-foreground font-bold shadow-xs scale-105'
                          : isCurrentDay
                            ? 'bg-primary/10 text-primary font-bold border border-primary/40'
                            : 'text-foreground hover:bg-muted'
                      )}
                    >
                      {day}
                      {isCurrentDay && !selected && (
                        <span className="absolute bottom-1 size-1 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {includeTime && (
            <div className="border-t border-border/60 pt-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="size-3.5 text-primary" />
                <span className="font-semibold text-foreground">เวลา:</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={timeHour}
                  aria-label="ชั่วโมง"
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(23, Number(e.target.value) || 0));
                    handleTimeChange(String(v).padStart(2, '0'), timeMinute);
                  }}
                  className="w-11 rounded-lg border border-input bg-muted/40 py-1 text-center text-xs font-mono font-bold text-foreground focus:bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="font-bold text-muted-foreground">:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={timeMinute}
                  aria-label="นาที"
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(59, Number(e.target.value) || 0));
                    handleTimeChange(timeHour, String(v).padStart(2, '0'));
                  }}
                  className="w-11 rounded-lg border border-input bg-muted/40 py-1 text-center text-xs font-mono font-bold text-foreground focus:bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="text-[11px] font-semibold text-muted-foreground ml-1">น.</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleToday}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-primary hover:bg-primary/10 font-medium transition-colors cursor-pointer"
              >
                <RotateCcw className="size-3" />
                วันนี้
              </button>
              {value && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded-lg px-2 py-1 text-destructive hover:bg-destructive/10 font-medium transition-colors cursor-pointer"
                >
                  ล้าง
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setViewMode('days');
              }}
              className="rounded-lg bg-primary px-3 py-1 font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
