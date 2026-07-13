// components/admin/DepartmentDashboard.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays, TrendingUp, Users, Activity, BarChart3, Clock,
  ArrowUpRight, Sparkles
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
import { Button } from '@/components/ui/button';
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
  title, value, icon: Icon, gradient, delay, trend,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  gradient: string;
  delay: number;
  trend?: { value: number; label: string; isPositive: boolean };
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, type: 'spring', stiffness: 200, damping: 20 }}
      className="group"
    >
      <Card className="relative overflow-hidden transition-all duration-500 border border-white/40 bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 rounded-3xl h-full">
        <div className={`absolute inset-0 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500 ${gradient}`} />
        <div className={`absolute -right-8 -top-8 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-700 ${gradient}`} />
        
        <CardContent className="p-6 relative z-10 flex flex-col h-full justify-between">
          <div className="flex justify-between items-start mb-6">
            <div className={`flex items-center justify-center w-12 h-12 rounded-2xl ${gradient} shadow-lg ring-4 ring-white/50 relative overflow-hidden group-hover:scale-110 transition-transform duration-500`}>
              <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent" />
              <Icon className="h-6 w-6 text-white drop-shadow-md relative z-10" />
            </div>
            {trend && (
              <Badge variant={trend.isPositive ? 'success' : 'secondary'} className="font-bold text-xs py-1 px-2 bg-white/80 backdrop-blur-sm border-white/50 shadow-sm">
                {trend.isPositive ? '↑' : '↓'} {trend.value}%
              </Badge>
            )}
          </div>
          
          <div>
            <p className="text-4xl font-extrabold tracking-tight text-slate-800 mb-1 drop-shadow-sm">
              <AnimatedCounter value={value} />
            </p>
            <p className="text-sm font-semibold text-slate-500">{title}</p>
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
    <div className="space-y-8 pb-10">
      {/* Premium Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-[2rem] bg-slate-900 text-white p-8 md:p-10 shadow-2xl"
      >
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500 rounded-full blur-[100px] opacity-40 animate-pulse" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500 rounded-full blur-[100px] opacity-30" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>อัปเดตข้อมูลล่าสุดเมื่อสักครู่</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">
              แดชบอร์ด <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">{DEPARTMENT_LABELS[currentAdmin.department] ?? currentAdmin.department}</span>
            </h1>
            <p className="text-slate-300 max-w-xl text-base md:text-lg">
              ภาพรวมกิจกรรมและผู้เข้าร่วมในสังกัดของคุณ ตรวจสอบสถิติและแนวโน้มการเข้าร่วมกิจกรรมได้ที่นี่
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="rounded-xl font-semibold bg-white/10 hover:bg-white/20 text-white border-0 backdrop-blur-md">
              <ArrowUpRight className="w-4 h-4 mr-2" />
              ดูรายงานทั้งหมด
            </Button>
          </div>
        </div>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Recent Activities */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <Card className="h-full border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4 pt-6 px-8">
              <CardTitle className="flex items-center justify-between text-lg font-bold text-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-xl text-blue-600">
                    <Clock className="h-5 w-5" />
                  </div>
                  กิจกรรมล่าสุด
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.recentActivities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Activity className="w-12 h-12 mb-3 opacity-20" />
                  <p>ยังไม่มีกิจกรรมล่าสุด</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.recentActivities.map((a, i) => (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + i * 0.1 }}
                      key={a.id}
                      className="group flex items-center gap-4 p-6 hover:bg-slate-50 transition-all duration-300"
                    >
                      <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-lg shadow-md group-hover:scale-110 transition-transform">
                        {(a.activityName || '?').charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">{a.activityName}</p>
                        <p className="text-sm font-medium text-slate-500 flex items-center gap-2 mt-1">
                          <Users className="w-4 h-4" /> {a.currentParticipants ?? 0} คน 
                          <span className="text-slate-300">•</span> 
                          {a.createdAt?.toLocaleDateString('th-TH') ?? 'ไม่ระบุ'}
                        </p>
                      </div>
                      <Badge variant={a.isActive ? 'success' : 'secondary'} className="px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                        {a.isActive ? 'เปิดลงทะเบียน' : 'ปิดแล้ว'}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Activities */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <Card className="h-full border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4 pt-6 px-8">
              <CardTitle className="flex items-center justify-between text-lg font-bold text-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  กิจกรรมยอดนิยม
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {data.topActivities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <BarChart3 className="w-12 h-12 mb-3 opacity-20" />
                  <p>ยังไม่มีข้อมูลกิจกรรมยอดนิยม</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {data.topActivities.map((a, i) => {
                    const maxParticipants = data.topActivities[0].participantCount || 1;
                    const percent = Math.min(100, Math.round((a.participantCount / maxParticipants) * 100));
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 + i * 0.1 }}
                        key={a.id}
                        className="group"
                      >
                        <div className="flex items-center gap-4 mb-2">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-full font-black text-sm shrink-0 shadow-sm ${
                            i === 0 ? 'bg-gradient-to-br from-amber-300 to-orange-500 text-white' :
                            i === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-white' :
                            i === 2 ? 'bg-gradient-to-br from-orange-300 to-red-400 text-white' :
                            'bg-slate-100 text-slate-500'
                          }`}>
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                              <p className="text-sm font-bold text-slate-700 truncate">{a.activityName}</p>
                              <p className="text-sm font-black text-slate-900">{a.participantCount.toLocaleString()} <span className="text-xs font-semibold text-slate-500">คน</span></p>
                            </div>
                            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${percent}%` }}
                                transition={{ duration: 1, delay: 0.8 + i * 0.1, type: 'spring' }}
                                className={`h-full rounded-full ${
                                  i === 0 ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                                  i === 1 ? 'bg-gradient-to-r from-slate-400 to-slate-600' :
                                  i === 2 ? 'bg-gradient-to-r from-orange-400 to-red-500' :
                                  'bg-gradient-to-r from-blue-400 to-indigo-500'
                                }`} 
                              />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
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
