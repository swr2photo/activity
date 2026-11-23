'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { CalendarDays, ClipboardCheck, Link2, Users } from 'lucide-react';
import type { AdminPermission, AdminProfile } from '@/types/admin';
import { ROLE_PERMISSIONS } from '@/types/admin';
import { PageHeader } from './shared/PageHeader';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';

const TabLoader = () => (
  <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-border bg-card/50">
    <Spinner size="lg" />
  </div>
);

const QRCodeAdminPanel = dynamic(() => import('./QRCodeAdminPanel'), {
  ssr: false,
  loading: TabLoader,
});
const AdminAttendancePanel = dynamic(() => import('./AdminAttendancePanel'), {
  ssr: false,
  loading: TabLoader,
});
const ShortLinkDynamicQRPanel = dynamic(() => import('./ShortLinkDynamicQRPanel'), {
  ssr: false,
  loading: TabLoader,
});
const SurveyResultsPanel = dynamic(() => import('./SurveyResultsPanel'), {
  ssr: false,
  loading: TabLoader,
});

export type ActivitiesHubTab = 'manage' | 'participants' | 'links' | 'surveys';

interface ActivitiesHubPanelProps {
  currentAdmin: AdminProfile;
  initialTab?: ActivitiesHubTab;
}

export default function ActivitiesHubPanel({
  currentAdmin,
  initialTab = 'manage',
}: ActivitiesHubPanelProps) {
  const perms: AdminPermission[] = Array.isArray(currentAdmin.permissions)
    ? currentAdmin.permissions
    : (ROLE_PERMISSIONS[currentAdmin.role] ?? []);

  const canManage = currentAdmin.role === 'super_admin' || perms.includes('manage_activities');
  const canViewReports =
    currentAdmin.role === 'super_admin' ||
    perms.includes('view_reports') ||
    perms.includes('manage_activities');

  const tabs: Array<{
    id: ActivitiesHubTab;
    label: string;
    icon: React.ReactNode;
    allowed: boolean;
  }> = [
    {
      id: 'manage',
      label: 'รายการ & สร้างกิจกรรม',
      icon: <CalendarDays className="h-4 w-4" />,
      allowed: canManage,
    },
    {
      id: 'participants',
      label: 'ผู้ลงทะเบียน & เช็กอิน',
      icon: <Users className="h-4 w-4" />,
      allowed: canViewReports,
    },
    {
      id: 'links',
      label: 'ลิงก์ย่อ & Dynamic QR',
      icon: <Link2 className="h-4 w-4" />,
      allowed: canManage,
    },
    {
      id: 'surveys',
      label: 'ผลแบบประเมิน',
      icon: <ClipboardCheck className="h-4 w-4" />,
      allowed: canViewReports,
    },
  ];

  const allowedTabs = tabs.filter((t) => t.allowed);
  const resolvedInitial: ActivitiesHubTab = allowedTabs.some((t) => t.id === initialTab)
    ? initialTab
    : (allowedTabs[0]?.id ?? 'participants');

  const [activeTab, setActiveTab] = useState<ActivitiesHubTab>(resolvedInitial);
  // keep-alive: จำแท็บที่เคยเปิดแล้วไว้ เพื่อสลับแท็บกลับไปมาได้ทันทีโดยไม่ยิง Firestore ใหม่ทุกครั้ง
  const [visited, setVisited] = useState<Set<ActivitiesHubTab>>(() => new Set([resolvedInitial]));

  useEffect(() => {
    if (allowedTabs.some((t) => t.id === initialTab)) {
      setActiveTab(initialTab);
      setVisited((prev) => (prev.has(initialTab) ? prev : new Set(prev).add(initialTab)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);

  const selectTab = (tab: ActivitiesHubTab) => {
    setActiveTab(tab);
    setVisited((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
  };

  return (
    <div className="space-y-5 w-full min-w-0">
      <PageHeader
        title="ศูนย์จัดการกิจกรรม"
        subtitle="สร้าง/แก้ไขกิจกรรม, จัดการลิงก์ย่อ & Dynamic QR, ตรวจรายชื่อผู้ลงทะเบียน และดูผลแบบประเมินครบจบในหน้าเดียว"
        icon={<CalendarDays className="h-6 w-6" />}
      />

      {/* Unified Activity Sub-Navigation Bar */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-border bg-card p-1.5 shadow-sm">
        {allowedTabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTab(t.id)}
              className={cn(
                'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Keep-alive Panels (lazy-loaded เฉพาะแท็บที่ผู้ใช้กดจริง) */}
      {visited.has('manage') && canManage && (
        <div className={activeTab === 'manage' ? 'block' : 'hidden'}>
          <QRCodeAdminPanel currentAdmin={currentAdmin} />
        </div>
      )}

      {visited.has('participants') && canViewReports && (
        <div className={activeTab === 'participants' ? 'block' : 'hidden'}>
          <AdminAttendancePanel currentAdmin={currentAdmin} embedded />
        </div>
      )}

      {visited.has('links') && canManage && (
        <div className={activeTab === 'links' ? 'block' : 'hidden'}>
          <ShortLinkDynamicQRPanel currentAdmin={currentAdmin} />
        </div>
      )}

      {visited.has('surveys') && canViewReports && (
        <div className={activeTab === 'surveys' ? 'block' : 'hidden'}>
          <SurveyResultsPanel currentAdmin={currentAdmin} />
        </div>
      )}
    </div>
  );
}
