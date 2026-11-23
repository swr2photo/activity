'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { FileText, Settings, ShieldCheck } from 'lucide-react';
import type { AdminPermission, AdminProfile } from '@/types/admin';
import { ROLE_PERMISSIONS } from '@/types/admin';
import { PageHeader } from './shared/PageHeader';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';

const TabLoader = () => (
  <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-border bg-card/50">
    <Spinner size="lg" />
  </div>
);

const AdminManagement = dynamic(
  () => import('./AdminManagement').then((m) => m.AdminManagement),
  { ssr: false, loading: TabLoader }
);
const SystemSettingsPanel = dynamic(() => import('./SystemSettingsPanel'), {
  ssr: false,
  loading: TabLoader,
});
const AdminLogsPanel = dynamic(() => import('./AdminLogsPanel'), {
  ssr: false,
  loading: TabLoader,
});

export type TeamSettingsTab = 'admins' | 'settings' | 'logs';

interface TeamSettingsHubProps {
  currentAdmin: AdminProfile;
  initialTab?: TeamSettingsTab;
}

export default function TeamSettingsHub({
  currentAdmin,
  initialTab = 'admins',
}: TeamSettingsHubProps) {
  const perms: AdminPermission[] = Array.isArray(currentAdmin.permissions)
    ? currentAdmin.permissions
    : (ROLE_PERMISSIONS[currentAdmin.role] ?? []);

  const isSuper = currentAdmin.role === 'super_admin';
  const canManageAdmins = isSuper || perms.includes('manage_admins');
  const canSystemSettings = isSuper || perms.includes('system_settings');
  const canViewLogs = isSuper;

  const tabs: Array<{
    id: TeamSettingsTab;
    label: string;
    icon: React.ReactNode;
    allowed: boolean;
  }> = [
    {
      id: 'admins',
      label: 'ทีมแอดมิน & คำเชิญ',
      icon: <ShieldCheck className="h-4 w-4" />,
      allowed: canManageAdmins,
    },
    {
      id: 'settings',
      label: 'ตั้งค่าระบบ & Maintenance',
      icon: <Settings className="h-4 w-4" />,
      allowed: canSystemSettings,
    },
    {
      id: 'logs',
      label: 'บันทึกการใช้งาน (Audit Logs)',
      icon: <FileText className="h-4 w-4" />,
      allowed: canViewLogs,
    },
  ];

  const allowedTabs = tabs.filter((t) => t.allowed);
  const resolvedInitial: TeamSettingsTab = allowedTabs.some((t) => t.id === initialTab)
    ? initialTab
    : (allowedTabs[0]?.id ?? 'admins');

  const [activeTab, setActiveTab] = useState<TeamSettingsTab>(resolvedInitial);
  const [visited, setVisited] = useState<Set<TeamSettingsTab>>(() => new Set([resolvedInitial]));

  useEffect(() => {
    if (allowedTabs.some((t) => t.id === initialTab)) {
      setActiveTab(initialTab);
      setVisited((prev) => (prev.has(initialTab) ? prev : new Set(prev).add(initialTab)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);

  const selectTab = (tab: TeamSettingsTab) => {
    setActiveTab(tab);
    setVisited((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
  };

  if (allowedTabs.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        บัญชีของคุณไม่มีสิทธิ์เข้าถึงส่วนจัดการทีมแอดมินหรือตั้งค่าระบบ
      </div>
    );
  }

  return (
    <div className="space-y-5 w-full min-w-0">
      <PageHeader
        title="ทีมแอดมิน & ตั้งค่าระบบ"
        subtitle="จัดการผู้ดูแลระบบ คำเชิญ ตั้งค่าส่วนกลาง และตรวจสอบบันทึกการใช้งาน"
        icon={<Settings className="h-6 w-6" />}
      />

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

      {visited.has('admins') && canManageAdmins && (
        <div className={activeTab === 'admins' ? 'block' : 'hidden'}>
          <AdminManagement currentAdmin={currentAdmin} />
        </div>
      )}

      {visited.has('settings') && canSystemSettings && (
        <div className={activeTab === 'settings' ? 'block' : 'hidden'}>
          <SystemSettingsPanel currentAdmin={currentAdmin} />
        </div>
      )}

      {visited.has('logs') && canViewLogs && (
        <div className={activeTab === 'logs' ? 'block' : 'hidden'}>
          <AdminLogsPanel currentAdmin={currentAdmin} />
        </div>
      )}
    </div>
  );
}
