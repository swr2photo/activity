// src/lib/adminFirebase.ts
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  increment,
  addDoc,
  serverTimestamp,
  setDoc,
  getDoc,
  runTransaction,
  onSnapshot,
  limit as qLimit,
  deleteField,
} from 'firebase/firestore';

import { db, auth } from './firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';

import type {
  AdminDepartment,
  AdminProfile,
  AdminRole,
  AdminPermission,
} from '../types/admin';
import { ROLE_PERMISSIONS } from '../types/admin';

/* =========================
 * Constants & Utils
 * ========================= */
const PRIMARY_ACTIVITY_COLLECTION = 'activityQRCodes';
const LEGACY_ACTIVITY_COLLECTION  = 'activities';

const toDateSafe = (v: any): Date | undefined => {
  if (v?.toDate) return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v === 'number' || typeof v === 'string') {
    const d = new Date(v);
    return isNaN(+d) ? undefined : d;
  }
  return undefined;
};

// ตัด key undefined ออกก่อนส่งเข้า Firestore
const stripUndefined = (obj: Record<string, any>) => {
  const out: Record<string, any> = {};
  Object.keys(obj).forEach((k) => {
    if (obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
};

// clamp ค่าเปอร์เซ็นต์สำหรับตำแหน่งรูป (0–100)
const clampPercent = (v?: number) =>
  typeof v === 'number' ? Math.max(0, Math.min(100, v)) : undefined;

// สิทธิ์: เฉพาะ super_admin เท่านั้น
export const requireSuperAdmin = (admin?: { role?: AdminRole }) => admin?.role === 'super_admin';

async function mirrorLegacyActivityByCode(
  activityCode: string,
  patch: Record<string, any>
) {
  try {
    const q1 = query(collection(db, LEGACY_ACTIVITY_COLLECTION), where('activityCode', '==', activityCode));
    const snap = await getDocs(q1);
    if (!snap.empty) {
      await updateDoc(doc(db, LEGACY_ACTIVITY_COLLECTION, snap.docs[0].id), stripUndefined(patch));
    }
  } catch {
    /* best-effort mirroring only */
  }
}

/* =========================
 * Admins (adminUsers)
 * ========================= */
// ดึงแอดมินทั้งหมด (แผน super_admin ใช้)
export const getAllAdmins = async (): Promise<AdminProfile[]> => {
  const snap = await getDocs(collection(db, 'adminUsers'));
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      uid: d.id,
      email: data.email ?? '',
      displayName: data.displayName ?? '',
      firstName: data.firstName ?? '',
      lastName: data.lastName ?? '',
      role: data.role as AdminRole,
      department: data.department as AdminDepartment,
      permissions: Array.isArray(data.permissions)
        ? (data.permissions as AdminPermission[])
        : (ROLE_PERMISSIONS[data.role as AdminRole] ?? []),
      isActive: data.isActive ?? true,
      createdAt: toDateSafe(data.createdAt) ?? new Date(),
      updatedAt: toDateSafe(data.updatedAt) ?? new Date(),
      createdBy: data.createdBy,
      lastLoginAt: toDateSafe(data.lastLoginAt),
      profileImage: data.profileImage,
      // ✅ รองรับฟิลด์ตำแหน่งรูป
      profileImagePosX: typeof data.profileImagePosX === 'number' ? clampPercent(data.profileImagePosX) : undefined,
      profileImagePosY: typeof data.profileImagePosY === 'number' ? clampPercent(data.profileImagePosY) : undefined,
    } as AdminProfile;
  });
};

