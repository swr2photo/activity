// types/index.ts

/**
 * ข้อมูลตำแหน่งที่อนุญาต
 */
export interface AllowedLocation {
  endTime: unknown;
  startTime: unknown;
  latitude: number;
  longitude: number;
  radius: number; // รัศมีเป็นเมตร
}

/**
 * การตั้งค่าแอดมิน
 */
export interface AdminSettings {
  id: string;
  allowedLocation: AllowedLocation;
  adminCode: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  description?: string;
}

/**
 * ข้อมูลการลงทะเบียนกิจกรรม
 */
export interface ActivityRecord {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  department: string;
  activityCode: string;
  location: {
    latitude: number;
    longitude: number;
  };
  adminCode: string;
  timestamp: Date;
  notes?: string;
}

/**
 * ข้อมูลสาขา
 */
export interface Department {
  id: string;
  name: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  description?: string;
}

/**
 * ข้อมูลกิจกรรม
 */
export interface Activity {
  id: string;
  code: string;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  location: AllowedLocation;
  isActive: boolean;
  maxParticipants?: number;
  currentParticipants?: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

/**
 * ข้อมูลผู้ใช้แอดมิน
 */
export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'super_admin';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}

/**
 * สถิติการลงทะเบียน
 */
export interface RegistrationStatistics {
  totalRegistrations: number;
  departmentCounts: Record<string, number>;
  dateCounts: Record<string, number>;
  hourCounts: Record<string, number>;
  records: ActivityRecord[];
}

/**
 * ข้อมูลการตั้งค่าระบบ
 */
export interface SystemSettings {
  id: string;
  maintenanceMode: boolean;
  maxRegistrationsPerActivity?: number;
  defaultRadius: number;
  allowedFileTypes: string[];
  maxFileSize: number; // ไบต์
  emailNotifications: boolean;
  smsNotifications: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ข้อมูลการแจ้งเตือน
 */
export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  userId?: string;
  activityCode?: string;
}

/**
 * ข้อมูลการส่งออก
 */
export interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf';
  dateFrom?: Date;
  dateTo?: Date;
  activityCode?: string;
  department?: string;
  includeLocation?: boolean;
}

/**
 * ข้อมูลการนำเข้า
 */
export interface ImportResult {
  success: boolean;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  errors: ImportError[];
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
  value: any;
}

/**
 * ข้อมูลการตรวจสอบตำแหน่ง
 */
export interface LocationCheckResult {
  success: boolean;
  distance?: number;
  withinRadius: boolean;
  userLocation: {
    latitude: number;
    longitude: number;
  };
  targetLocation: AllowedLocation;
  error?: string;
}

/**
 * ตัวเลือกการแบ่งหน้า
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * ผลลัพธ์ที่มีการแบ่งหน้า
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * ข้อมูลการตอบกลับจาก API
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: Date;
}

/**
 * ข้อมูลการตั้งค่าแผนที่
 */
export interface MapSettings {
  defaultCenter: {
    latitude: number;
    longitude: number;
  };
  defaultZoom: number;
  mapStyle: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
  showTraffic: boolean;
  showBuildings: boolean;
}

/**
 * ข้อมูลการล็อกระบบ
 */
export interface SystemLog {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  userId?: string;
  activityCode?: string;
  action?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * ข้อมูลการสำรองข้อมูล
 */
export interface BackupInfo {
  id: string;
  filename: string;
  size: number;
  recordCount: number;
  createdAt: Date;
  createdBy: string;
  description?: string;
  downloadUrl?: string;
}

/**
 * Props สำหรับ Component
 */
export interface ActivityRegistrationFormProps {
  activityCode: string;
  adminSettings: AdminSettings;
  onSuccess?: (record: ActivityRecord) => void;
  onError?: (error: string) => void;
}

export interface LocationCheckerProps {
  allowedLocation: AllowedLocation;
  onLocationVerified: (location: { latitude: number; longitude: number }) => void;
  onLocationError: (error: string) => void;
  timeout?: number;
}

/**
 * State สำหรับ Form
 */
export interface RegistrationFormData {
  studentId: string;
  firstName: string;
  lastName: string;
  department: string;
  adminCode: string;
}

export interface RegistrationFormErrors {
  studentId?: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  adminCode?: string;
  general?: string;
}

/**
 * Context Types
 */
export interface AuthContextType {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<AdminUser>) => Promise<void>;
}

export interface AppContextType {
  adminSettings: AdminSettings | null;
  systemSettings: SystemSettings | null;
  loading: boolean;
  error: string | null;
  refreshSettings: () => Promise<void>;
}

/**
 * Utility Types
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = 
  Pick<T, Exclude<keyof T, Keys>> & 
  { [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>> }[Keys];

/**
 * Firebase Collection Names
 */
export const COLLECTIONS = {
  ADMIN_SETTINGS: 'adminSettings',
  ACTIVITY_RECORDS: 'activityRecords',
  DEPARTMENTS: 'departments',
  ACTIVITIES: 'activities',
  ADMIN_USERS: 'adminUsers',
  SYSTEM_SETTINGS: 'systemSettings',
  NOTIFICATIONS: 'notifications',
  SYSTEM_LOGS: 'systemLogs',
  BACKUPS: 'backups'
} as const;
export interface AdminSettings {
  isActive: boolean;
  bannerUrl?: string;
  publicBannerUrl?: string;
  landingBannerUrl?: string;
  activityDefaultBannerUrl?: string;
  branding?: { bannerUrl?: string };

  // ✅ ใหม่
  bannerAspect?: '16:9' | '4:3' | '21:9';
  bannerOverlay?: number; // 0 - 1 ความทึบ overlay
}

/**
 * Constants
 */
export const VALIDATION_RULES = {
  STUDENT_ID: {
    LENGTH: 10,
    PREFIX_MIN: 64,
    PREFIX_MAX: 69
  },
  NAME: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 50
  },
  ADMIN_CODE: {
    MIN_LENGTH: 4,
    MAX_LENGTH: 20
  },
  ACTIVITY_CODE: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 20
  },
  LOCATION: {
    MAX_RADIUS: 10000, // 10 กิโลเมตร
    MIN_RADIUS: 10     // 10 เมตร
  }
} as const;

export const DEFAULT_SETTINGS = {
  LOCATION: {
    LATITUDE: 7.007373066216206,
    LONGITUDE: 100.4925,
    RADIUS: 100
  },
  ADMIN_CODE: 'ADMIN123',
  MAP_ZOOM: 15
} as const;