import React from 'react';
import { Box, Alert, Typography } from '@mui/material';
import { AdminProfile, AdminPermission } from '../../types/admin';

// เพิ่ม type definitions ที่ขาดหายไป
type AdminRole = 'viewer' | 'moderator' | 'department_admin' | 'super_admin';
type AdminDepartment = 'all' | 'hr' | 'finance' | 'it' | 'marketing' | 'operations' | string;

interface AdminRoleGuardProps {
  currentAdmin: AdminProfile | null;
  requiredPermission?: AdminPermission;
  requiredRole?: AdminRole;
  allowedDepartments?: AdminDepartment[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const AdminRoleGuard: React.FC<AdminRoleGuardProps> = ({
  currentAdmin,
  requiredPermission,
  requiredRole,
  allowedDepartments,
  children,
  fallback
}) => {
  if (!currentAdmin) {
    return (
      <Alert severity="error">
        <Typography>ไม่มีสิทธิ์เข้าถึง กรุณาเข้าสู่ระบบใหม่</Typography>
      </Alert>
    );
  }

  // ตรวจสอบสิทธิ์
  if (requiredPermission && !currentAdmin.permissions.includes(requiredPermission)) {
    return fallback || (
      <Alert severity="warning">
        <Typography>คุณไม่มีสิทธิ์ในการดำเนินการนี้</Typography>
      </Alert>
    );
  }

  // ตรวจสอบบทบาท
  if (requiredRole) {
    const roleHierarchy = ['viewer', 'moderator', 'department_admin', 'super_admin'];
    const currentRoleIndex = roleHierarchy.indexOf(currentAdmin.role);
    const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);
   
    if (currentRoleIndex < requiredRoleIndex) {
      return fallback || (
        <Alert severity="warning">
          <Typography>คุณไม่มีสิทธิ์ในระดับที่เพียงพอ</Typography>
        </Alert>
      );
    }
  }

  // ตรวจสอบแผนก
  if (allowedDepartments && currentAdmin.department !== 'all' &&
      !allowedDepartments.includes(currentAdmin.department)) {
    return fallback || (
      <Alert severity="warning">
        <Typography>คุณไม่มีสิทธิ์เข้าถึงข้อมูลแผนกนี้</Typography>
      </Alert>
    );
  }

  return <>{children}</>;
};