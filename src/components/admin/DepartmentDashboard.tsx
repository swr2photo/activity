// components/admin/DepartmentDashboard.tsx
'use client';

import React, { useEffect, useState } from 'react';
import {
  CalendarDays,
  TrendingUp,
  Users,
  Activity,
  BarChart3,
  Clock,
  ArrowUpRight,
  Sparkles,
  Plus,
  PieChart,
  RefreshCw,
} from 'lucide-react';
import {
  collection,
  getCountFromServer,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';

import { AdminProfile, DEPARTMENT_LABELS, type AdminDepartment } from '../../types/admin';
import {
  getActivitiesByDepartment,
  type Activity as ActivityType,
} from '../../lib/adminFirebase';
import { adminDb as db } from '../../lib/firebaseAdminClient';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import CountUp from '@/components/graphics/CountUp';
import AuroraBackground from '@/components/graphics/AuroraBackground';
import ScienceOrbit from '@/components/graphics/ScienceOrbit';
import EmptyIllustration from '@/components/graphics/EmptyIllustration';
import { cn } from '@/lib/utils';

interface DepartmentDashboardProps {
  currentAdmin: AdminProfile;
  onNavigate?: (section: string) => void;
}

interface DashboardData {
  totalActivities: number;
  activeActivities: number;
  totalUsers: number;
  todayRegistrations: number;
  totalParticipants: number;
  recentActivities: ActivityType[];
  topActivities: (ActivityType & { participantCount: number })[];
}

/** cache ในหน่วยความจำ — กลับมาที่แดชบอร์ดภายใน 60 วินาทีไม่ต้อง query ซ้ำ */
const CACHE_TTL_MS = 60_000;
const dashboardCache = new Map<string, { at: number; data: DashboardData }>();

/**
 * ใช้ getCountFromServer() + ฟิลด์ currentParticipants บนกิจกรรม
 * แทนการดาวน์โหลด activityRecords และ universityUsers ทั้งฐานข้อมูล
 */
const getDepartmentDashboardData = async (department: AdminDepartment): Promise<DashboardData> => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [activities, usersCountSnap, todayCountSnap] = await Promise.all([
    getActivitiesByDepartment(department),
    getCountFromServer(collection(db, 'universityUsers')).catch(() => null),
    getCountFromServer(
      query(
        collection(db, 'activityRecords'),
        where('timestamp', '>=', Timestamp.fromDate(startOfToday))
      )
    ).catch(() => null),
  ]);

  const totalActivities = activities.length;
  const activeActivities = activities.filter((a) => a.isActive).length;
  const totalUsers = usersCountSnap?.data().count ?? 0;
  const todayRegistrations = todayCountSnap?.data().count ?? 0;
  const totalParticipants = activities.reduce((sum, a) => sum + Number(a.currentParticipants || 0), 0);

  const createdTime = (a: ActivityType) =>
    a.createdAt?.getTime() ?? a.startDateTime?.getTime() ?? a.endDateTime?.getTime() ?? 0;

  const recentActivities = [...activities]
    .sort((a, b) => createdTime(b) - createdTime(a))
    .slice(0, 5);

  const topActivities = activities
    .map((a) => ({ ...a, participantCount: Number(a.currentParticipants || 0) }))
    .sort((a, b) => b.participantCount - a.participantCount)
    .slice(0, 5);

  return {
    totalActivities,
    activeActivities,
    totalUsers,
    todayRegistrations,
    totalParticipants,
    recentActivities,
    topActivities,
  };
};

