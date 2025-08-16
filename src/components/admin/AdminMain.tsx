'use client';

import React, { useState } from 'react';
import { Box, CircularProgress, Alert, Typography } from '@mui/material';
import { AdminLayout } from './AdminLayout';
import { DepartmentDashboard } from './DepartmentDashboard';
import { AdminManagement } from './AdminManagement';
import { AdminRoleGuard } from './AdminRoleGuard';
import type { AdminProfile } from '../../types/admin';

// Panels (รีแฟกเตอร์ให้ใช้งานกับเลเยอร์ใหม่)
import AdminAttendancePanel from './AdminAttendancePanel';
import AdminUserManagement from './AdminUserManagement';
import QRCodeAdminPanel from './QRCodeAdminPanel';

// ✅ ใหม่
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
  | 'profile'; // ✅ เพิ่มหน้าแก้โปรไฟล์

interface AdminMainProps {
  currentAdmin: AdminProfile;
  onLogout: () => void;
}

export const AdminMain: React.FC<AdminMainProps> = ({ currentAdmin, onLogout }) => {
  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');
  const [loading, setLoading] = useState(false);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

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
              <QRCodeAdminPanel currentAdmin={currentAdmin} baseUrl={baseUrl} />
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
        // ✅ เปลี่ยนเป็นหน้าแสดง Admin Logs แบบเรียลไทม์
        return (
          <AdminRoleGuard currentAdmin={currentAdmin} requiredPermission="view_reports">
            <ResponsiveContainer>
              <AdminLogsPanel currentAdmin={currentAdmin} />
            </ResponsiveContainer>
          </AdminRoleGuard>
        );

      case 'settings':
        // ✅ หน้า “ตั้งค่าระบบ” (ปิดปรับปรุง / มาตรฐานแบนเนอร์)
        return (
          <AdminRoleGuard currentAdmin={currentAdmin} requiredPermission="system_settings">
            <ResponsiveContainer>
              <SystemSettingsPanel currentAdmin={currentAdmin} />
            </ResponsiveContainer>
          </AdminRoleGuard>
        );

      case 'profile':
        // ✅ หน้า “แก้ไขโปรไฟล์แอดมิน”
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
      onSectionChange={(section: string) => setActiveSection(section as ActiveSection)}
      onLogout={onLogout}
    >
      {renderContent()}
    </AdminLayout>
  );
};

export default AdminMain;
