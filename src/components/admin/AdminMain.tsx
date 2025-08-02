// components/admin/AdminMain.tsx
import React, { useState, useEffect } from 'react';
import { Box, CircularProgress, Alert, Typography } from '@mui/material';
import { AdminLayout } from './AdminLayout';
import { DepartmentDashboard } from './DepartmentDashboard';
import { AdminManagement } from './AdminManagement';
import { AdminRoleGuard } from './AdminRoleGuard';
import { AdminProfile } from '../../types/admin';

// Import existing components with responsive updates
import AdminPanel from '../AdminPanel';
import AdminUserManagement from '../AdminUserManagement';
import QRCodeAdminPanel from '../QRCodeAdminPanel';

// ResponsiveContainer component - create if it doesn't exist
const ResponsiveContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box sx={{ 
    padding: { xs: 2, sm: 3, md: 4 },
    maxWidth: '100%',
    overflow: 'hidden'
  }}>
    {children}
  </Box>
);

interface AdminMainProps {
  currentAdmin: AdminProfile;
  onLogout: () => void;
}

export const AdminMain: React.FC<AdminMainProps> = ({ currentAdmin, onLogout }) => {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [loading, setLoading] = useState(false);

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return <DepartmentDashboard currentAdmin={currentAdmin} />;
     
      case 'activity-list':
        return (
          <AdminRoleGuard
            currentAdmin={currentAdmin}
            requiredPermission="manage_activities"
          >
            <AdminPanel />
          </AdminRoleGuard>
        );
     
      case 'qr-generator':
        return (
          <AdminRoleGuard
            currentAdmin={currentAdmin}
            requiredPermission="manage_activities"
          >
            <ResponsiveContainer>
              <QRCodeAdminPanel baseUrl={typeof window !== 'undefined' ? window.location.origin : ''} />
            </ResponsiveContainer>
          </AdminRoleGuard>
        );
     
      case 'users':
        return (
          <AdminRoleGuard
            currentAdmin={currentAdmin}
            requiredPermission="manage_users"
          >
            <ResponsiveContainer>
              <AdminUserManagement />
            </ResponsiveContainer>
          </AdminRoleGuard>
        );
     
      case 'admin-management':
        return <AdminManagement currentAdmin={currentAdmin} />;
     
      case 'reports':
        return (
          <AdminRoleGuard
            currentAdmin={currentAdmin}
            requiredPermission="view_reports"
          >
            <ResponsiveContainer>
              <Typography variant="h4">รายงานและสถิติ</Typography>
              {/* Reports component will be implemented */}
            </ResponsiveContainer>
          </AdminRoleGuard>
        );
     
      case 'settings':
        return (
          <AdminRoleGuard
            currentAdmin={currentAdmin}
            requiredPermission="system_settings"
          >
            <ResponsiveContainer>
              <Typography variant="h4">ตั้งค่าระบบ</Typography>
              {/* Settings component will be implemented */}
            </ResponsiveContainer>
          </AdminRoleGuard>
        );
     
      default:
        return (
          <ResponsiveContainer>
            <Alert severity="info">
              เลือกเมนูจากแถบด้านซ้าย
            </Alert>
          </ResponsiveContainer>
        );
    }
  };

  if (loading) {
    return (
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh'
      }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <AdminLayout
      currentAdmin={currentAdmin}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      onLogout={onLogout}
    >
      {renderContent()}
    </AdminLayout>
  );
};