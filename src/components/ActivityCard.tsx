// components/ActivityCard.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Clock, Users, MapPin, QrCode } from 'lucide-react';
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
};

const formatDateTime = (d: any) => {
  if (!d) return '-';
  const dd: Date = d?.toDate?.() ?? (d instanceof Date ? d : new Date(d));
  return dd.toLocaleString('th-TH', {
    year: '2-digit',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

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
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  const startText = formatDateTime(startDateTime);
  const endText = formatDateTime(endDateTime);

  const cur = currentParticipants || 0;
  const max = maxParticipants || 0;
  const hasCapacity = max > 0;
  const percent = hasCapacity ? Math.min(100, Math.round((cur / max) * 100)) : 0;

  return (
    <Card
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-[28px] border-[var(--page-border)] bg-[var(--page-card-solid)] shadow-none transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
        'before:pointer-events-none before:absolute before:inset-0 before:rounded-[28px] before:p-[2px]',
        'before:bg-gradient-to-br before:from-white/12 before:to-transparent',
        'hover:-translate-y-2 hover:scale-[1.02] hover:border-[rgba(0,113,227,0.35)] hover:shadow-[var(--page-shadow)]'
      )}
    >
      {/* Banner Section */}
      <div
        className="relative h-[140px] overflow-hidden md:h-[160px]"
        style={{ backgroundColor: bannerColor || 'hsl(var(--muted))' }}
      >
        {bannerUrl ? (
          <>
            <div
              className={cn(
                'absolute inset-0 transition-[transform,opacity] duration-700 ease-out group-hover:scale-110',
                imageLoaded ? 'opacity-100' : 'opacity-0'
              )}
            >
              <Image
                src={bannerUrl}
                alt={activityName}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                style={{ objectFit: bannerAspect as any }}
                onLoad={() => setImageLoaded(true)}
              />
            </div>
            {!imageLoaded && (
              <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center opacity-20 transition-all duration-700 group-hover:scale-110 group-hover:opacity-40">
            <QrCode className="h-20 w-20" />
          </div>
        )}

        {/* Overlay Gradient */}
        <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-black/40 to-transparent" />

        <Badge
          variant={statusBadgeVariant(status.key)}
          className="absolute left-4 top-4 border border-white/20 px-3 py-1 text-xs font-extrabold shadow-lg backdrop-blur-md"
        >
          {status.label}
        </Badge>

        {department && (
          <Badge
            variant="secondary"
            className="absolute right-4 top-4 border-0 bg-white/85 px-2 py-0.5 text-[0.7rem] font-bold text-foreground shadow-md backdrop-blur-sm"
          >
            {getDepartmentLabel(department)}
          </Badge>
        )}
      </div>

      {/* Content Section */}
      <CardContent className="flex flex-grow flex-col p-4 md:p-5">
        <h3 className="mb-1 min-h-[2.6em] line-clamp-2 text-[1.05rem] font-extrabold leading-snug text-[var(--page-text)] md:text-[1.15rem]">
          {activityName}
        </h3>

        {location && (
          <div className="mb-3 flex items-center gap-2 text-[var(--page-text-secondary)]">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate text-[0.85rem] font-semibold">{location}</span>
          </div>
        )}

        <div className="mb-5 space-y-3 rounded-xl border border-[var(--page-border)] bg-[var(--page-bg)] p-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-bold">กำหนดการ</span>
            </div>
            <div className="pl-6">
              <p className="text-[0.85rem] font-semibold text-[var(--page-text)]">
                เริ่ม: {startText}
              </p>
              <p className="text-[0.85rem] font-medium text-[var(--page-text-secondary)]">
                จบ: {endText}
              </p>
            </div>
          </div>

          {hasCapacity && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span className="text-xs font-bold">จำนวนที่รับสมัคร</span>
                </div>
                <span
                  className={cn(
                    'rounded-lg px-2 py-0.5 text-xs font-extrabold',
                    percent >= 90
                      ? 'bg-red-500/10 text-red-600'
                      : 'bg-muted text-foreground'
                  )}
                >
                  {cur} / {max}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#0071e3] to-[#34c759] transition-all"
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
            className="w-full rounded-xl bg-[#0071e3] py-5 text-[0.95rem] font-bold text-white shadow-[0_8px_16px_rgba(0,113,227,0.25)] transition-all hover:bg-[#0077ed] hover:shadow-[0_12px_24px_rgba(0,113,227,0.35)] hover:-translate-y-0.5"
          >
            <Link href={`/register?activity=${encodeURIComponent(activityCode)}`}>
              ลงทะเบียนเข้าร่วม
            </Link>
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled
            className="w-full rounded-xl border-[var(--page-border)] py-5 text-[0.95rem] font-bold"
          >
            {status.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityCard;
