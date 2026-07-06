import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { AdminProfile, AdminPermission, AdminRole, AdminDepartment } from '../../types/admin';

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
  fallback,
}) => {
  if (!currentAdmin) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertDescription>ไม่มีสิทธิ์เข้าถึง: ไม่พบข้อมูลผู้ดูแลระบบ กรุณาเข้าสู่ระบบใหม่</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (requiredPermission && !currentAdmin.permissions.includes(requiredPermission)) {
    return (
      <>{fallback || (
        <div className="p-4">
          <Alert variant="warning">
            <AlertDescription>
              คุณไม่มีสิทธิ์ในการดำเนินการนี้ (Missing: {requiredPermission})
            </AlertDescription>
          </Alert>
        </div>
      )}</>
    );
  }

  if (requiredRole) {
    const roleHierarchy: AdminRole[] = ['viewer', 'moderator', 'department_admin', 'super_admin'];
    const currentRoleIndex = roleHierarchy.indexOf(currentAdmin.role);
    const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);
    if (currentRoleIndex < requiredRoleIndex) {
      return (
        <>{fallback || (
          <div className="p-4">
            <Alert variant="warning">
              <AlertDescription>
                ระดับสิทธิ์ของคุณไม่เพียงพอ (Required: {requiredRole})
              </AlertDescription>
            </Alert>
          </div>
        )}</>
      );
    }
  }

  if (
    allowedDepartments &&
    currentAdmin.department !== 'all' &&
    !allowedDepartments.includes(currentAdmin.department)
  ) {
    return (
      <>{fallback || (
        <div className="p-4">
          <Alert variant="warning">
            <AlertDescription>คุณไม่มีสิทธิ์เข้าถึงข้อมูลของแผนกนี้</AlertDescription>
          </Alert>
        </div>
      )}</>
    );
  }

  return <>{children}</>;
};