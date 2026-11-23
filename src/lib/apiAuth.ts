import { NextRequest } from 'next/server';
import { getAdminAuth, getAdminDb } from './firebaseAdmin';
import { ROLE_PERMISSIONS, type AdminPermission, type AdminRole } from '@/types/admin';

export class ApiAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = 'ApiAuthError';
    this.status = status;
  }
}

type CachedAdmin = {
  expiresAt: number;
  data: Record<string, any>;
};

// แคชข้อมูล admin ชั่วคราว 30 วินาทีในหน่วยความจำ ลดการยิง Firestore ซ้ำเมื่อ poll API
const adminCache = new Map<string, CachedAdmin>();
const ADMIN_CACHE_TTL_MS = 30_000;

/**
 * ตรวจสอบว่าผู้ใช้เข้าสู่ระบบ (Firebase Auth) โดยไม่ต้องเป็น Admin
 */
export async function verifyUserToken(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiAuthError('กรุณาเข้าสู่ระบบก่อนใช้งาน', 401);
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    throw new ApiAuthError('Token is missing', 401);
  }

  try {
    const auth = getAdminAuth();
    const decodedToken = await auth.verifyIdToken(token);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      decodedToken,
    };
  } catch (err: any) {
    throw new ApiAuthError(`Authentication failed: ${err?.message || 'Invalid token'}`, 401);
  }
}

export async function verifyAdminToken(
  req: NextRequest,
  opts?: { requiredPermission?: AdminPermission; allowedRoles?: AdminRole[] }
) {
  const { uid, email, decodedToken } = await verifyUserToken(req);

  const now = Date.now();
  let adminData: Record<string, any> | undefined;
  const cached = adminCache.get(uid);
  if (cached && cached.expiresAt > now) {
    adminData = cached.data;
  } else {
    const db = getAdminDb();
    const adminDoc = await db.collection('adminUsers').doc(uid).get();
    if (!adminDoc.exists) {
      throw new ApiAuthError('Authentication failed: User is not an admin', 403);
    }
    adminData = adminDoc.data() || {};
    adminCache.set(uid, { data: adminData, expiresAt: now + ADMIN_CACHE_TTL_MS });
  }

  if (adminData?.isActive !== true) {
    adminCache.delete(uid);
    if (decodedToken.isActive === true) {
      getAdminAuth()
        .setCustomUserClaims(uid, { role: null, department: null, isActive: false })
        .catch(() => {});
    }
    throw new ApiAuthError('Authentication failed: Admin account is not active', 403);
  }

  const rawRole = String(adminData.role || decodedToken.role || '');
  const role = (rawRole === 'admin' ? 'department_admin' : rawRole) as AdminRole;
  const department = String(adminData.department || 'science_faculty');
  if (
    decodedToken.role !== role ||
    decodedToken.department !== department ||
    decodedToken.isActive !== true
  ) {
    getAdminAuth()
      .setCustomUserClaims(uid, { role, department, isActive: true })
      .catch(() => {});
  }
  const permissions: AdminPermission[] = Array.isArray(adminData.permissions)
    ? adminData.permissions
    : (ROLE_PERMISSIONS[role] ?? []);

  if (opts?.allowedRoles && !opts.allowedRoles.includes(role)) {
    throw new ApiAuthError('Forbidden: insufficient role', 403);
  }

  if (
    opts?.requiredPermission &&
    role !== 'super_admin' &&
    !permissions.includes(opts.requiredPermission)
  ) {
    throw new ApiAuthError(`Forbidden: missing permission ${opts.requiredPermission}`, 403);
  }

  return {
    uid,
    email,
    role,
    department: String(adminData.department || 'science_faculty'),
    permissions,
    adminData,
  };
}
