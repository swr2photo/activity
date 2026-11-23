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

interface DepartmentDashboardProps {
  currentAdmin: AdminProfile;
  onNavigate?: (section: string) => void;
}

interface DashboardData {
  totalActivities: number;
  activeActivities: number;
  totalUsers: number;
  todayRegistrations: number;
  recentActivities: ActivityType[];
  topActivities: (ActivityType & { participantCount: number })[];
}

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
    recentActivities,
    topActivities,
  };
};

function KPICard({
  title,
  value,
  icon: Icon,
  gradient,
  onClick,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  gradient: string;
  onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className={`group relative overflow-hidden transition-all duration-300 border border-border bg-card/85 shadow-sm hover:shadow-md hover:-translate-y-0.5 rounded-3xl h-full ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className={`absolute inset-0 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity ${gradient}`} />
      <CardContent className="p-6 relative z-10 flex flex-col h-full justify-between">
        <div className="flex justify-between items-start mb-5">
          <div className={`flex items-center justify-center w-12 h-12 rounded-2xl ${gradient} shadow-md`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          {onClick && (
            <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
        <div>
          <p className="text-4xl font-extrabold tracking-tight text-foreground mb-1 tabular-nums">
            {value.toLocaleString()}
          </p>
          <p className="text-sm font-semibold text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export const DepartmentDashboard: React.FC<DepartmentDashboardProps> = ({
  currentAdmin,
  onNavigate,
}) => {
  const [data, setData] = useState<DashboardData>({
    totalActivities: 0,
    activeActivities: 0,
    totalUsers: 0,
    todayRegistrations: 0,
    recentActivities: [],
    topActivities: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getDepartmentDashboardData(currentAdmin.department);
        if (!cancelled) setData(result);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'ไม่สามารถดึงข้อมูลแดชบอร์ดได้');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentAdmin.department]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-10 w-full min-w-0 max-w-full overflow-x-hidden">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-[2rem] bg-slate-900 text-white p-5 sm:p-8 shadow-xl">
        <div className="absolute -top-24 -right-24 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500 rounded-full blur-[100px] opacity-30 pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 sm:w-96 h-64 sm:h-96 bg-purple-500 rounded-full blur-[100px] opacity-25 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6 min-w-0">
          <div className="space-y-2 min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-medium mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span className="truncate">ภาพรวมระบบลงทะเบียนกิจกรรม</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight break-words">
              แดชบอร์ด{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                {DEPARTMENT_LABELS[currentAdmin.department] ?? currentAdmin.department}
              </span>
            </h1>
            <p className="text-slate-300 max-w-xl text-sm sm:text-base">
              จัดการกิจกรรม ตรวจรายชื่อผู้ลงทะเบียน และติดตามสถิติการเข้าร่วมได้จากที่นี่
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 shrink-0">
            <Button
              type="button"
              onClick={() => onNavigate?.('activities')}
              className="rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white border-0"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              จัดการกิจกรรม
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onNavigate?.('activity-list')}
              className="rounded-xl font-semibold bg-white/10 hover:bg-white/20 text-white border-0"
            >
              <ArrowUpRight className="w-4 h-4 mr-1.5" />
              ดูผู้ลงทะเบียน
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPICard
          title="กิจกรรมทั้งหมด"
          value={data.totalActivities}
          icon={CalendarDays}
          gradient="bg-gradient-to-br from-indigo-500 to-blue-600"
          onClick={onNavigate ? () => onNavigate('activities') : undefined}
        />
        <KPICard
          title="กิจกรรมที่เปิดรับอยู่"
          value={data.activeActivities}
          icon={Activity}
          gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          onClick={onNavigate ? () => onNavigate('activities') : undefined}
        />
        <KPICard
          title="บัญชีผู้ใช้ในระบบ"
          value={data.totalUsers}
          icon={Users}
          gradient="bg-gradient-to-br from-violet-500 to-purple-600"
          onClick={onNavigate ? () => onNavigate('users') : undefined}
        />
        <KPICard
          title="ลงทะเบียนวันนี้"
          value={data.todayRegistrations}
          icon={TrendingUp}
          gradient="bg-gradient-to-br from-amber-500 to-orange-600"
          onClick={onNavigate ? () => onNavigate('activity-list') : undefined}
        />
      </div>

      {/* Activity Lists */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="h-full border border-border shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-border bg-muted/40 pb-4 pt-5 px-6">
            <CardTitle className="flex items-center justify-between text-base font-bold text-foreground">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-600">
                  <Clock className="h-4 w-4" />
                </div>
                กิจกรรมล่าสุด
              </div>
              {onNavigate && (
                <Button variant="ghost" size="sm" onClick={() => onNavigate('activities')} className="text-xs">
                  ดูทั้งหมด
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentActivities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
                <Activity className="w-10 h-10 mb-2 opacity-25" />
                <p className="text-sm">ยังไม่มีกิจกรรมล่าสุด</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data.recentActivities.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3.5 p-4 sm:px-6 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm shrink-0">
                      {(a.activityName || '?').charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{a.activityName}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <Users className="w-3.5 h-3.5" /> {a.currentParticipants ?? 0} คน
                        <span>•</span>
                        {a.createdAt?.toLocaleDateString('th-TH') ?? 'ไม่ระบุ'}
                      </p>
                    </div>
                    <Badge variant={a.isActive ? 'success' : 'secondary'} className="rounded-full text-[11px] shrink-0">
                      {a.isActive ? 'เปิดรับ' : 'ปิดแล้ว'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-full border border-border shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-border bg-muted/40 pb-4 pt-5 px-6">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-600">
                <TrendingUp className="h-4 w-4" />
              </div>
              กิจกรรมที่มีผู้เข้าร่วมสูงสุด
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 sm:p-6">
            {data.topActivities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <BarChart3 className="w-10 h-10 mb-2 opacity-25" />
                <p className="text-sm">ยังไม่มีข้อมูลกิจกรรมยอดนิยม</p>
              </div>
            ) : (
              <div className="space-y-5">
                {data.topActivities.map((a, i) => {
                  const maxParticipants = data.topActivities[0].participantCount || 1;
                  const percent = Math.min(100, Math.round((a.participantCount / maxParticipants) * 100));
                  return (
                    <div key={a.id} className="flex items-center gap-3.5">
                      <div
                        className={`flex items-center justify-center w-7 h-7 rounded-full font-black text-xs shrink-0 ${
                          i === 0
                            ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
                            : i === 1
                              ? 'bg-slate-400 text-white'
                              : i === 2
                                ? 'bg-orange-400 text-white'
                                : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1 gap-2">
                          <p className="text-sm font-bold text-foreground truncate">{a.activityName}</p>
                          <p className="text-sm font-extrabold text-foreground shrink-0 tabular-nums">
                            {a.participantCount.toLocaleString()}{' '}
                            <span className="text-xs font-medium text-muted-foreground">คน</span>
                          </p>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              i === 0
                                ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                                : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                            }`}
                            style={{ width: `${percent}%` }}
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
    </div>
  );
};

export default DepartmentDashboard;