// ดึงแอดมินตามสังกัด
export const getAdminsByDepartment = async (
  department: AdminDepartment
): Promise<AdminProfile[]> => {
  if (department === 'all') return getAllAdmins();
  const qy = query(collection(db, 'adminUsers'), where('department', '==', department));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      uid: d.id,
      email: data.email ?? '',
      displayName: data.displayName ?? '',
      firstName: data.firstName ?? '',
      lastName: data.lastName ?? '',
      role: data.role as AdminRole,
      department: data.department as AdminDepartment,
      permissions: Array.isArray(data.permissions)
        ? (data.permissions as AdminPermission[])
        : (ROLE_PERMISSIONS[data.role as AdminRole] ?? []),
      isActive: data.isActive ?? true,
      createdAt: toDateSafe(data.createdAt) ?? new Date(),
      updatedAt: toDateSafe(data.updatedAt) ?? new Date(),
      createdBy: data.createdBy,
      lastLoginAt: toDateSafe(data.lastLoginAt),
      profileImage: data.profileImage,
      // ✅ รองรับฟิลด์ตำแหน่งรูป
      profileImagePosX: typeof data.profileImagePosX === 'number' ? clampPercent(data.profileImagePosX) : undefined,
      profileImagePosY: typeof data.profileImagePosY === 'number' ? clampPercent(data.profileImagePosY) : undefined,
    } as AdminProfile;
  });
};

// สร้างแอดมิน (ต้องทราบ uid ของผู้ใช้ใน Auth)
export const createAdminUser = async (
  profile: Omit<AdminProfile, 'createdAt' | 'updatedAt'> & { uid: string }
) => {
  const ref = doc(db, 'adminUsers', profile.uid);
  const payload = stripUndefined({
    ...profile,
    // ป้องกัน permissions เป็น null/undefined
    permissions: Array.isArray(profile.permissions) ? profile.permissions : [],
    // clamp พิกัด ถ้ามี
    profileImagePosX: clampPercent((profile as any).profileImagePosX),
    profileImagePosY: clampPercent((profile as any).profileImagePosY),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await setDoc(ref, payload, { merge: false });
};

// แก้ไขแอดมิน — กัน undefined / ลบฟิลด์รูปว่าง / clamp พิกัด
export const updateAdminUser = async (uid: string, data: Partial<AdminProfile>) => {
  const ref = doc(db, 'adminUsers', uid);
  const payload: Record<string, any> = {
    ...data,
    // ✅ clamp พิกัดตำแหน่งรูป (ถ้าส่งมา)
    profileImagePosX: clampPercent((data as any).profileImagePosX),
    profileImagePosY: clampPercent((data as any).profileImagePosY),
    updatedAt: serverTimestamp(),
  };

  if ('permissions' in data) {
    payload.permissions = Array.isArray(data.permissions) ? data.permissions : [];
  }

  // ถ้าจะลบรูป: ให้ลบฟิลด์ใน Firestore
  if ('profileImage' in data && (data.profileImage === '' || data.profileImage === undefined)) {
    payload.profileImage = deleteField();
  }

  await updateDoc(ref, stripUndefined(payload));
};

// ลบแอดมิน
export const deleteAdminUser = async (uid: string) => {
  await deleteDoc(doc(db, 'adminUsers', uid));
};

/* =========================
 * Activities
 * ========================= */
export interface Activity {
  id: string;
  activityName: string;
  activityCode: string;
  userCode?: string;
  description?: string;
  bannerUrl?: string;
  bannerAspect?: 'cover' | 'contain';
  location?: string;
  startDateTime?: Date;
  endDateTime?: Date;
  checkInRadius?: number;
  maxParticipants?: number;
  currentParticipants?: number;
  isActive: boolean;
  qrUrl?: string;
  department?: AdminDepartment | string;
  createdAt?: Date;
  closeReason?: string;
  stateVersion?: number;
  forceRefresh?: boolean;
  singleUserMode?: boolean;
  requiresUniversityLogin?: boolean;
}

export interface ActivityRecord {
  id: string;
  timestamp: Date;
  studentId: string;
  firstName: string;
  lastName: string;
  department: AdminDepartment | string;
  activityCode: string;
  faculty?: string;
}

export interface UnivUser {
  uid: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  studentId?: string;
  faculty?: string;
  department?: AdminDepartment | string;
  degreeLevel?: string;
  isVerified: boolean;
  isActive: boolean;
  photoURL?: string;
  createdAt?: Date;
}

// ดึงทั้งหมดจากคอลเลกชันหลัก (fallback ไป legacy ถ้าไม่มี)
export const getAllActivities = async (): Promise<Activity[]> => {
  let snap = await getDocs(collection(db, PRIMARY_ACTIVITY_COLLECTION));
  if (snap.empty) {
    snap = await getDocs(collection(db, LEGACY_ACTIVITY_COLLECTION));
  }
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      activityName: data.activityName ?? '',
      activityCode: data.activityCode ?? '',
      userCode: data.userCode,
      description: data.description,
      bannerUrl: data.bannerUrl,
      bannerAspect: data.bannerAspect || 'cover',
      location: data.location,
      startDateTime: toDateSafe(data.startDateTime),
      endDateTime: toDateSafe(data.endDateTime),
      checkInRadius: data.checkInRadius ?? 50,
      maxParticipants: data.maxParticipants ?? 0,
      currentParticipants: data.currentParticipants ?? 0,
      isActive: data.isActive ?? true,
      qrUrl: data.qrUrl || data.qrCode || '',
      department: data.department,
      createdAt: toDateSafe(data.createdAt),
      closeReason: data.closeReason,
      stateVersion: data.stateVersion,
      forceRefresh: data.forceRefresh === true,
      singleUserMode: data.singleUserMode === true,
      requiresUniversityLogin: data.requiresUniversityLogin === true,
    } as Activity;
  });
};

