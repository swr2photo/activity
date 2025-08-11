'use client';

// lib/firebaseAuth.ts
import {
  User,
  OAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  getAdditionalUserInfo,
} from 'firebase/auth';
import React from 'react';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { auth, db } from './firebase';

export interface UniversityUserProfile {
  uid: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  studentId: string;
  degreeLevel: string;
  department: string;
  faculty: string;
  photoURL?: string;
  isActive: boolean;
  /** kept for compatibility; no longer used for gating */
  isVerified?: boolean;
  createdAt: any;
  updatedAt: any;
  lastLoginAt: any;
  loginCount: number;
}

export interface AuthState {
  user: User | null;
  userData: UniversityUserProfile | null;
  loading: boolean;
  error: string | null;
}

/** อนุญาตเฉพาะโดเมน PSU */
export const AUTH_ALLOWED_DOMAINS = ['@psu.ac.th'] as const;

/** แมปข้อมูลจากอีเมลนักศึกษาเป็น faculty/department/degree */
export const parseStudentInfo = (email: string) => {
  const studentId = email.split('@')[0];

  const facultyMap: Record<string, string> = {
    '01': 'คณะวิศวกรรมศาสตร์',
    '02': 'คณะวิทยาศาสตร์',
    '03': 'คณะมนุษยศาสตร์และสังคมศาสตร์',
    '04': 'คณะแพทยศาสตร์',
    '05': 'คณะพยาบาลศาสตร์',
    '06': 'คณะเทคโนโลยีสารสนเทศ',
    '07': 'คณะบริหารธุรกิจ',
    '08': 'คณะศิลปกรรมศาสตร์',
    '09': 'คณะเกษตรศาสตร์',
    '10': 'คณะสัตวแพทยศาสตร์',
  };

  const departmentMap: Record<string, Record<string, string>> = {
    '01': {
      '01': 'วิศวกรรมคอมพิวเตอร์',
      '02': 'วิศวกรรมไฟฟ้า',
      '03': 'วิศวกรรมเครื่องกล',
      '04': 'วิศวกรรมโยธา',
      '05': 'วิศวกรรมเคมี',
      '06': 'วิศวกรรมอุตสาหการ',
    },
    '02': {
      '01': 'คณิตศาสตร์',
      '02': 'ฟิสิกส์',
      '03': 'เคมี',
      '04': 'ชีววิทยา',
      '05': 'วิทยาการคอมพิวเตอร์',
      '06': 'สถิติ',
    },
    '03': {
      '01': 'ภาษาไทย',
      '02': 'ภาษาอังกฤษ',
      '03': 'ประวัติศาสตร์',
      '04': 'รัฐศาสตร์',
      '05': 'สังคมวิทยา',
      '06': 'จิตวิทยา',
    },
  };

  let degreeLevel = 'ไม่ระบุ';
  let faculty = 'ไม่ระบุ';
  let department = 'ไม่ระบุ';

  if (studentId.length >= 8) {
    const yearCode = studentId.substring(0, 2);
    const facultyCode = studentId.substring(2, 4);
    const deptCode = studentId.substring(4, 6);

    const currentYear = new Date().getFullYear() % 100;
    const studentYear = parseInt(yearCode, 10);

    if (/^[Mm]/.test(studentId)) degreeLevel = 'ปริญญาโท';
    else if (/^[Dd]/.test(studentId)) degreeLevel = 'ปริญญาเอก';
    else if (!Number.isNaN(studentYear) && studentYear >= currentYear - 6) degreeLevel = 'ปริญญาตรี';

    faculty = facultyMap[facultyCode] || 'ไม่ระบุ';
    department = departmentMap[facultyCode]?.[deptCode] || 'ไม่ระบุ';
  }

  return { studentId, degreeLevel, faculty, department };
};

/** ตรวจโดเมนอีเมลว่าเป็น PSU */
export const isUniversityEmail = (email: string): boolean => {
  return AUTH_ALLOWED_DOMAINS.some((d) => email.toLowerCase().endsWith(d));
};

/** แปลง Firebase Auth error → ข้อความภาษาไทยแบบกลาง (ไม่มี “บัญชีมีอยู่แล้ว…”) */
export const mapAuthError = (err: any): string => {
  const code = String(err?.code || '');
  const rawMsg = String(err?.message || '');

  switch (code) {
    case 'auth/account-exists-with-different-credential':
      // แสดงเป็นข้อผิดพลาดการเข้าสู่ระบบทั่วไป โดยไม่พูดถึง “บัญชีมีอยู่แล้ว…”
      return 'ไม่สามารถเข้าสู่ระบบด้วย Microsoft สำหรับอีเมลนี้ กรุณาใช้วิธีที่ผูกไว้กับบัญชีนี้';
    case 'auth/popup-closed-by-user':
      return 'การเข้าสู่ระบบถูกยกเลิก กรุณาลองใหม่อีกครั้ง';
    case 'auth/popup-blocked':
      return 'เบราว์เซอร์บล็อกหน้าต่างล็อกอิน กรุณาอนุญาต Popup แล้วลองใหม่';
    case 'auth/network-request-failed':
      return 'มีปัญหาการเชื่อมต่ออินเทอร์เน็ต กรุณาลองใหม่';
    case 'auth/too-many-requests':
      return 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่';
    default:
      if (rawMsg.toLowerCase().includes('popup')) {
        return 'ไม่สามารถเปิดหน้าต่างล็อกอินได้ กรุณาอนุญาต Popup แล้วลองใหม่';
      }
      return `เกิดข้อผิดพลาด: ${rawMsg || code}`;
  }
};

