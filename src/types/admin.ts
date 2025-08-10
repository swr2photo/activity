// ===== Roles / Permissions =====
export type AdminRole = 'super_admin' | 'department_admin' | 'moderator' | 'viewer';

export type AdminPermission =
  | 'manage_users'
  | 'manage_activities'
  | 'view_reports'
  | 'export_data'
  | 'manage_admins'
  | 'system_settings'
  | 'moderate_content';

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
  createdBy?: string;
  lastLoginAt?: any;
  profileImage?: string;
}

// ===== Departments =====
export type AdminDepartment =
  | 'student_union'
  | 'science_faculty'
  | 'engineering_faculty'
  | 'business_faculty'
  | 'liberal_arts_faculty'
  | 'education_faculty'
  | 'clubs'
  | 'communities'
  | 'all';

export const DEPARTMENT_LABELS: Record<AdminDepartment, string> = {
  student_union: 'สโมสรนักศึกษา',
  science_faculty: 'คณะวิทยาศาสตร์',
  engineering_faculty: 'คณะวิศวกรรมศาสตร์',
  business_faculty: 'คณะบริหารธุรกิจ',
  liberal_arts_faculty: 'คณะศิลปศาสตร์',
  education_faculty: 'คณะครุศาสตร์',
  clubs: 'ชมรม',
  communities: 'ชุมชน',
  all: 'ทุกสังกัด',
};

export const DEPARTMENTS: AdminDepartment[] = [
  'student_union',
  'science_faculty',
  'engineering_faculty',
  'business_faculty',
  'liberal_arts_faculty',
  'education_faculty',
  'clubs',
  'communities',
  'all',
];

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'ผู้ดูแลระบบสูงสุด',
  department_admin: 'ผู้ดูแลแผนก',
  moderator: 'ผู้ดูแล',
  viewer: 'ผู้ดู',
};

export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  super_admin: [
    'manage_users', 'manage_activities', 'view_reports',
    'export_data', 'manage_admins', 'system_settings', 'moderate_content',
  ],
  department_admin: [
    'manage_users', 'manage_activities', 'view_reports',
    'export_data', 'moderate_content',
  ],
  moderator: ['manage_activities', 'view_reports', 'moderate_content'],
  viewer: ['view_reports'],
};

export const hasPermission = (admin: AdminProfile, perm: AdminPermission) =>
  (admin.permissions?.includes(perm)) || ROLE_PERMISSIONS[admin.role]?.includes(perm);

// ===== Helpers (รองรับคีย์สังกัดเก่า) =====
const LEGACY_DEPARTMENT_MAP: Record<string, AdminDepartment> = {
  it: 'science_faculty',
  sci: 'science_faculty',
  eng: 'engineering_faculty',
  biz: 'business_faculty',
  arts: 'liberal_arts_faculty',
  edu: 'education_faculty',
  student: 'student_union',
  union: 'student_union',
  club: 'clubs',
  community: 'communities',
  all: 'all',
};

export const normalizeDepartment = (input: string | null | undefined): AdminDepartment => {
  if (!input) return 'all';
  const key = String(input).trim();
  if ((DEPARTMENTS as string[]).includes(key)) return key as AdminDepartment;
  const m = LEGACY_DEPARTMENT_MAP[key] || LEGACY_DEPARTMENT_MAP[key.toLowerCase()];
  return m ?? 'all';
};

export const getDepartmentLabel = (dep: string | AdminDepartment): string =>
  DEPARTMENT_LABELS[normalizeDepartment(dep as string)];