export const getActivitiesByDepartment = async (
  department: AdminDepartment
): Promise<Activity[]> => {
  if (department === 'all') return getAllActivities();

  // primary first
  let qy = query(
    collection(db, PRIMARY_ACTIVITY_COLLECTION),
    where('department', '==', department)
  );
  let snap = await getDocs(qy);

  if (snap.empty) {
    // legacy fallback
    qy = query(
      collection(db, LEGACY_ACTIVITY_COLLECTION),
      where('department', '==', department)
    );
    snap = await getDocs(qy);
  }

  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      activityName: data.activityName ?? '',
      activityCode: data.activityCode ?? '',
      userCode: data.userCode,
      description: data.description,
      bannerUrl: data.bannerUrl,
      bannerAspect: data.bannerAspect || 'cover',
      location: data.location,
      startDateTime: toDateSafe(data.startDateTime),
      endDateTime: toDateSafe(data.endDateTime),
      checkInRadius: data.checkInRadius ?? 50,
      maxParticipants: data.maxParticipants ?? 0,
      currentParticipants: data.currentParticipants ?? 0,
      isActive: data.isActive ?? true,
      qrUrl: data.qrUrl || data.qrCode || '',
      department: data.department,
      createdAt: toDateSafe(data.createdAt),
      closeReason: data.closeReason,
      stateVersion: data.stateVersion,
      forceRefresh: data.forceRefresh === true,
      singleUserMode: data.singleUserMode === true,
      requiresUniversityLogin: data.requiresUniversityLogin === true,
    } as Activity;
  });
};

/** เดิม: toggle ธรรมดา (คงไว้เพื่อ backward compatibility) */
export const toggleActivityStatus = async (activityId: string, currentStatus: boolean) => {
  await updateDoc(doc(db, PRIMARY_ACTIVITY_COLLECTION, activityId), { isActive: !currentStatus });
};

/** ใหม่: Toggle แบบ Transaction + version bump + เหตุผลปิด + ผู้แก้ไข */
export const toggleActivityLive = async (
  activityId: string,
  nextIsActive: boolean,
  admin: { uid?: string; email?: string } = {}
) => {
  const ref = doc(db, PRIMARY_ACTIVITY_COLLECTION, activityId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('NOT_FOUND');

    const cur = snap.data() as any;
    const activityCode = cur?.activityCode as string | undefined;

    tx.update(ref, {
      isActive: nextIsActive,
      closeReason: nextIsActive ? (cur.closeReason || '') : (cur.closeReason || 'ปิดรับลงทะเบียนแล้ว'),
      lastToggledAt: serverTimestamp(),
      lastToggledBy: admin?.uid || admin?.email || 'unknown_admin',
      stateVersion: Number(cur?.stateVersion || 0) + 1,
      updatedAt: serverTimestamp(),
    });

    // mirror legacy (best-effort)
    if (activityCode) {
      try {
        await mirrorLegacyActivityByCode(activityCode, {
          isActive: nextIsActive,
          closeReason: nextIsActive ? (cur.closeReason || '') : (cur.closeReason || 'ปิดรับลงทะเบียนแล้ว'),
          lastToggledAt: serverTimestamp(),
          lastToggledBy: admin?.uid || admin?.email || 'unknown_admin',
          updatedAt: serverTimestamp(),
        });
      } catch {
        /* ignore */
      }
    }
  });
};

