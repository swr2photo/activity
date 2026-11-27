'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronDown, Info, RotateCcw, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';
import { MonthPicker } from '@/components/ui/month-picker';
import { YearPicker } from '@/components/ui/year-picker';
import {
  getChoiceOptions,
  getLikertConfig,
  getLikertOptions,
  isSurveyAnswered,
  normalizeQuestionType,
  type SurveyAnswerValue,
  type SurveyQuestion,
} from '@/lib/surveyModel';

function sortOptions<T extends { value: string; label: string }>(options: T[]): T[] {
  const hasNumbers = options.some((o) => /^\s*\d+[.)]/.test(o.label));
  if (!hasNumbers) return options;
  return [...options].sort((a, b) => {
    const aOther = a.value === 'other' || a.label.includes('อื่น');
    const bOther = b.value === 'other' || b.label.includes('อื่น');
    if (aOther && !bOther) return 1;
    if (!aOther && bOther) return -1;
    const numA = a.label.match(/^\s*(\d+)[.)]/);
    const numB = b.label.match(/^\s*(\d+)[.)]/);
    if (numA && numB) return parseInt(numA[1], 10) - parseInt(numB[1], 10);
    if (numA) return -1;
    if (numB) return 1;
    return a.label.localeCompare(b.label, 'th');
  });
}

function formatOptionLabel(label: string): string {
  return label.replace(/^(\d+)[.)]\s*/, '$1. ');
}

