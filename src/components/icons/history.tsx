/**
 * ไอคอนหน้าประวัติการลงทะเบียน (`/my-history`)
 *
 * เปิดไฟล์นี้เพื่อเปลี่ยนดีไซน์ทั้งหน้า — ไม่ต้องไล่ใน page.tsx
 *
 *   import { HistoryIcon } from '@/components/icons/history'
 *   <HistoryIcon.Registered />
 *   <HistoryIcon.Docs />
 */
"use client";

import type { ComponentPropsWithoutRef } from "react";
import {
  Search,
  ArrowLeft,
  X,
  CalendarDays,
  CalendarCheck2,
  Clock3,
  MapPinned,
  GraduationCap,
  BadgeCheck,
  FileStack,
  ClipboardPenLine,
  ClipboardCheck,
  SquareArrowOutUpRight,
  ChevronUp,
  History,
  Info,
  LogIn,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_SIZE, type IconSize } from "./AppIcon";

type GlyphProps = {
  size?: IconSize;
  className?: string;
  strokeWidth?: number;
};

function Glyph({
  icon: Icon,
  size = "md",
  className,
  strokeWidth = 2.25,
}: GlyphProps & { icon: LucideIcon }) {
  return (
    <Icon
      aria-hidden
      strokeWidth={strokeWidth}
      className={cn("shrink-0", ICON_SIZE[size], className)}
    />
  );
}

/** วงไอคอนสีอ่อน — ใช้กับ meta แถวเวลา/สถานที่/สังกัด */
function SoftWell({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"span">) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-[18px] w-[18px] items-center justify-center rounded-md",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export const HistoryIcon = {
  Search: ({ className, size = "xl" }: GlyphProps) => (
    <Glyph icon={Search} size={size} className={className} strokeWidth={2} />
  ),

  Back: ({ className, size = "lg" }: GlyphProps) => (
    <Glyph icon={ArrowLeft} size={size} className={className} />
  ),

  Clear: ({ className, size = "lg" }: GlyphProps) => (
    <Glyph icon={X} size={size} className={className} />
  ),

  DayGroup: ({ className }: GlyphProps) => (
    <SoftWell className="bg-[rgba(10,107,207,0.1)] text-[#0a6bcf]">
      <Glyph icon={CalendarDays} size="sm" className={className} strokeWidth={2.4} />
    </SoftWell>
  ),

  ActivityThumb: ({ className, size = "2xl" }: GlyphProps) => (
    <Glyph
      icon={CalendarCheck2}
      size={size}
      className={cn("text-white drop-shadow-sm", className)}
      strokeWidth={2}
    />
  ),

  Time: ({ className }: GlyphProps) => (
    <SoftWell className="bg-[rgba(100,116,139,0.12)] text-slate-500 dark:text-slate-400">
      <Glyph icon={Clock3} size="xs" className={className} strokeWidth={2.5} />
    </SoftWell>
  ),

  Location: ({ className }: GlyphProps) => (
    <SoftWell className="bg-[rgba(234,88,12,0.12)] text-orange-600 dark:text-orange-400">
      <Glyph icon={MapPinned} size="xs" className={className} strokeWidth={2.5} />
    </SoftWell>
  ),

  Affiliation: ({ className }: GlyphProps) => (
    <SoftWell className="bg-[rgba(79,70,229,0.12)] text-indigo-600 dark:text-indigo-400">
      <Glyph icon={GraduationCap} size="xs" className={className} strokeWidth={2.5} />
    </SoftWell>
  ),

  /** เขียว — ลงทะเบียนแล้ว */
  Registered: ({ className, size = "md" }: GlyphProps) => (
    <Glyph
      icon={BadgeCheck}
      size={size}
      className={cn("text-[#1a7a45]", className)}
      strokeWidth={2.4}
    />
  ),

  /** ฟ้า — เอกสาร */
  Docs: ({ className, size = "md" }: GlyphProps) => (
    <Glyph
      icon={FileStack}
      size={size}
      className={cn("text-[#0a6bcf]", className)}
      strokeWidth={2.35}
    />
  ),

  /** เทาเข้ม — ทำแบบประเมินแล้ว */
  SurveyDone: ({ className, size = "md" }: GlyphProps) => (
    <Glyph
      icon={ClipboardCheck}
      size={size}
      className={cn("text-slate-600 dark:text-slate-300", className)}
      strokeWidth={2.35}
    />
  ),

  /** ปุ่มทำแบบประเมิน */
  SurveyAction: ({ className, size = "lg" }: GlyphProps) => (
    <Glyph
      icon={ClipboardPenLine}
      size={size}
      className={className}
      strokeWidth={2.25}
    />
  ),

  /** ปุ่มเปิดไฟล์ */
  OpenFile: ({ className, size = "md" }: GlyphProps) => (
    <Glyph
      icon={SquareArrowOutUpRight}
      size={size}
      className={cn("text-[#0a6bcf]", className)}
      strokeWidth={2.4}
    />
  ),

  /** ซ่อนรายละเอียด = ชี้ขึ้น (หมุนเมื่อพับ) */
  Expand: ({ className, size = "lg" }: GlyphProps) => (
    <Glyph
      icon={ChevronUp}
      size={size}
      className={cn("transition-transform duration-200", className)}
      strokeWidth={2.5}
    />
  ),

  History: ({ className, size = "xl" }: GlyphProps) => (
    <Glyph icon={History} size={size} className={className} strokeWidth={2} />
  ),

  Info: ({ className, size = "lg" }: GlyphProps) => (
    <Glyph icon={Info} size={size} className={className} strokeWidth={1.75} />
  ),

  Login: ({ className, size = "lg" }: GlyphProps) => (
    <Glyph icon={LogIn} size={size} className={className} strokeWidth={2.25} />
  ),
} as const;

export type HistoryIconName = keyof typeof HistoryIcon;