// Create/Update/Delete Activities (เขียนที่ PRIMARY_ACTIVITY_COLLECTION)
export type CreateActivityInput = {
  activityName: string;
  activityCode: string;
  userCode?: string;
  description?: string;
  bannerUrl?: string;
  bannerAspect?: 'cover' | 'contain';
  location?: string;
  startDateTime?: Date;
  endDateTime?: Date;
  checkInRadius?: number;
  maxParticipants?: number;
  isActive?: boolean;
  qrUrl?: string;
  department?: string;
  forceRefresh?: boolean;
  singleUserMode?: boolean;
  requiresUniversityLogin?: boolean;
};

export type UpdateActivityInput = Partial<CreateActivityInput> & {
  closeReason?: string;
};

export const createActivity = async (payload: CreateActivityInput) => {
  const data = stripUndefined({
    ...payload,
    currentParticipants: 0,
    isActive: payload.isActive ?? true,
    bannerAspect: payload.bannerAspect || 'cover',
    stateVersion: 1,
    closeReason: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, PRIMARY_ACTIVITY_COLLECTION), data);
};

export const updateActivity = async (activityId: string, patch: UpdateActivityInput) => {
  const cleaned = stripUndefined({
    ...patch,
    updatedAt: serverTimestamp(),
    stateVersion: increment(1),
  });

  await updateDoc(doc(db, PRIMARY_ACTIVITY_COLLECTION, activityId), cleaned);

  // mirror legacy ตาม activityCode ถ้ามีใน patch (best-effort)
  try {
    const cur = await getDoc(doc(db, PRIMARY_ACTIVITY_COLLECTION, activityId));
    const code = cur.data()?.activityCode as string | undefined;
    if (code) {
      await mirrorLegacyActivityByCode(code, stripUndefined({
        ...patch,
        updatedAt: serverTimestamp(),
      }));
    }
  } catch {
    /* ignore */
  }
};

export const deleteActivity = async (activityId: string) => {
  await deleteDoc(doc(db, PRIMARY_ACTIVITY_COLLECTION, activityId));
  // ไม่บังคับลบ legacy
};

/* =========================
 * Activity Records
 * ========================= */
export const getAllActivityRecords = async (): Promise<ActivityRecord[]> => {
  const qy = query(collection(db, 'activityRecords'), orderBy('timestamp', 'desc'));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      timestamp: toDateSafe(data.timestamp) ?? new Date(),
      studentId: data.studentId ?? '',
      firstName: data.firstName ?? '',
      lastName: data.lastName ?? '',
      department: data.department ?? '',
      activityCode: data.activityCode ?? '',
      faculty: data.faculty,
    } as ActivityRecord;
  });
};

export const getActivityRecordsByDepartment = async (
  department: AdminDepartment
): Promise<ActivityRecord[]> => {
  if (department === 'all') return getAllActivityRecords();
  const qy = query(
    collection(db, 'activityRecords'),
    where('department', '==', department),
    orderBy('timestamp', 'desc')
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      timestamp: toDateSafe(data.timestamp) ?? new Date(),
      studentId: data.studentId ?? '',
      firstName: data.firstName ?? '',
      lastName: data.lastName ?? '',
      department: data.department ?? '',
      activityCode: data.activityCode ?? '',
      faculty: data.faculty,
    } as ActivityRecord;
  });
};

export const deleteActivityRecord = async (recordId: string): Promise<void> => {
  await deleteDoc(doc(db, 'activityRecords', recordId));
};

