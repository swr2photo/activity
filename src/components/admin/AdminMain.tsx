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
  | 'settings';

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
        return (
          <AdminRoleGuard currentAdmin={currentAdmin} requiredPermission="view_reports">
            <ResponsiveContainer>
              <Typography variant="h4" gutterBottom>
                รายงานและสถิติ
              </Typography>
              <Alert severity="info">ส่วนรายงานจะถูกพัฒนาเพิ่มเติมในลำดับถัดไป</Alert>
            </ResponsiveContainer>
          </AdminRoleGuard>
        );

      case 'settings':
        return (
          <AdminRoleGuard currentAdmin={currentAdmin} requiredPermission="system_settings">
            <ResponsiveContainer>
              <Typography variant="h4" gutterBottom>
                ตั้งค่าระบบ
              </Typography>
              <Alert severity="info">ส่วนตั้งค่า system จะถูกพัฒนาเพิ่มเติมในลำดับถัดไป</Alert>
            </ResponsiveContainer>
          </AdminRoleGuard>
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
      onSectionChange={(section: string) => setActiveSection(section as ActiveSection)} // ← ห่อให้ตรง
      onLogout={onLogout}
    >
      {renderContent()}
    </AdminLayout>
  );
};

export default AdminMain;