/** ล็อกอินด้วย Microsoft + บันทึก/อัปเดตโปรไฟล์ (ไม่มี admin verify) */
export const signInWithMicrosoft = async (): Promise<{
  user: User;
  userData: UniversityUserProfile;
}> => {
  const provider = new OAuthProvider('microsoft.com');
  provider.addScope('openid');
  provider.addScope('email');
  provider.addScope('profile');
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await signInWithPopup(auth, provider);
  const firebaseUser = result.user;

  // ตรวจโดเมน PSU
  if (!firebaseUser.email || !isUniversityEmail(firebaseUser.email)) {
    await firebaseSignOut(auth);
    throw new Error('กรุณาใช้บัญชีของมหาวิทยาลัยเท่านั้น (@psu.ac.th)');
  }

  try {
    getAdditionalUserInfo(result);
  } catch {
    /* noop */
  }

  const { studentId, degreeLevel, department, faculty } = parseStudentInfo(firebaseUser.email);
  const displayName = firebaseUser.displayName || '';
  const nameParts = displayName.trim().split(/\s+/);
  const firstName = nameParts[0] || 'ไม่ระบุ';
  const lastName = nameParts.slice(1).join(' ') || 'ไม่ระบุ';

  const userDocRef = doc(db, 'universityUsers', firebaseUser.uid);
  const existing = await getDoc(userDocRef);

  let userData: UniversityUserProfile;
  if (existing.exists()) {
    const prev = existing.data() as UniversityUserProfile;
    userData = {
      ...prev,
      displayName: firebaseUser.displayName || prev.displayName,
      photoURL: firebaseUser.photoURL || prev.photoURL,
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      loginCount: (prev.loginCount || 0) + 1,
      isActive: true,
      isVerified: true, // no admin gate — always true
    };
    await setDoc(userDocRef, userData, { merge: true });
  } else {
    userData = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName,
      firstName,
      lastName,
      studentId,
      degreeLevel,
      department,
      faculty,
      photoURL: firebaseUser.photoURL || '',
      isActive: true,
      isVerified: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      loginCount: 1,
    };
    await setDoc(userDocRef, userData as DocumentData);
  }

  return { user: firebaseUser, userData };
};

/** ออกจากระบบ */
export const signOutUser = async (): Promise<void> => {
  await firebaseSignOut(auth);
};

/** ดึงโปรไฟล์ผู้ใช้ */
export const getUserProfile = async (uid: string): Promise<UniversityUserProfile | null> => {
  const ref = doc(db, 'universityUsers', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as UniversityUserProfile) : null;
};

/** อัปเดตโปรไฟล์ */
export const updateUserProfile = async (
  uid: string,
  updates: Partial<UniversityUserProfile>
): Promise<void> => {
  const ref = doc(db, 'universityUsers', uid);
  await setDoc(
    ref,
    {
      ...updates,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

/** เช็กสถานะผู้ใช้ (ไม่มี pending/verify gate แล้ว) */
export const checkUserStatus = async (uid: string): Promise<{
  isActive: boolean;
  isVerified: boolean;
  canRegister: boolean;
}> => {
  const userData = await getUserProfile(uid);
  if (!userData) {
    return { isActive: false, isVerified: true, canRegister: false };
  }
  return {
    isActive: userData.isActive,
    isVerified: true,
    canRegister: userData.isActive,
  };
};

/** ค้นหาผู้ใช้ด้วยรหัสนักศึกษา */
export const findUserByStudentId = async (
  studentId: string
): Promise<UniversityUserProfile | null> => {
  const qy = query(collection(db, 'universityUsers'), where('studentId', '==', studentId));
  const snap = await getDocs(qy);
  return !snap.empty ? (snap.docs[0].data() as UniversityUserProfile) : null;
};

/** Hook จัดการ auth state */
export const useAuth = () => {
  const [authState, setAuthState] = React.useState<AuthState>({
    user: null,
    userData: null,
    loading: true,
    error: null,
  });

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        if (firebaseUser) {
          const userData = await getUserProfile(firebaseUser.uid);
          setAuthState({ user: firebaseUser, userData, loading: false, error: null });
        } else {
          setAuthState({ user: null, userData: null, loading: false, error: null });
        }
      } catch (e: any) {
        setAuthState({ user: null, userData: null, loading: false, error: e.message });
      }
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    const { user, userData } = await signInWithMicrosoft();
    setAuthState({ user, userData, loading: false, error: null });
    return { user, userData };
  };

  const logout = async () => {
    await signOutUser();
    setAuthState({ user: null, userData: null, loading: false, error: null });
  };

  return { ...authState, login, logout };
};

/** สำหรับ admin (คงฟังก์ชันไว้เพื่อความเข้ากันได้) */
export const approveUser = async (uid: string): Promise<void> => {
  await updateUserProfile(uid, { isActive: true, isVerified: true });
};
export const suspendUser = async (uid: string): Promise<void> => {
  await updateUserProfile(uid, { isActive: false });
};

/** Utility เพิ่มเติม */
export const getAllUsers = async (): Promise<UniversityUserProfile[]> => {
  const snap = await getDocs(collection(db, 'universityUsers'));
  return snap.docs.map((d) => d.data() as UniversityUserProfile);
};
/** ไม่มีแนวคิด pending อีกต่อไป เพื่อความเข้ากันได้ คืนค่าเป็น [] */
export const getPendingUsers = async (): Promise<UniversityUserProfile[]> => {
  return [];
};