function SearchableOptionSelect({
  id,
  options,
  value,
  onChange,
  isMissing = false,
  disabled = false,
}: {
  id: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  isMissing?: boolean;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const query = search.trim().toLocaleLowerCase('th');
  const defaultOption = { value: '', label: 'ยังไม่เลือก (ล้างคำตอบ)' };
  const allOptions = [defaultOption, ...options];
  const filtered = allOptions.filter((option) =>
    option.value === ''
      ? !query || option.label.toLocaleLowerCase('th').includes(query)
      : `${option.label} ${option.value}`.toLocaleLowerCase('th').includes(query)
  );
  const selected = options.find((option) => option.value === value);
  const isUnselected = !value || value === '';

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => searchInputRef.current?.focus(), 40);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative space-y-2 ${isOpen ? 'z-30' : 'z-10'}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={`${id}-options`}
        aria-label="เลือกคำตอบ"
        onClick={() => {
          if (!disabled) {
            setSearch('');
            setIsOpen((prev) => !prev);
          }
        }}
        className={`group flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl border bg-background px-3.5 py-2.5 text-left text-sm transition-all shadow-xs ${
          isMissing
            ? 'border-2 border-destructive bg-destructive/5 ring-2 ring-destructive/20'
            : isOpen
              ? 'border-2 border-primary bg-primary/5 ring-2 ring-primary/20'
              : 'border-primary/25 hover:border-primary hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary/20'
        } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`flex size-6 shrink-0 items-center justify-center rounded-lg text-xs transition-colors ${
              selected ? 'bg-primary/10 text-primary font-semibold' : 'bg-muted text-muted-foreground'
            }`}
          >
            {selected ? <Check className="size-3.5" /> : <Search className="size-3" />}
          </span>
          <span className={`truncate ${selected ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
            {selected ? formatOptionLabel(selected.label) : 'ยังไม่เลือก (แตะเพื่อเปิดแผงตัวเลือก)'}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {selected && !disabled && (
            <span
              role="button"
              tabIndex={0}
              title="ล้างคำตอบ"
              aria-label="ล้างคำตอบ"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setIsOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  onChange('');
                  setIsOpen(false);
                }
              }}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
            >
              <X className="size-3.5" />
            </span>
          )}
          <span
            className={`flex size-6 items-center justify-center rounded-md text-muted-foreground transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-primary' : 'group-hover:text-foreground'
            }`}
          >
            <ChevronDown className="size-4" />
          </span>
        </div>
      </button>

      <div className="flex items-center justify-between px-1 text-xs">
        <p className={isMissing ? 'font-semibold text-destructive' : 'text-muted-foreground'}>
          {selected
            ? `เลือกแล้ว: ${formatOptionLabel(selected.label)}`
            : isMissing
              ? 'กรุณาแตะเลือกตัวเลือกสำหรับข้อนี้'
              : 'แตะที่แถบด้านบนเพื่อเปิดแผงเลือกคำตอบ'}
        </p>
        {selected && <span className="text-[11px] text-primary font-medium">บันทึกคำตอบแล้ว</span>}
      </div>

      {isOpen && (
        <div
          id={`${id}-panel`}
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-[60] rounded-2xl border border-primary/20 bg-popover p-3 text-popover-foreground shadow-xl ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 duration-150 space-y-2.5"
        >
          <div className="space-y-1.5 border-b border-border/70 pb-2.5">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                ref={searchInputRef}
                type="text"
                role="searchbox"
                aria-label="ค้นหาตัวเลือก"
                placeholder="พิมพ์เพื่อค้นหาตัวเลือก..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 rounded-xl bg-muted/40 pl-9 pr-8 text-sm border-border/80 focus:bg-background"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="ล้างคำค้นหา"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground font-medium">
              <span>แผงเลือกตัวเลือก</span>
              <span>
                พบ {filtered.length} จาก {allOptions.length} รายการ
              </span>
            </div>
          </div>

          <div
            id={`${id}-options`}
            role="listbox"
            aria-label="รายการตัวเลือก"
            className="max-h-60 sm:max-h-72 overflow-y-auto overscroll-contain pr-1 space-y-1"
          >
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <p>ไม่พบตัวเลือกที่ตรงกับ &ldquo;{search}&rdquo;</p>
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="mt-2 text-xs font-semibold text-primary underline underline-offset-2"
                >
                  ล้างคำค้นหา
                </button>
              </div>
            ) : (
              filtered.map((option) => {
                const isDefault = option.value === '';
                const isOptionSelected = isDefault ? isUnselected : option.value === value;
                return (
                  <button
                    key={option.value || '__unselected__'}
                    type="button"
                    role="option"
                    aria-selected={isOptionSelected}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                      setSearch('');
                      triggerRef.current?.focus();
                    }}
                    className={`flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-left text-sm transition-all cursor-pointer ${
                      isOptionSelected
                        ? isDefault
                          ? 'border border-border/80 bg-muted font-medium text-foreground'
                          : 'bg-primary font-medium text-primary-foreground shadow-xs'
                        : isDefault
                          ? 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                          : 'text-foreground hover:bg-primary/10 hover:text-primary'
                    }`}
                  >
                    <span className={isDefault ? 'text-muted-foreground font-normal text-xs' : 'leading-snug'}>
                      {isDefault ? option.label : formatOptionLabel(option.label)}
                    </span>
                    {isOptionSelected && (
                      <Check
                        className={`size-4 shrink-0 ${
                          isDefault ? 'text-muted-foreground' : 'text-primary-foreground'
                        }`}
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border/70 pt-2 text-xs">
            <span className="text-[11px] text-muted-foreground truncate">
              {selected ? `เลือก: ${formatOptionLabel(selected.label)}` : 'ยังไม่ได้เลือก'}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
            >
              ปิดแผง
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SurveyFields({
  questions,
  sectionLabel,
  answers,
  otherAnswers,
  onChange,
  onOtherChange,
  disabled = false,
  missingIds = [],
  startIndex = 0,
}: {
  questions: SurveyQuestion[];
  sectionLabel?: string;
  answers: Record<string, SurveyAnswerValue>;
  otherAnswers: Record<string, string>;
  onChange: (id: string, value: SurveyAnswerValue | undefined) => void;
  onOtherChange: (id: string, other: string) => void;
  disabled?: boolean;
  missingIds?: string[];
  startIndex?: number;
}) {
  // แสดงแถบเกณฑ์ระดับคะแนนด้านบน หากส่วนนี้มีคำถามแบบมาตราส่วน (เหมือน D:\01-web)
  const firstLikert = questions.find((q) => normalizeQuestionType(q.type) === 'likert');
  const guideOptions = firstLikert ? getLikertOptions(firstLikert) : [];
  const guideRange =
    guideOptions.length > 0
      ? `${guideOptions[0].value} - ${guideOptions[guideOptions.length - 1].value}`
      : '';

  return (
    <div className="space-y-5">
      {firstLikert && guideOptions.length >= 3 && guideOptions.length <= 7 && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/5 via-card to-card p-4 shadow-[0_4px_0_rgba(15,23,42,0.06)] dark:shadow-[0_4px_0_rgba(0,0,0,0.3)] sm:p-5">
          <div className="mb-3 flex items-center gap-2 border-b border-border/60 pb-3">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Info className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground sm:text-base">
                เกณฑ์ระดับคะแนน ({guideRange})
              </h3>
              <p className="text-xs text-muted-foreground">
                คำชี้แจง: โปรดเลือกระดับคะแนนที่ตรงกับความคิดเห็นของคุณมากที่สุด
              </p>
            </div>
          </div>
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-none sm:grid-flow-col sm:auto-cols-fr"
          >
            {guideOptions.map((opt) => (
              <div
                key={opt.value}
                className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/80 p-2.5 sm:flex-col sm:justify-center sm:text-center"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-sm font-bold text-primary sm:size-9">
                  {opt.value}
                </span>
                <span className="min-w-0 text-xs font-medium leading-tight text-foreground">
                  {opt.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {questions.map((q, i) => {
        const canonical = normalizeQuestionType(q.type);
        const raw = answers[q.id];
        const otherText = otherAnswers[q.id] || '';
        const selected = Array.isArray(raw) ? raw : typeof raw === 'string' && raw ? [raw] : [];
        const answered = isSurveyAnswered(q, raw, otherText);
        const isMissing = Boolean(q.required && missingIds.includes(q.id) && !answered);
        const choiceOptions = sortOptions(getChoiceOptions(q));
        const likertConfig = canonical === 'likert' ? getLikertConfig(q) : null;
        const likertOptions = canonical === 'likert' ? getLikertOptions(q) : [];

        return (
          <fieldset
            key={q.id}
            id={`survey-question-${q.id}`}
            tabIndex={-1}
            disabled={disabled}
            className={`scroll-mt-36 rounded-2xl transition-all duration-200 min-w-0 p-4 sm:p-6 outline-none ${
              isMissing
                ? 'border-2 border-destructive bg-card shadow-[0_5px_0_rgba(239,68,68,0.28)] ring-2 ring-destructive/20'
                : 'border border-border/80 bg-card shadow-[0_5px_0_rgba(15,23,42,0.06)] dark:shadow-[0_5px_0_rgba(0,0,0,0.32)]'
            }`}
          >
            <legend
              className={`px-2 text-xs font-medium ${
                isMissing ? 'text-destructive font-semibold' : 'text-primary'
              }`}
            >
              {sectionLabel ? `${sectionLabel} · ` : ''}ข้อที่ {startIndex + i + 1}
            </legend>

            <div className="mb-4 grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2.5">
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  answered
                    ? 'bg-primary/15 text-primary'
                    : isMissing
                      ? 'bg-destructive text-destructive-foreground shadow-sm ring-2 ring-destructive/40 font-bold'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {answered ? (
                  <Check className="size-4" />
                ) : (
                  String(startIndex + i + 1).padStart(2, '0')
                )}
              </span>

              <label
                htmlFor={`survey-input-${q.id}`}
                className="min-w-0 pt-1 text-sm sm:text-base font-medium leading-relaxed break-words text-foreground"
              >
                {q.question}{' '}
                <span
                  className={`text-xs ${
                    isMissing ? 'font-semibold text-destructive' : 'font-normal text-muted-foreground'
                  }`}
                >
                  {q.required ? '(จำเป็น)' : '(เลือกตอบ)'}
                </span>
              </label>

              {answered ? (
                <div className="col-span-2 flex flex-wrap items-center justify-end gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    <Check className="size-3" />
                    ตอบแล้ว
                  </span>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onChange(q.id, undefined);
                      if (otherText) onOtherChange(q.id, '');
                    }}
                    className="flex items-center gap-1 rounded-full border border-border/80 bg-background px-2.5 py-1 text-xs text-muted-foreground hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive transition-colors shadow-xs cursor-pointer"
                    title="ล้างคำตอบข้อนี้"
                  >
                    <RotateCcw className="size-3" />
                    <span>ล้างคำตอบ</span>
                  </button>
                </div>
              ) : isMissing ? (
                <span className="col-span-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
                  <AlertCircle className="size-3.5" />
                  กรุณาตอบข้อนี้
                </span>
              ) : null}
            </div>

            {/* 1. Number */}
            {canonical === 'number' && (
              <Input
                id={`survey-input-${q.id}`}
                type="number"
                min={q.min}
                max={q.max}
                step={q.step ?? 'any'}
                placeholder="กรอกตัวเลข..."
                className={`max-w-xs rounded-xl ${
                  isMissing ? 'border-2 border-destructive bg-destructive/5' : ''
                }`}
                value={typeof raw === 'string' ? raw : ''}
                onChange={(e) => onChange(q.id, e.target.value === '' ? undefined : e.target.value)}
              />
            )}

            {/* 2. Textarea */}
            {canonical === 'textarea' && (
              <textarea
                id={`survey-input-${q.id}`}
                rows={3}
                placeholder="กรอกข้อความหรือข้อเสนอแนะที่นี่..."
                className={`w-full min-h-24 rounded-xl border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 ${
                  isMissing
                    ? 'border-2 border-destructive bg-destructive/5 focus-visible:ring-destructive/30'
                    : 'border-input focus-visible:ring-primary/30'
                }`}
                value={typeof raw === 'string' ? raw : ''}
                onChange={(e) => onChange(q.id, e.target.value === '' ? undefined : e.target.value)}
              />
            )}

            {/* 3. Date / Time / Month / Year */}
            {canonical === 'date' && (
              <div className="max-w-md">
                <DatePicker
                  id={`survey-input-${q.id}`}
                  ariaLabel={q.question}
                  value={typeof raw === 'string' ? raw : ''}
                  onChange={(val) => onChange(q.id, val === '' ? undefined : val)}
                  disabled={disabled}
                  className={isMissing ? 'border-2 border-destructive bg-destructive/5' : ''}
                />
              </div>
            )}
            {canonical === 'time' && (
              <div className="max-w-md">
                <TimePicker
                  id={`survey-input-${q.id}`}
                  ariaLabel={q.question}
                  value={typeof raw === 'string' ? raw : ''}
                  onChange={(val) => onChange(q.id, val === '' ? undefined : val)}
                  disabled={disabled}
                  className={isMissing ? 'border-2 border-destructive bg-destructive/5' : ''}
                />
              </div>
            )}
            {canonical === 'month' && (
              <div className="max-w-md">
                <MonthPicker
                  id={`survey-input-${q.id}`}
                  ariaLabel={q.question}
                  value={typeof raw === 'string' ? raw : ''}
                  onChange={(val) => onChange(q.id, val === '' ? undefined : val)}
                  disabled={disabled}
                  className={isMissing ? 'border-2 border-destructive bg-destructive/5' : ''}
                />
              </div>
            )}
            {canonical === 'year' && (
              <div className="max-w-md">
                <YearPicker
                  id={`survey-input-${q.id}`}
                  ariaLabel={q.question}
                  value={typeof raw === 'string' ? raw : ''}
                  onChange={(val) => onChange(q.id, val === '' ? undefined : val)}
                  disabled={disabled}
                  className={isMissing ? 'border-2 border-destructive bg-destructive/5' : ''}
                />
              </div>
            )}

            {/* 4. Text / Email / Tel */}
            {(canonical === 'text' || canonical === 'email' || canonical === 'tel') && (
              <div className="space-y-1.5">
                <Input
                  id={`survey-input-${q.id}`}
                  type={canonical === 'tel' ? 'tel' : canonical === 'email' ? 'email' : 'text'}
                  placeholder={
                    canonical === 'email'
                      ? 'เช่น name@psu.ac.th'
                      : canonical === 'tel'
                        ? 'เช่น 081-234-5678'
                        : 'พิมพ์คำตอบของคุณ...'
                  }
                  className={`max-w-md rounded-xl ${
                    isMissing ? 'border-2 border-destructive bg-destructive/5' : ''
                  }`}
                  value={typeof raw === 'string' ? raw : ''}
                  onChange={(e) => onChange(q.id, e.target.value === '' ? undefined : e.target.value)}
                />
                {canonical === 'text' && (q.prefix || q.postfix || (q.validationType && q.validationType !== 'any')) && (
                  <p className="text-[11px] text-muted-foreground">
                    {[
                      q.validationType === 'number' && 'ตัวเลขเท่านั้น',
                      q.validationType === 'thai' && 'ภาษาไทยเท่านั้น',
                      q.validationType === 'english' && 'ภาษาอังกฤษเท่านั้น',
                      q.validationType === 'email' && 'รูปแบบอีเมล',
                      q.prefix && `ขึ้นต้นด้วย "${q.prefix}"`,
                      q.postfix && `ลงท้ายด้วย "${q.postfix}"`,
                      q.allowSpaces === false && 'ห้ามเว้นวรรค',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>
            )}

            {/* 5. Searchable Dropdown */}
            {canonical === 'dropdown' && (
              <SearchableOptionSelect
                id={`survey-input-${q.id}`}
                options={choiceOptions}
                value={typeof raw === 'string' ? raw : ''}
                onChange={(val) => onChange(q.id, val === '' ? undefined : val)}
                isMissing={isMissing}
                disabled={disabled}
              />
            )}

            {/* 6. Likert / Rating (Circle, Star, or Heart with optional connecting bar) */}
            {canonical === 'likert' && likertConfig && (
              <div className="space-y-3.5">
                <div
                  className={`relative grid items-center justify-items-center gap-1.5 py-2 sm:gap-3 ${
                    likertConfig.connect
                      ? 'before:absolute before:left-6 before:right-6 before:top-1/2 before:h-0.5 before:-translate-y-1/2 before:bg-primary/20 sm:before:left-10 sm:before:right-10'
                      : ''
                  }`}
                  style={{
                    gridTemplateColumns: `repeat(${likertOptions.length}, minmax(0, 1fr))`,
                  }}
                >
                  {likertOptions.map((o) => {
                    const isSelected = selected.includes(o.value);
                    const symbol =
                      likertConfig.shape === 'star'
                        ? '★'
                        : likertConfig.shape === 'heart'
                          ? '♥'
                          : null;
                    return (
                      <label
                        key={o.value}
                        htmlFor={`survey-${q.id}-${o.value}`}
                        title={`${o.value}: ${o.label}`}
                        onClick={(e) => {
                          if (isSelected) {
                            e.preventDefault();
                            onChange(q.id, undefined);
                          }
                        }}
                        className={`relative z-10 flex aspect-square w-full max-w-14 cursor-pointer flex-col items-center justify-center rounded-full border-2 transition-all duration-200 select-none ${
                          isSelected
                            ? 'scale-110 border-primary bg-primary text-primary-foreground shadow-md ring-4 ring-primary/20'
                            : 'border-border/80 bg-background text-foreground hover:scale-105 hover:border-primary/50 hover:bg-primary/5 active:scale-95'
                        }`}
                      >
                        <input
                          id={`survey-${q.id}-${o.value}`}
                          type="radio"
                          name={`survey-q-${q.id}`}
                          value={o.value}
                          checked={isSelected}
                          onChange={() => onChange(q.id, o.value)}
                          className="sr-only"
                        />
                        {symbol ? (
                          <>
                            <span aria-hidden className="text-base sm:text-lg leading-none">
                              {symbol}
                            </span>
                            <span className="font-mono text-[10px] font-bold mt-0.5 leading-none">
                              {o.value}
                            </span>
                          </>
                        ) : (
                          <span className="font-mono text-base sm:text-lg font-bold leading-none">
                            {o.value}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>

                <div className="flex min-h-7 justify-center">
                  {answered ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1 text-xs font-medium text-primary animate-in fade-in duration-200">
                      <span className="size-1.5 rounded-full bg-primary" />
                      เลือกระดับ {selected[0]} :{' '}
                      <strong>{likertOptions.find((o) => o.value === selected[0])?.label}</strong>
                    </span>
                  ) : isMissing ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
                      <AlertCircle className="size-3.5" />
                      กรุณาแตะเลือกคะแนน ({likertOptions[0]?.value} - {likertOptions[likertOptions.length - 1]?.value})
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground/70">
                      แตะเลือกคะแนน ({likertOptions[0]?.value} - {likertOptions[likertOptions.length - 1]?.value})
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 7. Single Select / Multiple Select Cards */}
            {(canonical === 'single_select' || canonical === 'multiple_select') && (
              <div id={`survey-input-${q.id}`} className="grid gap-2.5 sm:grid-cols-2">
                {choiceOptions.map((o) => {
                  const isChecked = selected.includes(o.value);
                  return (
                    <label
                      key={o.value}
                      onClick={(e) => {
                        if (canonical !== 'multiple_select' && isChecked) {
                          e.preventDefault();
                          onChange(q.id, undefined);
                        }
                      }}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition-all ${
                        isChecked
                          ? 'border-primary bg-primary/10 font-medium text-foreground shadow-xs'
                          : 'border-border/80 bg-background text-foreground hover:border-primary/40 hover:bg-muted/50'
                      }`}
                    >
                      <input
                        type={canonical === 'multiple_select' ? 'checkbox' : 'radio'}
                        name={`survey-q-${q.id}`}
                        checked={isChecked}
                        onChange={(e) => {
                          if (canonical !== 'multiple_select') {
                            onChange(q.id, o.value);
                            return;
                          }
                          const values = e.target.checked
                            ? o.value === 'none'
                              ? ['none']
                              : [...selected.filter((v) => v !== 'none'), o.value]
                            : selected.filter((v) => v !== o.value);
                          onChange(q.id, values.length > 0 ? values : undefined);
                        }}
                        className="size-4 accent-primary shrink-0"
                      />
                      <span className="leading-snug">{formatOptionLabel(o.label)}</span>
                    </label>
                  );
                })}
                {canonical === 'multiple_select' && (
                  <p className="text-[11px] text-muted-foreground sm:col-span-2">
                    เลือกได้มากกว่า 1 ข้อ
                    {q.exclusiveNone ? ' (หากเลือก “ไม่มี” จะยกเลิกรายการอื่นอัตโนมัติ)' : ''}
                  </p>
                )}
              </div>
            )}

            {/* Other specify input */}
            {selected.includes('other') && (
              <div className="mt-3">
                <Input
                  aria-label={`ระบุเพิ่มเติม: ${q.question}`}
                  placeholder="กรุณาระบุรายละเอียดเพิ่มเติม..."
                  maxLength={300}
                  value={otherText}
                  onChange={(e) => onOtherChange(q.id, e.target.value)}
                  className={`rounded-xl ${
                    isMissing && !otherText.trim()
                      ? 'border-2 border-destructive bg-destructive/5'
                      : ''
                  }`}
                />
              </div>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
