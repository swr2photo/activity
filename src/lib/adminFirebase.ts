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
 * Utils
 * ========================= */
const toDateSafe = (v: any): Date | undefined => {
  if (v?.toDate) return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v === 'number' || typeof v === 'string') {
    const d = new Date(v);
    return isNaN(+d) ? undefined : d;
  }
  return undefined;
};

/* =========================
 * Admins (adminUsers)
 * ========================= */
// ดึงแอดมินทั้งหมด (สำหรับ super_admin)
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
    } as AdminProfile;
  });
};

// สร้างแอดมิน (ต้องทราบ uid ของผู้ใช้ใน Auth)
export const createAdminUser = async (
  profile: Omit<AdminProfile, 'createdAt' | 'updatedAt'> & { uid: string }
) => {
  const ref = doc(db, 'adminUsers', profile.uid);
  const payload = {
    ...profile,
    permissions: Array.isArray(profile.permissions) ? profile.permissions : [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload, { merge: false });
};

// แก้ไขแอดมิน
export const updateAdminUser = async (uid: string, data: Partial<AdminProfile>) => {
  const ref = doc(db, 'adminUsers', uid);
  await updateDoc(ref, {
    ...data,
    ...(data.permissions
      ? { permissions: Array.isArray(data.permissions) ? data.permissions : [] }
      : {}),
    updatedAt: serverTimestamp(),
  });
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

export const getAllActivities = async (): Promise<Activity[]> => {
  const snap = await getDocs(collection(db, 'activities'));
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      activityName: data.activityName ?? '',
      activityCode: data.activityCode ?? '',
      userCode: data.userCode,
      description: data.description,
      bannerUrl: data.bannerUrl,
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
    } as Activity;
  });
};

export const getActivitiesByDepartment = async (
  department: AdminDepartment
): Promise<Activity[]> => {
  if (department === 'all') return getAllActivities();
  const qy = query(collection(db, 'activities'), where('department', '==', department));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      activityName: data.activityName ?? '',
      activityCode: data.activityCode ?? '',
      userCode: data.userCode,
      description: data.description,
      bannerUrl: data.bannerUrl,
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
    } as Activity;
  });
};

export const toggleActivityStatus = async (activityId: string, currentStatus: boolean) => {
  const ref = doc(db, 'activities', activityId);
  await updateDoc(ref, { isActive: !currentStatus });
};

// Create/Update/Delete Activities
export type CreateActivityInput = {
  activityName: string;
  activityCode: string;
  userCode?: string;
  description?: string;
  bannerUrl?: string;
  location?: string;
  startDateTime?: Date;
  endDateTime?: Date;
  checkInRadius?: number;
  maxParticipants?: number;
  isActive?: boolean;
  qrUrl?: string;
  department?: string;
};

export type UpdateActivityInput = Partial<CreateActivityInput>;

export const createActivity = async (payload: CreateActivityInput) => {
  const data = {
    ...payload,
    currentParticipants: 0,
    isActive: payload.isActive ?? true,
    createdAt: serverTimestamp(),
  };
  await addDoc(collection(db, 'activities'), data);
};

export const updateActivity = async (activityId: string, patch: UpdateActivityInput) => {
  await updateDoc(doc(db, 'activities', activityId), {
    ...patch,
  });
};

export const deleteActivity = async (activityId: string) => {
  await deleteDoc(doc(db, 'activities', activityId));
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
 * Attendance helpers
 * ========================= */
export const deleteActivityRecord = async (recordId: string): Promise<void> => {
  await deleteDoc(doc(db, 'activityRecords', recordId));
};

// ปรับจำนวนผู้เข้าร่วมจาก activityCode (รองรับทั้ง field 'activityCode' และ 'code')
export const adjustParticipantsByActivityCode = async (
  activityCode: string,
  delta: number
): Promise<void> => {
  // 1) ลองหาโดย activityCode
  let q1 = query(collection(db, 'activities'), where('activityCode', '==', activityCode));
  let snap = await getDocs(q1);

  // 2) ถ้าไม่เจอ ลองหา field 'code'
  if (snap.empty) {
    const q2 = query(collection(db, 'activities'), where('code', '==', activityCode));
    snap = await getDocs(q2);
  }

  if (!snap.empty) {
    const aDoc = snap.docs[0];
    await updateDoc(doc(db, 'activities', aDoc.id), {
      currentParticipants: increment(delta),
    });
  }
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
 * Logging
 * ========================= */
export const logAdminEvent = async (
  action: string,
  meta: Record<string, any> = {},
  actor?: { uid?: string; email?: string }
) => {
  try {
    await addDoc(collection(db, 'logs'), {
      action,               // e.g. 'LOGIN', 'LOGOUT', 'ADMIN_PROMOTE', 'APPROVE_USER', 'EXPORT_USERS'
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
      await updateDoc(ref, {
        lastLoginAt: serverTimestamp(),
        email: user.email ?? data.email ?? email,
        updatedAt: serverTimestamp(),
      });
    }
  } catch {
    /* ignore write-permission errors */
  }

  return toAdminProfileFrom(user, data);
}

export async function signOutAdmin(): Promise<void> {
  await fbSignOut(auth);
}