// ปรับจำนวนผู้เข้าร่วมจาก activityCode — อัปเดตที่ PRIMARY เป็นหลัก (fallback legacy)
export const adjustParticipantsByActivityCode = async (
  activityCode: string,
  delta: number
): Promise<void> => {
  // primary
  let q1 = query(collection(db, PRIMARY_ACTIVITY_COLLECTION), where('activityCode', '==', activityCode));
  let snap = await getDocs(q1);

  if (!snap.empty) {
    const aDoc = snap.docs[0];
    await updateDoc(doc(db, PRIMARY_ACTIVITY_COLLECTION, aDoc.id), {
      currentParticipants: increment(delta),
      updatedAt: serverTimestamp(),
      stateVersion: increment(1),
    });
    return;
  }

  // legacy fallback
  const q2 = query(collection(db, LEGACY_ACTIVITY_COLLECTION), where('activityCode', '==', activityCode));
  snap = await getDocs(q2);
  if (!snap.empty) {
    const aDoc = snap.docs[0];
    await updateDoc(doc(db, LEGACY_ACTIVITY_COLLECTION, aDoc.id), {
      currentParticipants: increment(delta),
      updatedAt: serverTimestamp(),
    });
  }
};

/* =========================
 * Users
 * ========================= */
export const getAllUsers = async (): Promise<UnivUser[]> => {
  const snap = await getDocs(collection(db, 'universityUsers'));
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      uid: d.id,
      displayName: data.displayName,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      studentId: data.studentId,
      faculty: data.faculty,
      department: data.department,
      degreeLevel: data.degreeLevel,
      isVerified: data.isVerified ?? false,
      isActive: data.isActive ?? true,
      photoURL: data.photoURL,
      createdAt: toDateSafe(data.createdAt),
    } as UnivUser;
  });
};

export const getPendingUsers = async (): Promise<UnivUser[]> => {
  const qy = query(collection(db, 'universityUsers'), where('isVerified', '==', false));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      uid: d.id,
      displayName: data.displayName,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      studentId: data.studentId,
      faculty: data.faculty,
      department: data.department,
      degreeLevel: data.degreeLevel,
      isVerified: data.isVerified ?? false,
      isActive: data.isActive ?? true,
      photoURL: data.photoURL,
      createdAt: toDateSafe(data.createdAt),
    } as UnivUser;
  });
};

export const getUsersByDepartment = async (
  department: AdminDepartment
): Promise<UnivUser[]> => {
  if (department === 'all') return getAllUsers();
  const qy = query(collection(db, 'universityUsers'), where('department', '==', department));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      uid: d.id,
      displayName: data.displayName,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      studentId: data.studentId,
      faculty: data.faculty,
      department: data.department,
      degreeLevel: data.degreeLevel,
      isVerified: data.isVerified ?? false,
      isActive: data.isActive ?? true,
      photoURL: data.photoURL,
      createdAt: toDateSafe(data.createdAt),
    } as UnivUser;
  });
};

export const getPendingUsersByDepartment = async (
  department: AdminDepartment
): Promise<UnivUser[]> => {
  if (department === 'all') return getPendingUsers();
  const qy = query(
    collection(db, 'universityUsers'),
    where('department', '==', department),
    where('isVerified', '==', false)
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      uid: d.id,
      displayName: data.displayName,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      studentId: data.studentId,
      faculty: data.faculty,
      department: data.department,
      degreeLevel: data.degreeLevel,
      isVerified: data.isVerified ?? false,
      isActive: data.isActive ?? true,
      photoURL: data.photoURL,
      createdAt: toDateSafe(data.createdAt),
    } as UnivUser;
  });
};

/* =========================
 * User status
 * ========================= */
export const approveUser = async (uid: string): Promise<void> => {
  await updateDoc(doc(db, 'universityUsers', uid), { isVerified: true, isActive: true });
};

export const suspendUser = async (uid: string): Promise<void> => {
  await updateDoc(doc(db, 'universityUsers', uid), { isActive: false });
};

/* =========================
 * Logging (admin events)
 * ========================= */
