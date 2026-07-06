// components/admin/DepartmentDashboard.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays, TrendingUp, Users, Activity, BarChart3, Clock,
} from 'lucide-react';

import { AdminProfile, DEPARTMENT_LABELS, type AdminDepartment } from '../../types/admin';
import {
  getActivitiesByDepartment,
  getActivityRecordsByDepartment,
  getUsersByDepartment,
  type Activity as ActivityType,
} from '../../lib/adminFirebase';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from './shared/PageHeader';

interface DepartmentDashboardProps {
  currentAdmin: AdminProfile;
}

interface DashboardData {
  totalActivities: number;
  activeActivities: number;
  totalParticipants: number;
  todayParticipants: number;
  recentActivities: ActivityType[];
  topActivities: (ActivityType & { participantCount: number })[];
}

const isSameDay = (a?: Date, b?: Date) => {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
};

const getDepartmentDashboardData = async (department: AdminDepartment): Promise<DashboardData> => {
  const [activities, activityRecords, users] = await Promise.all([
    getActivitiesByDepartment(department),
    getActivityRecordsByDepartment(department),
    getUsersByDepartment(department),
  ]);

  const totalActivities = activities.length;
  const activeActivities = activities.filter((a) => a.isActive).length;
  const totalParticipants = users.length;
  const today = new Date();
  const todayParticipants = activityRecords.filter((r) => isSameDay(r.timestamp, today)).length;

  const countsByCode = activityRecords.reduce((acc, r) => {
    const code = r.activityCode || '';
    acc[code] = (acc[code] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const createdTime = (a: ActivityType) =>
    a.createdAt?.getTime() ?? a.startDateTime?.getTime() ?? a.endDateTime?.getTime() ?? 0;

  const recentActivities = [...activities].sort((a, b) => createdTime(b) - createdTime(a)).slice(0, 5);
  const topActivities = activities
    .map((a) => ({ ...a, participantCount: countsByCode[a.activityCode] || 0 }))
    .sort((a, b) => b.participantCount - a.participantCount)
    .slice(0, 5);

  return { totalActivities, activeActivities, totalParticipants, todayParticipants, recentActivities, topActivities };
};

// ─── Animated Counter ───
function AnimatedCounter({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (value === 0) { setDisplayValue(0); return; }
    const duration = 800;
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);

  return <>{displayValue.toLocaleString()}</>;
}

// ─── KPI Card ───
function KPICard({
  title, value, icon: Icon, gradient, delay,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  gradient: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
    >
      <Card className="relative overflow-hidden hover:shadow-lg transition-shadow duration-300 border-0">
        <div className={`absolute inset-0 opacity-[0.07] ${gradient}`} />
        <CardContent className="p-5 relative">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
              <p className="text-3xl font-bold tracking-tight">
                <AnimatedCounter value={value} />
              </p>
            </div>
            <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${gradient} shadow-lg`}>
              <Icon className="h-6 w-6 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export const DepartmentDashboard: React.FC<DepartmentDashboardProps> = ({ currentAdmin }) => {
  const [data, setData] = useState<DashboardData>({
    totalActivities: 0,
    activeActivities: 0,
    totalParticipants: 0,
    todayParticipants: 0,
    recentActivities: [],
    topActivities: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getDepartmentDashboardData(currentAdmin.department);
        setData(result);
      } catch (e: any) {
        setError(e?.message || 'ไม่สามารถดึงข้อมูลแดชบอร์ดได้');
      } finally {
        setLoading(false);
      }
    })();
  }, [currentAdmin.department]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <PageHeader 
          title={`แดชบอร์ด ${DEPARTMENT_LABELS[currentAdmin.department] ?? currentAdmin.department}`}
          subtitle="ภาพรวมกิจกรรมและผู้เข้าร่วมในสังกัดของคุณ"
          icon={<BarChart3 className="h-6 w-6" />}
        />
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="กิจกรรมทั้งหมด"
          value={data.totalActivities}
          icon={CalendarDays}
          gradient="bg-gradient-to-br from-indigo-500 to-blue-600"
          delay={0}
        />
        <KPICard
          title="กิจกรรมที่เปิดอยู่"
          value={data.activeActivities}
          icon={Activity}
          gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          delay={0.1}
        />
        <KPICard
          title="ผู้เข้าร่วมทั้งหมด"
          value={data.totalParticipants}
          icon={Users}
          gradient="bg-gradient-to-br from-violet-500 to-purple-600"
          delay={0.2}
        />
        <KPICard
          title="เข้าร่วมวันนี้"
          value={data.todayParticipants}
          icon={TrendingUp}
          gradient="bg-gradient-to-br from-amber-500 to-orange-600"
          delay={0.3}
        />
      </div>

      {/* Activity Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-5 w-5 text-primary" />
                กิจกรรมล่าสุด
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.recentActivities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">ยังไม่มีกิจกรรม</p>
              ) : (
                <div className="space-y-1">
                  {data.recentActivities.map((a, i) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary font-bold text-sm shrink-0">
                        {(a.activityName || '?').charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.activityName}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.currentParticipants ?? 0} คน • {a.createdAt?.toLocaleDateString('th-TH') ?? 'ไม่ระบุ'}
                        </p>
                      </div>
                      <Badge variant={a.isActive ? 'success' : 'secondary'} className="shrink-0">
                        {a.isActive ? 'เปิด' : 'ปิด'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Activities */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                กิจกรรมยอดนิยม
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.topActivities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">ยังไม่มีกิจกรรม</p>
              ) : (
                <div className="space-y-1">
                  {data.topActivities.map((a, i) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className={`flex items-center justify-center w-9 h-9 rounded-lg font-bold text-sm shrink-0 ${
                        i === 0 ? 'bg-amber-100 text-amber-700' :
                        i === 1 ? 'bg-slate-200 text-slate-600' :
                        i === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        #{i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.activityName}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.participantCount} ผู้เข้าร่วม
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default DepartmentDashboard;
