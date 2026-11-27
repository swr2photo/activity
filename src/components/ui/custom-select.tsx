'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useId, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface CustomSelectOption {
  value: string;
  label: string;
  badge?: string;
  badgeColor?: string;
  icon?: React.ReactNode;
  description?: string;
  disabled?: boolean;
}

export interface CustomSelectGroup {
  group: string;
  items: CustomSelectOption[];
}

export type CustomSelectItem = CustomSelectOption | CustomSelectGroup;

export function isGroup(item: CustomSelectItem): item is CustomSelectGroup {
  return 'group' in item && Array.isArray((item as CustomSelectGroup).items);
}

export interface CustomSelectProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectItem[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  menuClassName?: string;
  size?: 'xs' | 'sm' | 'default';
  searchable?: boolean;
  searchPlaceholder?: string;
  'aria-label'?: string;
  align?: 'left' | 'right' | 'full';
  /** ปิด portal เมื่อใช้งานภายใน Radix Dialog เพื่อไม่ให้ RemoveScroll บล็อกการเลื่อน */
  portal?: boolean;
  renderOption?: (option: CustomSelectOption, isSelected: boolean) => React.ReactNode;
}

export function CustomSelect({
  id,
  name,
  value,
  onChange,
  options,
  placeholder = 'เลือก...',
  disabled = false,
  className = '',
  menuClassName = '',
  size = 'default',
  searchable,
  searchPlaceholder = 'ค้นหา...',
  'aria-label': ariaLabel,
  align = 'full',
  portal = true,
  renderOption,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const generatedId = useId();
  const selectId = id || generatedId;

  const allFlatOptions = useMemo(() => {
    const list: CustomSelectOption[] = [];
    for (const item of options) {
      if (isGroup(item)) list.push(...item.items);
      else list.push(item);
    }
    return list;
  }, [options]);

  const isSearchActive = searchable ?? allFlatOptions.length > 7;

  const selectedOption = useMemo(() => {
    return allFlatOptions.find((o) => o.value === value);
  }, [allFlatOptions, value]);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;

    const result: CustomSelectItem[] = [];
    for (const item of options) {
      if (isGroup(item)) {
        const matchingItems = item.items.filter(
          (o) =>
            o.label.toLowerCase().includes(q) ||
            o.value.toLowerCase().includes(q) ||
            (o.description && o.description.toLowerCase().includes(q))
        );
        if (matchingItems.length > 0) {
          result.push({ group: item.group, items: matchingItems });
        }
      } else if (
        item.label.toLowerCase().includes(q) ||
        item.value.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
      ) {
        result.push(item);
      }
    }
    return result;
  }, [options, search]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    if (!portal) {
      const trigger = containerRef.current;
      if (trigger) {
        const rect = trigger.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        setOpenUpward(spaceBelow < 220 && spaceAbove > spaceBelow);
      }
      return;
    }
    const place = () => {
      const trigger = containerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const upward = spaceBelow < 220 && spaceAbove > spaceBelow;
      const width = Math.min(Math.max(rect.width, 280), window.innerWidth - 16);
      const preferredLeft = align === 'right' ? rect.right - width : rect.left;
      const left = Math.min(Math.max(8, preferredLeft), window.innerWidth - width - 8);
      setOpenUpward(upward);
      setMenuStyle({
        position: 'fixed',
        left,
        width,
        zIndex: 200,
        maxHeight: Math.max(160, Math.min(340, (upward ? spaceAbove : spaceBelow) - 12)),
        ...(upward
          ? { bottom: window.innerHeight - rect.top + 6 }
          : { top: rect.bottom + 6 }),
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [isOpen, align, portal]);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      return;
    }
    if (!isSearchActive) return;
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 40);
    return () => clearTimeout(timer);
  }, [isOpen, isSearchActive]);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: PointerEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setIsOpen(false);
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

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearch('');
  };

  const sizeStyles = {
    xs: 'h-7 text-xs px-2.5 py-0.5 rounded-lg gap-1.5',
    sm: 'h-9 text-xs sm:text-sm px-3 py-1.5 rounded-xl gap-2',
    default: 'h-10 text-sm px-3.5 py-2 rounded-xl gap-2',
  }[size];

  const menuContent = (
    <div
      ref={menuRef}
      data-custom-select-menu="true"
      role="listbox"
      tabIndex={-1}
      className={`pointer-events-auto rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl overflow-hidden flex flex-col animate-in fade-in-0 zoom-in-95 ${
        portal
          ? openUpward
            ? 'origin-bottom'
            : 'origin-top'
          : `absolute left-0 right-0 z-[70] max-h-72 min-w-[240px] ${
              openUpward ? 'bottom-[calc(100%+6px)] origin-bottom' : 'top-[calc(100%+6px)] origin-top'
            }`
      } ${menuClassName}`}
      style={portal ? menuStyle : undefined}
    >
      {isSearchActive && (
        <div className="p-2 border-b border-border bg-muted/40">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-input bg-background pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              onClick={(e) => e.stopPropagation()}
            />
            {search && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearch('');
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2 text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-y-auto overscroll-contain p-1.5 space-y-0.5 divide-y divide-border/50">
        {filteredOptions.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            ไม่พบตัวเลือกที่ค้นหา
          </div>
        ) : (
          filteredOptions.map((item, idx) => {
            if (isGroup(item)) {
              return (
                <div key={`group-${idx}`} className="pt-1.5 first:pt-0">
                  <div className="flex items-start justify-between gap-2 rounded-lg bg-muted/70 px-2.5 py-1.5 text-xs font-semibold text-foreground/80">
                    <span className="whitespace-normal leading-5">{item.group}</span>
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {item.items.length}
                    </span>
                  </div>
                  <div className="space-y-0.5 mt-0.5">
                    {item.items.map((opt) => renderOptionItem(opt))}
                  </div>
                </div>
              );
            }
            return (
              <div key={item.value} className="pt-0.5 first:pt-0">
                {renderOptionItem(item)}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  function renderOptionItem(opt: CustomSelectOption) {
    const isSelected = opt.value === value;
    return (
      <button
        key={opt.value}
        type="button"
        role="option"
        aria-selected={isSelected}
        disabled={opt.disabled}
        onClick={() => !opt.disabled && handleSelect(opt.value)}
        className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 text-left rounded-xl transition-colors cursor-pointer text-xs sm:text-sm ${
          opt.disabled
            ? 'opacity-40 cursor-not-allowed'
            : isSelected
              ? 'bg-primary/10 text-primary font-semibold'
              : 'text-foreground hover:bg-muted'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 truncate">
          {opt.icon && (
            <span className={`shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
              {opt.icon}
            </span>
          )}
          <div className="min-w-0 truncate">
            {renderOption ? (
              renderOption(opt, isSelected)
            ) : (
              <div className="truncate font-medium">{opt.label}</div>
            )}
            {opt.description && (
              <div className="text-[11px] text-muted-foreground truncate font-normal">
                {opt.description}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {opt.badge && (
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                opt.badgeColor || 'bg-muted text-muted-foreground border border-border'
              }`}
            >
              {opt.badge}
            </span>
          )}
          {isSelected && <Check className="size-4 text-primary shrink-0 stroke-[2.5]" />}
        </div>
      </button>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative inline-block w-full min-w-0 ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      <select
        id={selectId}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel}
        tabIndex={-1}
        className="sr-only pointer-events-none"
        aria-hidden="true"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((item, idx) => {
          if (isGroup(item)) {
            return (
              <optgroup key={`g-${idx}`} label={item.group}>
                {item.items.map((sub) => (
                  <option key={sub.value} value={sub.value} disabled={sub.disabled}>
                    {sub.label}
                  </option>
                ))}
              </optgroup>
            );
          }
          return (
            <option key={item.value} value={item.value} disabled={item.disabled}>
              {item.label}
            </option>
          );
        })}
      </select>

      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
        className={`w-full min-w-0 flex items-center justify-between border border-input bg-background text-left font-medium transition-all shadow-xs hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary cursor-pointer ${sizeStyles} ${className}`}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          {selectedOption?.icon && (
            <span className="shrink-0 text-muted-foreground">{selectedOption.icon}</span>
          )}
          {selectedOption ? (
            <span className="truncate text-foreground font-medium">{selectedOption.label}</span>
          ) : (
            <span className="truncate text-muted-foreground">{placeholder}</span>
          )}
          {selectedOption?.badge && (
            <span
              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                selectedOption.badgeColor || 'bg-primary/10 text-primary border border-primary/20'
              }`}
            >
              {selectedOption.badge}
            </span>
          )}
        </div>

        <ChevronDown
          className={`shrink-0 size-4 text-muted-foreground transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-primary' : ''
          }`}
        />
      </button>

      {isOpen && (portal && typeof document !== 'undefined' ? createPortal(menuContent, document.body) : menuContent)}
    </div>
  );
}
