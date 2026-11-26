// components/ActivityCard.tsx
'use client';

import React, { memo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Clock, Users, MapPin, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getDepartmentLabel } from '@/types/admin';
import { cn } from '@/lib/utils';

type ActivityCardProps = {
  id: string;
  activityCode: string;
  activityName: string;
  location?: string;
  startDateTime?: any;
  endDateTime?: any;
  maxParticipants?: number;
  currentParticipants?: number;
  bannerUrl?: string;
  bannerColor?: string;
  status: { key: string; label: string; tone: string };
  canOpen: boolean;
  bannerAspect?: string;
  department?: string;
  priority?: boolean;
};

const toDate = (d: any): Date | null => {
  if (!d) return null;
  const dd: Date = d?.toDate?.() ?? (d instanceof Date ? d : new Date(d));
  return Number.isNaN(dd.getTime()) ? null : dd;
};

// สร้าง formatter ครั้งเดียว (Intl ถูกกว่า toLocaleString ที่สร้างใหม่ทุกครั้ง)
const dateTimeFmt = new Intl.DateTimeFormat('th-TH', {
  year: '2-digit',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const dayFmt = new Intl.DateTimeFormat('th-TH', { day: 'numeric' });
const monthFmt = new Intl.DateTimeFormat('th-TH', { month: 'short' });

const formatDateTime = (d: Date | null) => (d ? dateTimeFmt.format(d) : '-');

const statusBadgeVariant = (key: string) => {
  switch (key) {
    case 'active':
      return 'success' as const;
    case 'upcoming':
      return 'info' as const;
    case 'full':
      return 'warning' as const;
    case 'ended':
      return 'destructive' as const;
    default:
      return 'secondary' as const;
  }
};

/** พื้นหลังกราฟิกเมื่อไม่มีรูปแบนเนอร์ */
function BannerFallback({ color }: { color?: string }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        background: color
          ? `linear-gradient(135deg, ${color} 0%, color-mix(in srgb, ${color} 55%, #050914) 100%)`
          : 'linear-gradient(135deg, var(--brand-1) 0%, var(--brand-2) 60%, var(--brand-3) 100%)',
      }}
    >
      <div className="absolute inset-0 bg-dots text-white opacity-40" />
      <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full border border-white/25 transition-transform duration-700 group-hover:scale-125" />
      <div className="absolute -bottom-12 -left-6 h-32 w-32 rounded-full bg-white/10 transition-transform duration-700 group-hover:translate-x-4" />
      <div className="absolute inset-0 flex items-center justify-center">
        <FlaskConical className="h-14 w-14 text-white/70 transition-transform duration-700 group-hover:-rotate-12 group-hover:scale-110" />
      </div>
    </div>
  );
}