export const logAdminEvent = async (
  action: string,
  meta: Record<string, any> = {},
  actor?: { uid?: string; email?: string }
) => {
  try {
    await addDoc(collection(db, 'logs'), {
      action,               // e.g. 'LOGIN', 'LOGOUT', 'ADMIN_PROMOTE', 'APPROVE_USER', 'EXPORT_USERS', ...
      meta,                 // payload เพิ่มเติม
      actorUid: actor?.uid ?? null,
      actorEmail: actor?.email ?? null,
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      at: serverTimestamp(),
    });
  } catch (e) {
    console.warn('logAdminEvent failed:', e);
  }
};

/* ===== Logs helper: get + subscribe realtime ===== */
export interface AdminLogEntry {
  id: string;
  action: string;
  meta?: Record<string, any>;
  actorUid?: string | null;
  actorEmail?: string | null;
  ua?: string;
  at?: Date;
}

export async function getAdminLogs(max: number = 100): Promise<AdminLogEntry[]> {
  const qy = query(collection(db, 'logs'), orderBy('at', 'desc'), qLimit(max));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => {
    const v = d.data() as any;
    return {
      id: d.id,
      action: v.action || '',
      meta: v.meta || {},
      actorUid: v.actorUid ?? null,
      actorEmail: v.actorEmail ?? null,
      ua: v.ua || '',
      at: toDateSafe(v.at),
    } as AdminLogEntry;
  });
}

/**
 * subscribeAdminLogs – สำหรับหน้า Admin Logs
 * @param cb callback ได้รายการเรียงเวลาล่าสุด
 * @param max จำนวนสูงสุด
 */
export function subscribeAdminLogs(cb: (rows: AdminLogEntry[]) => void, max: number = 100) {
  const qy = query(collection(db, 'logs'), orderBy('at', 'desc'), qLimit(max));
  return onSnapshot(qy, (snap) => {
    const rows = snap.docs.map((d) => {
      const v = d.data() as any;
      return {
        id: d.id,
        action: v.action || '',
        meta: v.meta || {},
        actorUid: v.actorUid ?? null,
        actorEmail: v.actorEmail ?? null,
        ua: v.ua || '',
        at: toDateSafe(v.at),
      } as AdminLogEntry;
    });
    cb(rows);
  });
}

/* =========================
 * Invites
 * ========================= */
export type InviteStatus = 'pending' | 'accepted' | 'cancelled' | 'expired';

export interface AdminInvite {
  id: string;
  email: string;
  role: AdminRole;
  department: AdminDepartment;
  permissions: AdminPermission[];
  invitedByUid: string;
  invitedByEmail?: string;
  status: InviteStatus;
  token: string;
  createdAt?: Date;
  expiresAt?: Date;
  acceptedAt?: Date;
  acceptedByUid?: string;
}

const genToken = () =>
  Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);

// สร้างคำเชิญ (return token สำหรับแนบลิงก์)
export const createAdminInvite = async (payload: {
  email: string;
  role: AdminRole;
  department: AdminDepartment;
  permissions: AdminPermission[];
  invitedByUid: string;
  invitedByEmail?: string;
}): Promise<string> => {
  const token = genToken();
  const data = {
    ...payload,
    status: 'pending' as InviteStatus,
    token,
    createdAt: serverTimestamp(),
    // อายุคำเชิญ 14 วัน
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  };
  await addDoc(collection(db, 'adminInvites'), data);
  return token;
};

// ดึงคำเชิญตามสังกัด (หรือ 'all' สำหรับ super admin)
export const getAdminInvitesByDepartment = async (
  dept: AdminDepartment | 'all'
): Promise<AdminInvite[]> => {
  let snap;
  if (dept === 'all') {
    snap = await getDocs(collection(db, 'adminInvites'));
  } else {
    const qy = query(collection(db, 'adminInvites'), where('department', '==', dept));
    snap = await getDocs(qy);
  }
  return snap.docs.map((d) => {
    const v = d.data() as any;
    return {
      id: d.id,
      email: v.email,
      role: v.role,
      department: v.department,
      permissions: (v.permissions || []) as AdminPermission[],
      invitedByUid: v.invitedByUid,
      invitedByEmail: v.invitedByEmail,
      status: (v.status || 'pending') as InviteStatus,
      token: v.token,
      createdAt: v.createdAt?.toDate?.() ?? (v.createdAt instanceof Date ? v.createdAt : undefined),
      expiresAt: v.expiresAt?.toDate?.() ?? (v.expiresAt instanceof Date ? v.expiresAt : undefined),
      acceptedAt: v.acceptedAt?.toDate?.() ?? (v.acceptedAt instanceof Date ? v.acceptedAt : undefined),
      acceptedByUid: v.acceptedByUid,
    } as AdminInvite;
  });
};

