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

// ===== Helpers (normalize/compare department) =====

// ช่วย normalize string
const norm = (v: string) => String(v ?? '').trim().toLowerCase();

// reverse map: label(TH) -> key
const LABEL_TO_KEY: Record<string, AdminDepartment> = Object.entries(DEPARTMENT_LABELS)
  .reduce((acc, [k, v]) => {
    acc[norm(v)] = k as AdminDepartment;
    return acc;
  }, {} as Record<string, AdminDepartment>);

// คำพ้อง/คีย์เวิร์ดที่เจอบ่อย (TH/EN) -> key
const KEYWORDS: Array<[AdminDepartment, string[]]> = [
  ['science_faculty', [
    'คณะวิทยาศาสตร์', 'วิทยาศาสตร์', 'วิทยา', 'วิทย์',
    'วิทยาการคอมพิวเตอร์', 'คอมพิวเตอร์', 'computer', 'science', 'sci'
  ]],
  ['engineering_faculty', [
    'คณะวิศวกรรมศาสตร์', 'วิศวกรรม', 'วิศว', 'engineering', 'engineer', 'eng'
  ]],
  ['business_faculty', [
    'คณะบริหารธุรกิจ', 'บริหารธุรกิจ', 'บริหาร', 'การบัญชี', 'การเงิน',
    'business', 'management', 'account', 'finance', 'biz'
  ]],
  ['liberal_arts_faculty', [
    'คณะศิลปศาสตร์', 'ศิลปศาสตร์', 'มนุษยศาสตร์', 'liberal arts', 'arts', 'la'
  ]],
  ['education_faculty', [
    'คณะครุศาสตร์', 'ครุศาสตร์', 'ศึกษาศาสตร์', 'education', 'edu'
  ]],
  ['student_union', [
    'สโมสรนักศึกษา', 'สโมสร', 'student union', 'union', 'student'
  ]],
  ['clubs', ['ชมรม', 'club', 'clubs']],
  ['communities', ['ชุมชน', 'community', 'communities']],
  ['all', ['ทุกสังกัด', 'ทั้งหมด', 'all']]
];

// legacy map แบบตรงตัว (คีย์สั้น ๆ เก่า)
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

/**
 * รับค่ามาหลายรูปแบบ (คีย์, ชื่อไทย, คำพ้อง, คำย่อ)
 * แล้วแปลงเป็นคีย์มาตรฐานของระบบ
 */
export const normalizeDepartment = (input: string | null | undefined): AdminDepartment => {
  if (!input) return 'all';
  const raw = String(input).trim();
  const lower = norm(raw);

  // 1) ถ้าเป็น key ที่ระบบรู้จักอยู่แล้ว
  if ((DEPARTMENTS as string[]).includes(raw)) return raw as AdminDepartment;

  // 2) ถ้าตรงกับ label ไทยแบบ exact
  if (LABEL_TO_KEY[lower]) return LABEL_TO_KEY[lower];

  // 3) legacy สั้น ๆ
  if (LEGACY_DEPARTMENT_MAP[lower]) return LEGACY_DEPARTMENT_MAP[lower];

  // 4) keyword matching (contains)
  for (const [key, kws] of KEYWORDS) {
    if (kws.some(k => lower.includes(norm(k)))) return key;
  }

  // ไม่แมตช์อะไรเลย -> all (กันพัง)
  return 'all';
};

/** เทียบสองค่าที่อาจมาคนละรูปแบบ ว่าเป็นสังกัดเดียวกันหรือไม่ */
export const deptEquals = (a: string | null | undefined, b: string | null | undefined) =>
  normalizeDepartment(a) === normalizeDepartment(b);

/** คืน label ไทยตามคีย์/อินพุตที่ให้มา */
export const getDepartmentLabel = (dep: string | AdminDepartment): string =>
  DEPARTMENT_LABELS[normalizeDepartment(dep as string)];

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

  /** พิกัดโฟกัสรูปโปรไฟล์ (เปอร์เซ็นต์ 0–100), ใช้จัดตำแหน่งรูป 1:1 */
  profileImagePosX?: number;
  profileImagePosY?: number;
}