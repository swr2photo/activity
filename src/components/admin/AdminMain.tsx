// src/components/admin/AdminMain.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Alert } from '@mui/material';
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

// กล่องห่อเล็ก ๆ ให้คอนเทนต์ดูสบายตาในมือถือ
const ResponsiveContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box sx={{ padding: { xs: 2, sm: 3, md: 4 }, maxWidth: '100%', overflow: 'hidden' }}>
    {children}
  </Box>
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
  /** หน้าเริ่มต้นหลังรีเฟรช เช่น 'dashboard', 'users', ... */
  initialSection?: ActiveSection;
}

export const AdminMain: React.FC<AdminMainProps> = ({
  currentAdmin,
  onLogout,
  initialSection = 'dashboard',
}) => {
  const [activeSection, setActiveSection] = useState<ActiveSection>(initialSection);
  const [loading, setLoading] = useState(false);

  // sync ถ้า initialSection เปลี่ยน (เช่นตอนโหลดจาก localStorage)
  useEffect(() => {
    if (initialSection) setActiveSection(initialSection);
  }, [initialSection]);

  // เมื่อเปลี่ยนหน้า ให้บันทึกลง localStorage
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
            <ResponsiveContainer>
              <QRCodeAdminPanel currentAdmin={currentAdmin} />
            </ResponsiveContainer>
          </AdminRoleGuard>
        );

      case 'users':
        return (
          <AdminRoleGuard currentAdmin={currentAdmin} requiredPermission="manage_users">
            <ResponsiveContainer>
              <AdminUserManagement currentAdmin={currentAdmin} />
            </ResponsiveContainer>
          </AdminRoleGuard>
        );

      case 'admin-management':
        return <AdminManagement currentAdmin={currentAdmin} />;

      case 'reports':
        return (
          <AdminRoleGuard currentAdmin={currentAdmin} requiredPermission="view_reports">
            <ResponsiveContainer>
              <AdminLogsPanel currentAdmin={currentAdmin} />
            </ResponsiveContainer>
          </AdminRoleGuard>
        );

      case 'settings':
        return (
          <AdminRoleGuard currentAdmin={currentAdmin} requiredPermission="system_settings">
            <ResponsiveContainer>
              <SystemSettingsPanel currentAdmin={currentAdmin} />
            </ResponsiveContainer>
          </AdminRoleGuard>
        );

      case 'profile':
        return (
          <ResponsiveContainer>
            <AdminProfileEditor currentAdmin={currentAdmin} />
          </ResponsiveContainer>
        );

      default:
        return (
          <ResponsiveContainer>
            <Alert severity="info">เลือกเมนูจากแถบด้านซ้าย</Alert>
          </ResponsiveContainer>
        );
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <AdminLayout
      currentAdmin={currentAdmin}
      activeSection={activeSection}
      onSectionChange={handleSectionChange}
      onLogout={onLogout}
    >
      {renderContent()}
    </AdminLayout>
  );
};

export default AdminMain;