// ยกเลิกคำเชิญ
export const cancelAdminInvite = async (inviteId: string): Promise<void> => {
  await updateDoc(doc(db, 'adminInvites', inviteId), {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  });
};

// รับคำเชิญด้วย token
export const acceptAdminInviteByToken = async (
  token: string,
  uid: string
): Promise<AdminInvite | null> => {
  const qy = query(
    collection(db, 'adminInvites'),
    where('token', '==', token),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(qy);
  if (snap.empty) return null;
  const d = snap.docs[0];
  const v = d.data() as any;

  await updateDoc(doc(db, 'adminInvites', d.id), {
    status: 'accepted',
    acceptedAt: serverTimestamp(),
    acceptedByUid: uid,
  });

  return {
    id: d.id,
    email: v.email,
    role: v.role,
    department: v.department,
    permissions: (v.permissions || []) as AdminPermission[],
    invitedByUid: v.invitedByUid,
    invitedByEmail: v.invitedByEmail,
    status: 'accepted',
    token: v.token,
    createdAt: v.createdAt?.toDate?.(),
    expiresAt: v.expiresAt?.toDate?.(),
    acceptedAt: new Date(),
    acceptedByUid: uid,
  } as AdminInvite;
};

/* =========================
 * Auth helpers (for useAdminAuth)
 * ========================= */
const ADMIN_COLLECTIONS = ['adminUsers', 'admins'] as const;

type RawAdminDoc = Partial<AdminProfile> & {
  permissions?: string[];
};

const toAdminProfileFrom = (user: User, raw: RawAdminDoc): AdminProfile => ({
  uid: user.uid,
  email: user.email ?? raw.email ?? '',
  displayName: user.displayName ?? raw.displayName ?? '',
  firstName: raw.firstName ?? '',
  lastName: raw.lastName ?? '',
  role: (raw.role as AdminRole) ?? 'viewer',
  department: (raw.department as AdminDepartment) ?? 'all',
  permissions: Array.isArray(raw.permissions)
    ? (raw.permissions as AdminPermission[])
    : (ROLE_PERMISSIONS[(raw.role as AdminRole) ?? 'viewer'] ?? []),
  isActive: raw.isActive ?? true,
  createdAt: raw.createdAt ?? null,
  updatedAt: raw.updatedAt ?? null,
  createdBy: raw.createdBy,
  lastLoginAt: raw.lastLoginAt ?? null,
  profileImage: raw.profileImage,
  // ✅ map ค่าพิกัดจากเอกสาร (ถ้าไม่มี = undefined)
  profileImagePosX: typeof (raw as any).profileImagePosX === 'number'
    ? clampPercent((raw as any).profileImagePosX)
    : undefined,
  profileImagePosY: typeof (raw as any).profileImagePosY === 'number'
    ? clampPercent((raw as any).profileImagePosY)
    : undefined,
});

async function readAdminDoc(uid: string) {
  for (const col of ADMIN_COLLECTIONS) {
    const ref = doc(db, col, uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return { ref, data: snap.data() as RawAdminDoc };
  }
  return { ref: null as any, data: null as RawAdminDoc | null };
}

async function waitForAuthUser(): Promise<User | null> {
  if (auth.currentUser) return auth.currentUser;
  return await new Promise<User | null>((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      resolve(u);
    });
  });
}

export async function getCurrentAdmin(): Promise<AdminProfile | null> {
  const user = await waitForAuthUser();
  if (!user) return null;
  const { data } = await readAdminDoc(user.uid);
  if (!data) throw new Error('NOT_ADMIN');
  if (data.isActive === false) throw new Error('ADMIN_DISABLED');
  return toAdminProfileFrom(user, data);
}