const ActivityCard: React.FC<ActivityCardProps> = ({
  activityCode,
  activityName,
  location,
  startDateTime,
  endDateTime,
  maxParticipants,
  currentParticipants,
  bannerUrl,
  bannerColor,
  status,
  canOpen,
  bannerAspect = 'cover',
  department,
  priority = false,
}) => {
  const [imageLoaded, setImageLoaded] = useState(priority);
  const [imageError, setImageError] = useState(false);

  const start = toDate(startDateTime);
  const end = toDate(endDateTime);

  const cur = currentParticipants || 0;
  const max = maxParticipants || 0;
  const hasCapacity = max > 0;
  const percent = hasCapacity ? Math.min(100, Math.round((cur / max) * 100)) : 0;
  const isActive = status.key === 'active';
  const showDept =
    department && !['all', 'ทุกสังกัด', 'ไม่ระบุ'].includes(department.trim().toLowerCase());

  const href = `/register?activity=${encodeURIComponent(activityCode)}`;

  return (
    <Card
      className={cn(
        'card-lift group relative flex h-full flex-col overflow-hidden rounded-[28px] border-[var(--page-border)] bg-[var(--page-card-solid)] shadow-[var(--page-shadow)]',
        !canOpen && 'opacity-[0.92]'
      )}
    >
      {/* Banner Section */}
      <div className="relative h-[150px] overflow-hidden md:h-[168px]">
        {bannerUrl && !imageError ? (
          <>
            <div
              className="absolute inset-0"
              style={{ backgroundColor: bannerColor || 'hsl(var(--muted))' }}
            />
            <div
              className={cn(
                'absolute inset-0 transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.08]',
                imageLoaded ? 'opacity-100' : 'opacity-0'
              )}
            >
              <Image
                src={bannerUrl}
                alt={activityName}
                fill
                priority={priority}
                fetchPriority={priority ? 'high' : 'auto'}
                unoptimized={bannerUrl.startsWith('data:')}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
                style={{ objectFit: bannerAspect as any }}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
            </div>
            {!imageLoaded && <Skeleton className="absolute inset-0 h-full w-full rounded-none" />}
          </>
        ) : (
          <BannerFallback color={bannerColor} />
        )}

        {/* Overlay gradients */}
        <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-black/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent" />

        <Badge
          variant={statusBadgeVariant(status.key)}
          className="absolute left-4 top-4 gap-1.5 border border-white/25 bg-white/90 px-3 py-1 text-xs font-extrabold shadow-lg backdrop-blur-md dark:bg-slate-950/80"
        >
          {isActive && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-70" />
              <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          )}
          {status.label}
        </Badge>

        {showDept && (
          <Badge
            variant="secondary"
            className="absolute right-4 top-4 max-w-[45%] truncate border-0 bg-white/85 px-2.5 py-0.5 text-[0.7rem] font-bold text-slate-800 shadow-md backdrop-blur-sm"
          >
            {getDepartmentLabel(department!)}
          </Badge>
        )}

        {/* วันที่แบบปฏิทินเล็ก */}
        {start && (
          <div className="absolute bottom-3 left-4 flex items-center gap-2 text-white">
            <div className="flex h-12 w-11 flex-col items-center justify-center overflow-hidden rounded-xl bg-white text-slate-900 shadow-lg transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-[-4deg]">
              <span className="w-full bg-brand-gradient py-0.5 text-center text-[0.55rem] font-bold uppercase leading-none text-white">
                {monthFmt.format(start)}
              </span>
              <span className="text-lg font-black leading-tight">{dayFmt.format(start)}</span>
            </div>
            <span className="text-xs font-semibold text-white/90 drop-shadow">{activityCode}</span>
          </div>
        )}
      </div>

      {/* Content Section */}
      <CardContent className="flex flex-grow flex-col p-4 md:p-5">
        <h3 className="mb-1.5 min-h-[2.6em] line-clamp-2 text-[1.05rem] font-extrabold leading-snug text-[var(--page-text)] transition-colors duration-300 group-hover:text-primary md:text-[1.12rem]">
          {activityName}
        </h3>

        {location && (
          <div className="mb-3 flex items-center gap-2 text-[var(--page-text-secondary)]">
            <MapPin className="h-4 w-4 shrink-0 text-primary/70" />
            <span className="truncate text-[0.85rem] font-semibold">{location}</span>
          </div>
        )}

        <div className="mb-5 space-y-3 rounded-2xl border border-[var(--page-border)] bg-[var(--page-bg)] p-3">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clock className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[0.82rem] font-semibold text-[var(--page-text)]">
                เริ่ม {formatDateTime(start)}
              </p>
              <p className="text-[0.8rem] font-medium text-[var(--page-text-secondary)]">
                จบ {formatDateTime(end)}
              </p>
            </div>
          </div>

          {hasCapacity && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Users className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-bold">ผู้สมัคร</span>
                </div>
                <span
                  className={cn(
                    'rounded-lg px-2 py-0.5 text-xs font-extrabold tabular-nums',
                    percent >= 90 ? 'bg-rose-500/10 text-rose-600' : 'bg-muted text-foreground'
                  )}
                >
                  {cur.toLocaleString()} / {max.toLocaleString()}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full origin-left animate-grow-x rounded-full',
                    percent >= 90
                      ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                      : 'bg-gradient-to-r from-[var(--brand-1)] via-[var(--brand-2)] to-[var(--brand-3)]'
                  )}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex-grow" />

        {canOpen ? (
          <Button
            asChild
            className="shine h-12 w-full rounded-xl bg-brand-gradient text-[0.95rem] font-bold text-white shadow-[0_10px_22px_-10px_rgba(10,107,207,0.7)] hover:bg-transparent hover:shadow-[0_14px_28px_-10px_rgba(6,182,212,0.7)]"
          >
            <Link href={href} prefetch={false}>
              ลงทะเบียนเข้าร่วม
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </Button>
        ) : (
          <Button
            asChild
            variant="outline"
            className="h-12 w-full rounded-xl border-[var(--page-border)] text-[0.95rem] font-bold"
          >
            <Link href={href} prefetch={false}>
              ดูรายละเอียด
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

/** memo: การ์ดไม่ re-render เมื่อพิมพ์ค้นหาแล้วผลลัพธ์เดิมยังอยู่ */
const sameProps = (a: ActivityCardProps, b: ActivityCardProps) => {
  for (const k of Object.keys(b) as (keyof ActivityCardProps)[]) {
    if (k === "status") {
      if (a.status.key !== b.status.key || a.status.label !== b.status.label) return false;
    } else if (a[k] !== b[k]) {
      return false;
    }
  }
  return Object.keys(a).length === Object.keys(b).length;
};

export default memo(ActivityCard, sameProps);
