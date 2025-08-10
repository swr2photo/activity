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
} from 'firebase/firestore';

import { db } from './firebase';
import type { AdminDepartment } from '../types/admin';
// ====== Admin Management (adminUsers) ======
import type { AdminProfile, AdminRole, AdminPermission } from '../types/admin';
import { setDoc } from 'firebase/firestore';

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
      permissions: (data.permissions || []) as AdminPermission[],
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
      permissions: (data.permissions || []) as AdminPermission[],
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
export const createAdminUser = async (profile: Omit<AdminProfile, 'createdAt' | 'updatedAt'> & { uid: string }) => {
  const ref = doc(db, 'adminUsers', profile.uid);
  const payload = {
    ...profile,
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
    updatedAt: serverTimestamp(),
  });
};

// ลบแอดมิน
export const deleteAdminUser = async (uid: string) => {
  await deleteDoc(doc(db, 'adminUsers', uid));
};

// ---------- Types ----------
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
  // อนุโลมข้อมูลเก่าให้เป็น string ได้ด้วย
  department?: AdminDepartment | string;
  createdAt?: Date;
}

export interface ActivityRecord {
  id: string;
  timestamp: Date;
  studentId: string;
  firstName: string;
  lastName: string;
  // อนุโลมข้อมูลเก่าให้เป็น string ได้ด้วย
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
  // อนุโลมข้อมูลเก่าให้เป็น string ได้ด้วย
  department?: AdminDepartment | string;
  degreeLevel?: string;
  isVerified: boolean;
  isActive: boolean;
  photoURL?: string;
  createdAt?: Date;
}

// ---------- Helpers ----------
const toDateSafe = (v: any): Date | undefined => {
  if (v?.toDate) return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v === 'number' || typeof v === 'string') {
    const d = new Date(v);
    return isNaN(+d) ? undefined : d;
  }
  return undefined;
};

// ---------- Activities ----------
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

// ---------- Create/Update/Delete Activities ----------
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
    // ถ้าต้องการเก็บเวลาแก้ไขล่าสุด: updatedAt: serverTimestamp(),
  });
};

export const deleteActivity = async (activityId: string) => {
  await deleteDoc(doc(db, 'activities', activityId));
};

// ---------- Activity Records ----------
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

// ---------- Users ----------
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

// ---------- Attendance helpers ----------
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

// ---------- User status ----------
export const approveUser = async (uid: string): Promise<void> => {
  await updateDoc(doc(db, 'universityUsers', uid), { isVerified: true, isActive: true });
};

export const suspendUser = async (uid: string): Promise<void> => {
  await updateDoc(doc(db, 'universityUsers', uid), { isActive: false });
};