export async function signInAdmin(
  email: string,
  password: string
): Promise<AdminProfile> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const user = cred.user;

  const { data, ref } = await readAdminDoc(user.uid);
  if (!data) {
    await fbSignOut(auth);
    throw new Error('NOT_ADMIN');
  }
  if (data.isActive === false) {
    await fbSignOut(auth);
    throw new Error('ADMIN_DISABLED');
  }

  try {
    if (ref) {
      await updateDoc(ref, stripUndefined({
        lastLoginAt: serverTimestamp(),
        email: user.email ?? (data as any).email ?? email,
        updatedAt: serverTimestamp(),
      }));
    }
  } catch {
    /* ignore write-permission errors */
  }

  return toAdminProfileFrom(user, data);
}

export async function signOutAdmin(): Promise<void> {
  await fbSignOut(auth);
}

/* =========================
 * System Settings (Maintenance + Banner Standard)
 * ========================= */
export interface SystemSettings {
  maintenanceEnabled: boolean;
  maintenanceMessage?: string;
  maintenanceWhitelist?: string[]; // รายการอีเมล/uid ที่ยังเข้าได้ตอนปิดปรับปรุง
  bannerStandardWidth?: number;    // ขนาดมาตรฐานของแบนเนอร์
  bannerStandardHeight?: number;   // ขนาดมาตรฐานของแบนเนอร์
  bannerFit?: 'cover' | 'contain'; // วิธีแสดงผล
  updatedAt?: Date;
}

const SYSTEM_SETTINGS_DOC = doc(db, 'systemSettings', 'global');

export async function getSystemSettings(): Promise<SystemSettings> {
  const s = await getDoc(SYSTEM_SETTINGS_DOC);
  const d = s.exists() ? (s.data() as any) : {};
  return {
    maintenanceEnabled: !!d.maintenanceEnabled,
    maintenanceMessage: d.maintenanceMessage || '',
    maintenanceWhitelist: Array.isArray(d.maintenanceWhitelist) ? d.maintenanceWhitelist : [],
    bannerStandardWidth: typeof d.bannerStandardWidth === 'number' ? d.bannerStandardWidth : 1600,
    bannerStandardHeight: typeof d.bannerStandardHeight === 'number' ? d.bannerStandardHeight : 600,
    bannerFit: d.bannerFit === 'contain' ? 'contain' : 'cover',
    updatedAt: toDateSafe(d.updatedAt) ?? undefined,
  };
}

export async function updateSystemSettings(patch: Partial<SystemSettings>): Promise<void> {
  try {
    await updateDoc(SYSTEM_SETTINGS_DOC, stripUndefined({
      ...patch,
      updatedAt: serverTimestamp(),
    }));
  } catch (e: any) {
    // ถ้า doc ยังไม่เคยมี ให้ set ครั้งแรก
    if (e?.code === 'not-found') {
      await setDoc(SYSTEM_SETTINGS_DOC, stripUndefined({
        maintenanceEnabled: false,
        maintenanceMessage: '',
        maintenanceWhitelist: [],
        bannerStandardWidth: 1600,
        bannerStandardHeight: 600,
        bannerFit: 'cover',
        ...patch,
        updatedAt: serverTimestamp(),
      }));
    } else {
      throw e;
    }
  }
}

export function subscribeSystemSettings(cb: (s: SystemSettings) => void) {
  return onSnapshot(SYSTEM_SETTINGS_DOC, (snap) => {
    const d = snap.exists() ? (snap.data() as any) : {};
    cb({
      maintenanceEnabled: !!d.maintenanceEnabled,
      maintenanceMessage: d.maintenanceMessage || '',
      maintenanceWhitelist: Array.isArray(d.maintenanceWhitelist) ? d.maintenanceWhitelist : [],
      bannerStandardWidth: typeof d.bannerStandardWidth === 'number' ? d.bannerStandardWidth : 1600,
      bannerStandardHeight: typeof d.bannerStandardHeight === 'number' ? d.bannerStandardHeight : 600,
      bannerFit: d.bannerFit === 'contain' ? 'contain' : 'cover',
      updatedAt: toDateSafe(d.updatedAt) ?? undefined,
    });
  });
}
