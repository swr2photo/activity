// src/components/admin/AdminMain.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { AdminLayout } from './AdminLayout';
import { DepartmentDashboard } from './DepartmentDashboard';
import { AdminManagement } from './AdminManagement';
import { AdminRoleGuard } from './AdminRoleGuard';
import type { AdminProfile } from '../../types/admin';

// Panels
import AdminAttendancePanel from './AdminAttendancePanel';
import AdminUserManagement from './AdminUserManagement';
import QRCodeAdminPanel from './QRCodeAdminPanel';
import SystemSettingsPanel from './SystemSettingsPanel';
import AdminProfileEditor from './AdminProfileEditor';
import AdminLogsPanel from './AdminLogsPanel';
import { Alert, AlertDescription } from '@/components/ui/alert';

const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
    {children}
  </div>
);

type ActiveSection =
  | 'dashboard'
  | 'activity-list'
  | 'qr-generator'
  | 'users'
  | 'admin-management'
  | 'reports'
  | 'settings'
  | 'profile';

export interface AdminMainProps {
  currentAdmin: AdminProfile;
  onLogout: () => void;
  initialSection?: ActiveSection;
}

export const AdminMain: React.FC<AdminMainProps> = ({
  currentAdmin,
  onLogout,
  initialSection = 'dashboard',
}) => {
  const [activeSection, setActiveSection] = useState<ActiveSection>(initialSection);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialSection) setActiveSection(initialSection);
  }, [initialSection]);

  const handleSectionChange = (section: string) => {
    setActiveSection(section as ActiveSection);
    try {
      localStorage.setItem('admin:lastSection', section);
    } catch {}
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return <DepartmentDashboard currentAdmin={currentAdmin} />;

      case 'activity-list':
        return (
          <AdminRoleGuard currentAdmin={currentAdmin} requiredPermission="manage_activities">
            <AdminAttendancePanel currentAdmin={currentAdmin} />
          </AdminRoleGuard>
        );

      case 'qr-generator':
        return (
          <AdminRoleGuard currentAdmin={currentAdmin} requiredPermission="manage_activities">
            <QRCodeAdminPanel currentAdmin={currentAdmin} />
          </AdminRoleGuard>
        );

      case 'users':
        return (
          <AdminRoleGuard currentAdmin={currentAdmin} requiredPermission="manage_users">
            <AdminUserManagement currentAdmin={currentAdmin} />
          </AdminRoleGuard>
        );

      case 'admin-management':
        return <AdminManagement currentAdmin={currentAdmin} />;

      case 'reports':
        return (
          <AdminRoleGuard currentAdmin={currentAdmin} requiredPermission="view_reports">
            <AdminLogsPanel currentAdmin={currentAdmin} />
          </AdminRoleGuard>
        );

      case 'settings':
        return (
          <AdminRoleGuard currentAdmin={currentAdmin} requiredPermission="system_settings">
            <SystemSettingsPanel currentAdmin={currentAdmin} />
          </AdminRoleGuard>
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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AdminLayout
      currentAdmin={currentAdmin}
      activeSection={activeSection}
      onSectionChange={handleSectionChange}
      onLogout={onLogout}
    >
      <PageWrapper>
        {renderContent()}
      </PageWrapper>
    </AdminLayout>
  );
};

export default AdminMain;