/** เส้นกราฟประดับในการ์ด KPI (SVG วาดเส้นด้วย stroke-dashoffset) */
function Sparkline({ seed, className }: { seed: number; className?: string }) {
  const pts = Array.from({ length: 8 }, (_, i) => {
    const v = Math.sin(seed * 1.7 + i * 0.9) * 0.5 + Math.cos(seed + i * 1.3) * 0.3;
    return `${(i / 7) * 100},${22 - (v + 0.8) * 11}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className={className} aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        pathLength={400}
        strokeDasharray={400}
        className="animate-draw"
      />
    </svg>
  );
}

function KPICard({
  title,
  value,
  icon: Icon,
  gradient,
  tone,
  index,
  hint,
  onClick,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  gradient: string;
  tone: string;
  index: number;
  hint?: string;
  onClick?: () => void;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={{ '--i': index } as React.CSSProperties}
      className={cn(
        'card-lift group relative h-full w-full overflow-hidden rounded-3xl border border-border bg-card p-5 text-left shadow-sm sm:p-6',
        onClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
    >
      <div className={cn('absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-[0.12] transition-transform duration-700 group-hover:scale-150', gradient)} />
      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="mb-5 flex items-start justify-between">
          <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110', gradient)}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          {onClick && (
            <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-40 transition-[opacity,translate] duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" />
          )}
        </div>
        <div>
          <p className="mb-1 text-4xl font-extrabold tabular-nums tracking-tight text-foreground">
            <CountUp value={value} />
          </p>
          <p className="text-sm font-semibold text-muted-foreground">{title}</p>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground/80">{hint}</p>}
        </div>
        <Sparkline seed={index + 1} className={cn('mt-3 h-8 w-full', tone)} />
      </div>
    </Comp>
  );
}

/** โดนัทสัดส่วนกิจกรรมเปิด/ปิด — SVG ล้วน วาดเข้าด้วยแอนิเมชัน */
function StatusDonut({ active, total }: { active: number; total: number }) {
  const inactive = Math.max(0, total - active);
  const pct = total > 0 ? active / total : 0;
  const R = 52;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center sm:gap-8">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" aria-hidden>
          <defs>
            <linearGradient id="donut-active" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
          <circle cx="70" cy="70" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="16" />
          <circle
            cx="70"
            cy="70"
            r={R}
            fill="none"
            stroke="url(#donut-active)"
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={C}
            style={{ '--draw-length': C, '--draw-to': C * (1 - pct) } as React.CSSProperties}
            strokeDashoffset={C * (1 - pct)}
            className="animate-draw"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold tabular-nums text-foreground">
            <CountUp value={Math.round(pct * 100)} />%
          </span>
          <span className="text-xs font-semibold text-muted-foreground">เปิดรับอยู่</span>
        </div>
      </div>
      <ul className="w-full max-w-[220px] space-y-3 text-sm">
        <li className="flex items-center justify-between gap-3 rounded-xl bg-emerald-500/10 px-3 py-2">
          <span className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
            <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500" />
            เปิดรับ
          </span>
          <span className="font-extrabold tabular-nums">{active.toLocaleString()}</span>
        </li>
        <li className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2">
          <span className="flex items-center gap-2 font-semibold text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
            ปิดแล้ว
          </span>
          <span className="font-extrabold tabular-nums">{inactive.toLocaleString()}</span>
        </li>
      </ul>
    </div>
  );
}

const relativeTime = new Intl.RelativeTimeFormat('th', { numeric: 'auto' });
const formatRelative = (d?: Date) => {
  if (!d) return 'ไม่ระบุ';
  const diffDays = Math.round((d.getTime() - Date.now()) / 86_400_000);
  if (Math.abs(diffDays) < 30) return relativeTime.format(diffDays, 'day');
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
};

export const DepartmentDashboard: React.FC<DepartmentDashboardProps> = ({
  currentAdmin,
  onNavigate,
}) => {
  const cached = dashboardCache.get(currentAdmin.department);
  const [data, setData] = useState<DashboardData | null>(cached?.data ?? null);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const hit = dashboardCache.get(currentAdmin.department);
    if (reloadKey === 0 && hit && Date.now() - hit.at < CACHE_TTL_MS) {
      setData(hit.data);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        if (!hit) setLoading(true);
        else setRefreshing(true);
        setError(null);
        const result = await getDepartmentDashboardData(currentAdmin.department);
        dashboardCache.set(currentAdmin.department, { at: Date.now(), data: result });
        if (!cancelled) setData(result);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'ไม่สามารถดึงข้อมูลแดชบอร์ดได้');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentAdmin.department, reloadKey]);

  if (loading || !data) {
    if (error) {
      return (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      );
    }
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 w-full rounded-[2rem]" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-3xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-3xl" />
          <Skeleton className="h-80 rounded-3xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  const deptLabel = DEPARTMENT_LABELS[currentAdmin.department] ?? currentAdmin.department;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'สวัสดีตอนเช้า' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 overflow-x-clip pb-10 sm:space-y-8">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Hero Header */}
      <div className="relative isolate animate-fade-up overflow-hidden rounded-2xl bg-[#060b17] p-5 text-white shadow-xl sm:rounded-[2rem] sm:p-8">
        <AuroraBackground variant="hero" />
        <ScienceOrbit
          tone="light"
          className="pointer-events-none absolute -right-8 top-1/2 hidden h-56 w-56 -translate-y-1/2 animate-float opacity-70 md:block"
        />

        <div className="relative z-10 flex min-w-0 flex-col justify-between gap-4 sm:gap-6 md:flex-row md:items-end">
          <div className="min-w-0 space-y-2 md:max-w-[65%]">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 shrink-0 animate-blink text-amber-300" />
              <span className="truncate">
                {greeting}, {currentAdmin.firstName || currentAdmin.displayName}
              </span>
            </div>
            <h1 className="break-words text-2xl font-extrabold tracking-tight sm:text-3xl md:text-4xl">
              แดชบอร์ด <span className="text-gradient-brand animate-gradient-x">{deptLabel}</span>
            </h1>
            <p className="max-w-xl text-sm text-slate-300 sm:text-base">
              จัดการกิจกรรม ตรวจรายชื่อผู้ลงทะเบียน และติดตามสถิติการเข้าร่วมได้จากที่นี่
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2.5 md:mr-40 lg:mr-48">
            <Button
              type="button"
              onClick={() => onNavigate?.('activities')}
              className="shine rounded-xl border-0 bg-white font-bold text-slate-900 hover:bg-white hover:shadow-[0_12px_28px_-10px_rgba(34,211,238,0.6)]"
            >
              <Plus className="mr-1 h-4 w-4" />
              จัดการกิจกรรม
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onNavigate?.('activity-list')}
              className="rounded-xl border border-white/15 bg-white/10 font-semibold text-white backdrop-blur-md hover:bg-white/20"
            >
              <ArrowUpRight className="mr-1 h-4 w-4" />
              ดูผู้ลงทะเบียน
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="รีเฟรชข้อมูล"
              title="รีเฟรชข้อมูล"
              disabled={refreshing}
              onClick={() => setReloadKey((k) => k + 1)}
              className="rounded-xl text-white hover:bg-white/10 hover:text-white"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="stagger grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          index={0}
          title="กิจกรรมทั้งหมด"
          value={data.totalActivities}
          icon={CalendarDays}
          gradient="bg-gradient-to-br from-indigo-500 to-blue-600"
          tone="text-blue-500/60"
          onClick={onNavigate ? () => onNavigate('activities') : undefined}
        />
        <KPICard
          index={1}
          title="กิจกรรมที่เปิดรับอยู่"
          value={data.activeActivities}
          icon={Activity}
          gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          tone="text-emerald-500/60"
          onClick={onNavigate ? () => onNavigate('activities') : undefined}
        />
        <KPICard
          index={2}
          title="บัญชีผู้ใช้ในระบบ"
          value={data.totalUsers}
          icon={Users}
          gradient="bg-gradient-to-br from-violet-500 to-purple-600"
          tone="text-violet-500/60"
          onClick={onNavigate ? () => onNavigate('users') : undefined}
        />
        <KPICard
          index={3}
          title="ลงทะเบียนวันนี้"
          value={data.todayRegistrations}
          icon={TrendingUp}
          gradient="bg-gradient-to-br from-amber-500 to-orange-600"
          tone="text-amber-500/60"
          hint={`รวมผู้เข้าร่วมทุกกิจกรรม ${data.totalParticipants.toLocaleString()} คน`}
          onClick={onNavigate ? () => onNavigate('activity-list') : undefined}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="reveal h-full overflow-hidden rounded-3xl">
          <CardHeader className="px-6 pb-2 pt-5">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <div className="rounded-xl bg-cyan-500/10 p-2 text-cyan-600">
                <PieChart className="h-4 w-4" />
              </div>
              สถานะกิจกรรม
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-4">
            {data.totalActivities === 0 ? (
              <div className="py-6 text-center text-muted-foreground">
                <EmptyIllustration kind="calendar" className="mx-auto h-28 w-40 text-foreground" />
                <p className="mt-2 text-sm">ยังไม่มีกิจกรรม</p>
              </div>
            ) : (
              <StatusDonut active={data.activeActivities} total={data.totalActivities} />
            )}
          </CardContent>
        </Card>

        <Card className="reveal h-full overflow-hidden rounded-3xl lg:col-span-2">
          <CardHeader className="px-6 pb-2 pt-5">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-600">
                <TrendingUp className="h-4 w-4" />
              </div>
              กิจกรรมที่มีผู้เข้าร่วมสูงสุด
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-4 sm:p-6 sm:pt-4">
            {data.topActivities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <BarChart3 className="mb-2 h-10 w-10 opacity-25" />
                <p className="text-sm">ยังไม่มีข้อมูลกิจกรรมยอดนิยม</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.topActivities.map((a, i) => {
                  const maxParticipants = data.topActivities[0].participantCount || 1;
                  const percent = Math.min(100, Math.round((a.participantCount / maxParticipants) * 100));
                  return (
                    <div key={a.id} className="group flex items-center gap-3.5">
                      <div
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black transition-transform duration-300 group-hover:scale-110',
                          i === 0
                            ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-[0_6px_14px_-4px_rgba(245,158,11,0.7)]'
                            : i === 1
                              ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-white'
                              : i === 2
                                ? 'bg-gradient-to-br from-orange-300 to-orange-500 text-white'
                                : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-bold text-foreground">{a.activityName}</p>
                          <p className="shrink-0 text-sm font-extrabold tabular-nums text-foreground">
                            <CountUp value={a.participantCount} />{' '}
                            <span className="text-xs font-medium text-muted-foreground">คน</span>
                          </p>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              'h-full origin-left animate-grow-x rounded-full',
                              i === 0
                                ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                                : 'bg-gradient-to-r from-[var(--brand-1)] via-[var(--brand-2)] to-[var(--brand-3)]'
                            )}
                            style={{ width: `${percent}%`, animationDelay: `${150 + i * 90}ms` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activities */}
      <Card className="reveal h-full overflow-hidden rounded-3xl">
        <CardHeader className="border-b border-border bg-muted/30 px-6 pb-4 pt-5">
          <CardTitle className="flex items-center justify-between text-base font-bold text-foreground">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-blue-500/10 p-2 text-blue-600">
                <Clock className="h-4 w-4" />
              </div>
              กิจกรรมล่าสุด
            </div>
            {onNavigate && (
              <Button variant="ghost" size="sm" onClick={() => onNavigate('activities')} className="text-xs">
                ดูทั้งหมด
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.recentActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <EmptyIllustration kind="inbox" className="h-28 w-40 text-foreground" />
              <p className="mt-2 text-sm">ยังไม่มีกิจกรรมล่าสุด</p>
            </div>
          ) : (
            <div className="stagger divide-y divide-border">
              {data.recentActivities.map((a, i) => (
                <div
                  key={a.id}
                  style={{ '--i': i } as React.CSSProperties}
                  className="group flex items-center gap-3.5 p-4 transition-colors hover:bg-primary/[0.03] sm:px-6"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-sm font-bold text-white shadow-[0_6px_14px_-6px_rgba(10,107,207,0.7)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
                    {(a.activityName || '?').charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground">{a.activityName}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" /> {a.currentParticipants ?? 0} คน
                      <span>•</span>
                      {formatRelative(a.createdAt)}
                    </p>
                  </div>
                  <Badge variant={a.isActive ? 'success' : 'secondary'} className="shrink-0 rounded-full text-[11px]">
                    {a.isActive && <span className="h-1.5 w-1.5 animate-blink rounded-full bg-emerald-500" />}
                    {a.isActive ? 'เปิดรับ' : 'ปิดแล้ว'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DepartmentDashboard;
