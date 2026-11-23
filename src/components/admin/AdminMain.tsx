// src/components/admin/AdminMain.tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { AdminLayout } from './AdminLayout';
import { AdminRoleGuard } from './AdminRoleGuard';
import type { AdminProfile } from '../../types/admin';
import type { ActivitiesHubTab } from './ActivitiesHubPanel';
import type { TeamSettingsTab } from './TeamSettingsHub';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';

const PanelLoader = () => (
  <div className="flex min-h-[320px] items-center justify-center">
    <Spinner size="lg" />
  </div>
);

// Code-split ทุกหน้าแอดมินด้วย next/dynamic (ลดโหลด JS เริ่มต้นจาก >1.8 MB เหลือเฉพาะหน้าปัจจุบัน)
const DepartmentDashboard = dynamic(
  () => import('./DepartmentDashboard').then((m) => m.DepartmentDashboard),
  { ssr: false, loading: PanelLoader }
);
const ActivitiesHubPanel = dynamic(() => import('./ActivitiesHubPanel'), {
  ssr: false,
  loading: PanelLoader,
});
const ShortLinkDynamicQRPanel = dynamic(() => import('./ShortLinkDynamicQRPanel'), {
  ssr: false,
  loading: PanelLoader,
});
const AdminUserManagement = dynamic(() => import('./AdminUserManagement'), {
  ssr: false,
  loading: PanelLoader,
});
const TeamSettingsHub = dynamic(() => import('./TeamSettingsHub'), {
  ssr: false,
  loading: PanelLoader,
});
const AdminProfileEditor = dynamic(() => import('./AdminProfileEditor'), {
  ssr: false,
  loading: PanelLoader,
});

const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="p-3 sm:p-5 lg:p-8 max-w-7xl mx-auto w-full min-w-0 space-y-4 sm:space-y-6 overflow-x-hidden">
    <div className="w-full min-w-0">{children}</div>
  </div>
);

export type ActiveSection =
  | 'dashboard'
  | 'activities'
  | 'short-links'
  | 'users'
  | 'team-settings'
  | 'profile';

/** แปลง section เก่าที่อาจค้างอยู่ใน localStorage ให้เข้ากับเมนู 5 หมวดใหม่ */
function normalizeSection(raw?: string): {
  section: ActiveSection;
  activitiesTab?: ActivitiesHubTab;
  teamTab?: TeamSettingsTab;
} {
  switch (raw) {
    case 'dashboard':
      return { section: 'dashboard' };
    case 'activities':
    case 'qr-generator':
      return { section: 'activities', activitiesTab: 'manage' };
    case 'activity-list':
    case 'registration-history':
      return { section: 'activities', activitiesTab: 'participants' };
    case 'survey-results':
      return { section: 'activities', activitiesTab: 'surveys' };
    case 'short-links':
      return { section: 'short-links' };
    case 'users':
      return { section: 'users' };
    case 'team-settings':
    case 'admin-management':
      return { section: 'team-settings', teamTab: 'admins' };
    case 'settings':
      return { section: 'team-settings', teamTab: 'settings' };
    case 'reports':
      return { section: 'team-settings', teamTab: 'logs' };
    case 'profile':
      return { section: 'profile' };
    default:
      return { section: 'dashboard' };
  }
}

export interface AdminMainProps {
  currentAdmin: AdminProfile;
  onLogout: () => void;
  initialSection?: string;
}

export const AdminMain: React.FC<AdminMainProps> = React.memo(function AdminMain({
  currentAdmin,
  onLogout,
  initialSection = 'dashboard',
}) {
  const initial = normalizeSection(initialSection);
  const [activeSection, setActiveSection] = useState<ActiveSection>(initial.section);
  const [activitiesTab, setActivitiesTab] = useState<ActivitiesHubTab>(
    initial.activitiesTab ?? 'manage'
  );
  const [teamTab, setTeamTab] = useState<TeamSettingsTab>(initial.teamTab ?? 'admins');

  useEffect(() => {
    if (initialSection) {
      const next = normalizeSection(initialSection);
      setActiveSection(next.section);
      if (next.activitiesTab) setActivitiesTab(next.activitiesTab);
      if (next.teamTab) setTeamTab(next.teamTab);
    }
  }, [initialSection]);

  const handleSectionChange = useCallback((section: string) => {
    const next = normalizeSection(section);
    setActiveSection(next.section);
    if (next.activitiesTab) setActivitiesTab(next.activitiesTab);
    if (next.teamTab) setTeamTab(next.teamTab);
    try {
      localStorage.setItem('admin:lastSection', next.section);
    } catch {}
  }, []);

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <DepartmentDashboard
            currentAdmin={currentAdmin}
            onNavigate={handleSectionChange}
          />
        );

      case 'activities':
        return (
          <ActivitiesHubPanel
            currentAdmin={currentAdmin}
            initialTab={activitiesTab}
          />
        );

      case 'short-links':
        return (
          <AdminRoleGuard currentAdmin={currentAdmin} requiredPermission="manage_activities">
            <ShortLinkDynamicQRPanel currentAdmin={currentAdmin} />
          </AdminRoleGuard>
        );

      case 'users':
        return (
          <AdminRoleGuard currentAdmin={currentAdmin} requiredPermission="manage_users">
            <AdminUserManagement currentAdmin={currentAdmin} />
          </AdminRoleGuard>
        );

      case 'team-settings':
        return (
          <TeamSettingsHub
            currentAdmin={currentAdmin}
            initialTab={teamTab}
          />
        );

      case 'profile':
        return <AdminProfileEditor currentAdmin={currentAdmin} />;

      default:
        return (
          <Alert variant="info">
            <AlertDescription>เลือกเมนูจากแถบด้านซ้าย</AlertDescription>
          </Alert>
        );
    }
  };

  return (
    <AdminLayout
      currentAdmin={currentAdmin}
      activeSection={activeSection}
      onSectionChange={handleSectionChange}
      onLogout={onLogout}
    >
      <PageWrapper>{renderContent()}</PageWrapper>
    </AdminLayout>
  );
});

export default AdminMain;
