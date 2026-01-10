import React from 'react';
import { Alert, Typography, Box } from '@mui/material';
import type { AdminProfile, AdminPermission, AdminRole, AdminDepartment } from '../../types/admin';

interface AdminRoleGuardProps {
  currentAdmin: AdminProfile | null;
  requiredPermission?: AdminPermission;
  requiredRole?: AdminRole; // 'viewer' | 'moderator' | 'department_admin' | 'super_admin'
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
  // 1. เช็คว่ามี Admin Profile หรือไม่
  if (!currentAdmin) {
    return (
      <Box p={2}>
        <Alert severity="error">
          <Typography>ไม่มีสิทธิ์เข้าถึง: ไม่พบข้อมูลผู้ดูแลระบบ กรุณาเข้าสู่ระบบใหม่</Typography>
        </Alert>
      </Box>
    );
  }

  // 2. เช็ค Permission (ถ้ามีการระบุ)
  if (requiredPermission && !currentAdmin.permissions.includes(requiredPermission)) {
    return (
      <>{fallback || (
        <Alert severity="warning" sx={{ my: 2 }}>
          <Typography>คุณไม่มีสิทธิ์ในการดำเนินการนี้ (Missing: {requiredPermission})</Typography>
        </Alert>
      )}</>
    );
  }

  // 3. เช็ค Role Hierarchy (ถ้ามีการระบุ)
  if (requiredRole) {
    const roleHierarchy: AdminRole[] = ['viewer', 'moderator', 'department_admin', 'super_admin'];
    const currentRoleIndex = roleHierarchy.indexOf(currentAdmin.role);
    const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);

    if (currentRoleIndex < requiredRoleIndex) {
      return (
        <>{fallback || (
          <Alert severity="warning" sx={{ my: 2 }}>
            <Typography>ระดับสิทธิ์ของคุณไม่เพียงพอ (Required: {requiredRole})</Typography>
          </Alert>
        )}</>
      );
    }
  }

  // 4. เช็ค Department Scope (ถ้ามีการระบุ และ Admin ไม่ใช่ 'all')
  if (
    allowedDepartments && 
    currentAdmin.department !== 'all' && 
    !allowedDepartments.includes(currentAdmin.department)
  ) {
    return (
      <>{fallback || (
        <Alert severity="warning" sx={{ my: 2 }}>
          <Typography>คุณไม่มีสิทธิ์เข้าถึงข้อมูลของแผนกนี้</Typography>
        </Alert>
      )}</>
    );
  }

  // ผ่านทุกด่าน
  return <>{children}</>;
};