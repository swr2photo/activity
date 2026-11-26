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
import { Skeleton } from '@/components/ui/skeleton';
import ScienceOrbit from '@/components/graphics/ScienceOrbit';

const PanelLoader = () => (
  <div className="space-y-5" aria-busy="true" aria-label="กำลังโหลด">
    <div className="flex items-center gap-3">
      <ScienceOrbit className="h-12 w-12" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-6 w-56 rounded-lg" />
        <Skeleton className="h-4 w-80 max-w-full rounded-lg" />
      </div>
    </div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-28 rounded-2xl" />
    </div>
    <Skeleton className="h-72 rounded-2xl" />
  </div>
);

// Code-split ทุกหน้าแอดมินด้วย next/dynamic (ลดโหลด JS เริ่มต้นจาก >1.8 MB เหลือเฉพาะหน้าปัจจุบัน)
const loadDashboard = () => import('./DepartmentDashboard');
const loadActivitiesHub = () => import('./ActivitiesHubPanel');
const loadShortLinks = () => import('./ShortLinkDynamicQRPanel');
const loadUsers = () => import('./AdminUserManagement');
const loadTeamSettings = () => import('./TeamSettingsHub');
const loadProfile = () => import('./AdminProfileEditor');

const DepartmentDashboard = dynamic(
  () => loadDashboard().then((m) => m.DepartmentDashboard),
  { ssr: false, loading: PanelLoader }
);
const ActivitiesHubPanel = dynamic(loadActivitiesHub, { ssr: false, loading: PanelLoader });
const ShortLinkDynamicQRPanel = dynamic(loadShortLinks, { ssr: false, loading: PanelLoader });
const AdminUserManagement = dynamic(loadUsers, { ssr: false, loading: PanelLoader });
const TeamSettingsHub = dynamic(loadTeamSettings, { ssr: false, loading: PanelLoader });
const AdminProfileEditor = dynamic(loadProfile, { ssr: false, loading: PanelLoader });

/**
 * โหลด chunk ของเมนูอื่นล่วงหน้าตอนเบราว์เซอร์ว่าง (หลังหน้าปัจจุบันพร้อมแล้ว)
 * → กดสลับเมนูแล้วขึ้นทันที โดยไม่แย่งแบนด์วิดท์ตอนโหลดครั้งแรก
 */
function usePrefetchPanels() {
  useEffect(() => {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (nav.connection?.saveData) return;
    const queue = [loadActivitiesHub, loadShortLinks, loadUsers, loadTeamSettings, loadProfile];
    let cancelled = false;
    const w = window as typeof window & {
      requestIdleCallback?: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const schedule = (fn: () => void) =>
      w.requestIdleCallback ? w.requestIdleCallback(fn, { timeout: 4000 }) : window.setTimeout(fn, 1500);
    let handle = 0;
    const next = () => {
      if (cancelled) return;
      const load = queue.shift();
      if (!load) return;
      void load()
        .catch(() => {})
        .finally(() => {
          handle = schedule(next);
        });
    };
    const startTimer = window.setTimeout(() => {
      handle = schedule(next);
    }, 2500);
    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      if (w.cancelIdleCallback) w.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);
}

const PageWrapper: React.FC<{ children: React.ReactNode; sectionKey: string }> = ({
  children,
  sectionKey,
}) => (
  <div className="p-3 sm:p-5 lg:p-8 max-w-7xl mx-auto w-full min-w-0 space-y-4 sm:space-y-6 overflow-x-clip">
    {/* key ตามเมนู → เนื้อหาเลื่อนขึ้นนุ่ม ๆ ทุกครั้งที่สลับหน้า */}
    <div key={sectionKey} className="w-full min-w-0 animate-section">
      {children}
    </div>
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

  usePrefetchPanels();

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
      <PageWrapper sectionKey={activeSection}>{renderContent()}</PageWrapper>
    </AdminLayout>
  );
});

export default AdminMain;
