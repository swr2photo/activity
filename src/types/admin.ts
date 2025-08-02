export interface AdminProfile {
  uid: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  role: AdminRole;
  department: AdminDepartment;
  permissions: AdminPermission[];
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
  createdBy?: string; // UID ของผู้สร้าง
  lastLoginAt?: any;
  profileImage?: string;
}

export type AdminRole = 'super_admin' | 'department_admin' | 'moderator' | 'viewer';

export type AdminDepartment = 
  | 'student_union'        // สโมสรนักศึกษา
  | 'science_faculty'      // คณะวิทยาศาสตร์
  | 'engineering_faculty'  // คณะวิศวกรรมศาสตร์
  | 'business_faculty'     // คณะบริหารธุรกิจ
  | 'liberal_arts_faculty' // คณะศิลปศาสตร์
  | 'education_faculty'    // คณะครุศาสตร์
  | 'clubs'               // ชมรม
  | 'communities'         // ชุมชน
  | 'all';                // ทุกสังกัด (สำหรับ super admin)

export type AdminPermission = 
  | 'manage_users'         // จัดการผู้ใช้
  | 'manage_activities'    // จัดการกิจกรรม
  | 'view_reports'         // ดูรายงาน
  | 'export_data'          // ส่งออกข้อมูล
  | 'manage_admins'        // จัดการแอดมิน (super admin เท่านั้น)
  | 'system_settings'      // ตั้งค่าระบบ
  | 'moderate_content';    // ดูแลเนื้อหา

export const DEPARTMENT_LABELS: Record<AdminDepartment, string> = {
  student_union: 'สโมสรนักศึกษา',
  science_faculty: 'คณะวิทยาศาสตร์',
  engineering_faculty: 'คณะวิศวกรรมศาสตร์',
  business_faculty: 'คณะบริหารธุรกิจ',
  liberal_arts_faculty: 'คณะศิลปศาสตร์',
  education_faculty: 'คณะครุศาสตร์',
  clubs: 'ชมรม',
  communities: 'ชุมชน',
  all: 'ทุกสังกัด'
};

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'ผู้ดูแลระบบสูงสุด',
  department_admin: 'ผู้ดูแลแผนก',
  moderator: 'ผู้ดูแล',
  viewer: 'ผู้ดู'
};

export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  super_admin: [
    'manage_users', 'manage_activities', 'view_reports', 
    'export_data', 'manage_admins', 'system_settings', 'moderate_content'
  ],
  department_admin: [
    'manage_users', 'manage_activities', 'view_reports', 
    'export_data', 'moderate_content'
  ],
  moderator: [
    'manage_activities', 'view_reports', 'moderate_content'
  ],
  viewer: [
    'view_reports'
  ]
};



