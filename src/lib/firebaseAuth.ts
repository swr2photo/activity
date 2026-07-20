'use client';

// lib/firebaseAuth.ts
import {
  User,
  OAuthProvider,
  GoogleAuthProvider,
  AuthProvider,
  UserCredential,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  setPersistence,
  browserLocalPersistence,
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
import { SessionManager } from './sessionManager';
import { validateThaiName, validateNameTitle } from '../utils/validation';

/** ถูกโยนเมื่อกำลังพาไป OAuth แบบ redirect (ไม่ใช่ error จริง) */
export class AuthRedirectPendingError extends Error {
  code = 'auth/redirect-pending';
  constructor() {
    super('กำลังเปลี่ยนไปหน้าเข้าสู่ระบบ...');
    this.name = 'AuthRedirectPendingError';
  }
}

export const isInAppBrowser = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Line\/|FBAN|FBAV|Instagram|MicroMessenger|Twitter/i.test(ua);
};

function shouldFallbackToRedirect(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || '');
  return (
    code === 'auth/popup-blocked' ||
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    code === 'auth/operation-not-supported-in-this-environment' ||
    code === 'auth/web-storage-unsupported'
  );
}

async function signInWithPopupOrRedirect(provider: AuthProvider): Promise<UserCredential> {
  await setPersistence(auth, browserLocalPersistence);
  try {
    return await signInWithPopup(auth, provider);
  } catch (err) {
    if (!shouldFallbackToRedirect(err)) throw err;
    await signInWithRedirect(auth, provider);
    throw new AuthRedirectPendingError();
  }
}

function detectAuthProviderId(cred: UserCredential): AuthProviderId | null {
  const pid = String(cred.providerId || '');
  if (pid === 'google.com') return 'google';
  if (pid === 'microsoft.com') return 'microsoft';
  const fromUser = cred.user.providerData.map((p) => p.providerId);
  if (fromUser.includes('google.com')) return 'google';
  if (fromUser.includes('microsoft.com')) return 'microsoft';
  return null;
}

export type UserType = 'university' | 'external';
export type AuthProviderId = 'microsoft' | 'google';

export interface UniversityUserProfile {
  uid: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  /** คำนำหน้าชื่อ เช่น นาย / นางสาว */
  nameTitle?: string;
  studentId: string;
  degreeLevel: string;
  department: string;
  faculty: string;
  username?: string;
  photoURL?: string;
  /** นักศึกษา/บุคลากร ม.อ. หรือบุคคลภายนอก */
  userType?: UserType;
  authProvider?: AuthProviderId;
  /** สถานศึกษา (บุคคลภายนอก) */
  institutionName?: string;
  /** ระดับการศึกษา (บุคคลภายนอก) — อาจซ้ำกับ degreeLevel */
  educationLevel?: string;
  isActive: boolean;
  /** kept for compatibility; no longer used for gating */
  isVerified?: boolean;
  createdAt: any;
  updatedAt: any;
  lastLoginAt: any;
  loginCount: number;
}

/** ระดับการศึกษาสำหรับบุคคลภายนอก */
export const EDUCATION_LEVEL_OPTIONS = [
  'มัธยมศึกษาตอนต้น',
  'มัธยมศึกษาตอนปลาย',
  'ประกาศนียบัตรวิชาชีพ (ปวช.)',
  'ประกาศนียบัตรวิชาชีพชั้นสูง (ปวส.)',
  'ปริญญาตรี',
  'ปริญญาโท',
  'ปริญญาเอก',
  'อื่นๆ',
] as const;

export interface AuthState {
  user: User | null;
  userData: UniversityUserProfile | null;
  loading: boolean;
  error: string | null;
}

/** อนุญาตเฉพาะโดเมน PSU */
export const AUTH_ALLOWED_DOMAINS = ['@psu.ac.th'] as const;

export const facultyMap: Record<string, string> = {
  '01': 'คณะวิศวกรรมศาสตร์',
  '02': 'คณะวิทยาศาสตร์',
  '03': 'คณะมนุษยศาสตร์และสังคมศาสตร์',
  '04': 'คณะแพทยศาสตร์',
  '05': 'คณะพยาบาลศาสตร์',
  '06': 'คณะเทคโนโลยีสารสนเทศ',
  '07': 'คณะบริหารธุรกิจ',
  '08': 'คณะศิลปกรรมศาสตร์',
  '09': 'คณะเกษตรศาสตร์',
  '10': 'คณะวิทยาศาสตร์',
};

export const departmentMap: Record<string, Record<string, string>> = {
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
  '10': {
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

/** แมปข้อมูลจากอีเมลนักศึกษาเป็น faculty/department/degree */
export const parseStudentInfo = (email: string) => {
  const studentId = email.split('@')[0];

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
  if (err instanceof AuthRedirectPendingError || err?.code === 'auth/redirect-pending') {
    return '';
  }
  const code = String(err?.code || '');
  const rawMsg = String(err?.message || '');

  switch (code) {
    case 'auth/account-exists-with-different-credential':
      return 'อีเมลนี้เคยเข้าสู่ระบบด้วยวิธีอื่นแล้ว กรุณาใช้วิธีเดิม (Microsoft หรือ Google) ที่ผูกกับบัญชีนี้';
    case 'auth/popup-closed-by-user':
      return 'การเข้าสู่ระบบถูกยกเลิก กรุณาลองใหม่อีกครั้ง';
    case 'auth/popup-blocked':
      return 'เบราว์เซอร์บล็อกหน้าต่างล็อกอิน — ระบบจะลองเปิดแบบเต็มหน้าต่าง หากยังไม่ได้ ให้เปิดใน Chrome/Safari';
    case 'auth/unauthorized-domain':
      return 'โดเมนเว็บนี้ยังไม่ได้รับอนุญาตใน Firebase Auth (ต้องเพิ่ม event.psuscc.club ใน Authorized domains) — กรุณาติดต่อผู้ดูแลระบบ';
    case 'auth/operation-not-allowed':
      return 'ยังไม่ได้เปิดใช้การเข้าสู่ระบบด้วย Google ใน Firebase Console — กรุณาติดต่อผู้ดูแลระบบ';
    case 'auth/network-request-failed':
      return 'มีปัญหาการเชื่อมต่ออินเทอร์เน็ต กรุณาลองใหม่';
    case 'auth/too-many-requests':
      return 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่';
    default:
      if (rawMsg.toLowerCase().includes('popup')) {
        return 'ไม่สามารถเปิดหน้าต่างล็อกอินได้ กรุณาอนุญาต Popup หรือลองใหม่ใน Chrome/Safari';
      }
      return `เกิดข้อผิดพลาด: ${rawMsg || code}`;
  }
};

const splitDisplayName = (displayName: string) => {
  let firstName = 'ไม่ระบุ';
  let lastName = 'ไม่ระบุ';
  const thaiMatch = displayName.match(/\(([\u0E00-\u0E7F\s]+)\)/);
  if (thaiMatch?.[1]) {
    const nameParts = thaiMatch[1].trim().split(/\s+/);
    firstName = nameParts[0] || 'ไม่ระบุ';
    lastName = nameParts.slice(1).join(' ') || 'ไม่ระบุ';
  } else {
    const nameParts = displayName.trim().split(/\s+/).filter(Boolean);
    firstName = nameParts[0] || 'ไม่ระบุ';
    lastName = nameParts.slice(1).join(' ') || 'ไม่ระบุ';
  }
  return { firstName, lastName };
};

/** studentId คงที่สำหรับบุคคลภายนอก (ให้ผ่าน activityRecords rules) */
export const makeExternalStudentId = (uid: string) =>
  `EXT-${uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`;

export const isExternalUser = (profile?: UniversityUserProfile | null): boolean =>
  profile?.userType === 'external';

/** โปรไฟล์ครบพอสำหรับลงทะเบียนหรือยัง */
export const isProfileComplete = (profile?: UniversityUserProfile | null): boolean => {
  if (!profile) return false;
  const hasName =
    !!profile.nameTitle?.trim() &&
    !!profile.firstName?.trim() &&
    profile.firstName !== 'ไม่ระบุ' &&
    !!profile.lastName?.trim() &&
    profile.lastName !== 'ไม่ระบุ';
  if (!hasName) return false;
  if (
    !validateNameTitle(profile.nameTitle!) ||
    !validateThaiName(profile.firstName) ||
    !validateThaiName(profile.lastName)
  ) {
    return false;
  }
  if (profile.userType === 'external') {
    return !!(profile.institutionName?.trim() && (profile.educationLevel || profile.degreeLevel)?.trim());
  }
  return true;
};

async function upsertUserAfterSignIn(
  firebaseUser: User,
  authProvider: AuthProviderId,
  opts: { requireUniversityEmail: boolean }
): Promise<UniversityUserProfile> {
  if (!firebaseUser.email) {
    await firebaseSignOut(auth);
    throw new Error('ไม่พบอีเมลจากบัญชีที่เข้าสู่ระบบ');
  }

  const email = firebaseUser.email;
  const isUni = isUniversityEmail(email);

  if (opts.requireUniversityEmail && !isUni) {
    await firebaseSignOut(auth);
    throw new Error('กรุณาใช้บัญชีของมหาวิทยาลัยเท่านั้น (@psu.ac.th)');
  }

  const userType: UserType = isUni ? 'university' : 'external';
  const displayName = firebaseUser.displayName || '';
  const { firstName, lastName } = splitDisplayName(displayName);

  let studentId = '';
  let degreeLevel = 'ไม่ระบุ';
  let department = 'ไม่ระบุ';
  let faculty = 'ไม่ระบุ';

  if (userType === 'university') {
    const parsed = parseStudentInfo(email);
    studentId = parsed.studentId;
    degreeLevel = parsed.degreeLevel;
    department = parsed.department;
    faculty = parsed.faculty;
  } else {
    studentId = makeExternalStudentId(firebaseUser.uid);
  }

  const userDocRef = doc(db, 'universityUsers', firebaseUser.uid);
  const existing = await getDoc(userDocRef);

  let userData: UniversityUserProfile;
  if (existing.exists()) {
    const prev = existing.data() as UniversityUserProfile;

    if (prev.isActive === false) {
      await firebaseSignOut(auth);
      throw new Error('บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
    }

    userData = {
      ...prev,
      displayName: firebaseUser.displayName || prev.displayName,
      photoURL: firebaseUser.photoURL || prev.photoURL,
      userType: prev.userType || userType,
      authProvider,
      // เติม studentId ภายนอกถ้ายังไม่มี
      studentId: prev.studentId || studentId,
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      loginCount: (prev.loginCount || 0) + 1,
      isVerified: true,
    };
    await setDoc(userDocRef, userData, { merge: true });
  } else {
    userData = {
      uid: firebaseUser.uid,
      email,
      displayName,
      firstName,
      lastName,
      studentId,
      degreeLevel,
      department,
      faculty,
      userType,
      authProvider,
      institutionName: userType === 'external' ? '' : undefined,
      educationLevel: userType === 'external' ? '' : undefined,
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

  return userData;
}

/** ล็อกอินด้วย Microsoft + บันทึก/อัปเดตโปรไฟล์ (เฉพาะ @psu.ac.th) */
export const signInWithMicrosoft = async (): Promise<{
  user: User;
  userData: UniversityUserProfile;
}> => {
  if (isInAppBrowser()) {
    throw new Error(
      'เบราว์เซอร์ในแอป (LINE/FB/IG) อาจทำให้เข้าสู่ระบบล้มเหลว กรุณาเปิดลิงก์นี้ใน Chrome/Safari แล้วลองใหม่'
    );
  }

  const provider = new OAuthProvider('microsoft.com');
  provider.addScope('openid');
  provider.addScope('email');
  provider.addScope('profile');
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await signInWithPopupOrRedirect(provider);
  try {
    getAdditionalUserInfo(result);
  } catch {
    /* noop */
  }

  const userData = await upsertUserAfterSignIn(result.user, 'microsoft', {
    requireUniversityEmail: true,
  });
  await SessionManager.ensureSession(result.user.uid, result.user.email || '');
  return { user: result.user, userData };
};

/**
 * ล็อกอินด้วย Google
 * - @psu.ac.th → ถือเป็นผู้ใช้มหาวิทยาลัย
 * - อื่นๆ → บุคคลภายนอก ต้องกรอกสถานศึกษา/ระดับการศึกษา
 * - ถ้า popup ใช้ไม่ได้ → เปลี่ยนเป็น redirect อัตโนมัติ
 */
export const signInWithGoogle = async (): Promise<{
  user: User;
  userData: UniversityUserProfile;
}> => {
  if (isInAppBrowser()) {
    throw new Error(
      'เบราว์เซอร์ในแอป (LINE/FB/IG) อาจทำให้เข้าสู่ระบบล้มเหลว กรุณาเปิดลิงก์นี้ใน Chrome/Safari แล้วลองใหม่'
    );
  }

  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await signInWithPopupOrRedirect(provider);
  try {
    getAdditionalUserInfo(result);
  } catch {
    /* noop */
  }

  const userData = await upsertUserAfterSignIn(result.user, 'google', {
    requireUniversityEmail: false,
  });
  await SessionManager.ensureSession(result.user.uid, result.user.email || '');
  return { user: result.user, userData };
};

/**
 * รับผลลัพธ์หลัง redirect กลับมา (singleton — เรียกกี่ครั้งก็ได้ ผลเดียวกัน)
 * รองรับทั้ง Google และ Microsoft
 */
let redirectResultPromise: Promise<{
  user: User;
  userData: UniversityUserProfile;
  provider: AuthProviderId;
} | null> | null = null;

export const consumeAuthRedirectResult = async (): Promise<{
  user: User;
  userData: UniversityUserProfile;
  provider: AuthProviderId;
} | null> => {
  if (!redirectResultPromise) {
    redirectResultPromise = (async () => {
      await setPersistence(auth, browserLocalPersistence);
      const result = await getRedirectResult(auth);
      if (!result?.user) return null;

      try {
        getAdditionalUserInfo(result);
      } catch {
        /* noop */
      }

      const provider = detectAuthProviderId(result);
      if (!provider) {
        await firebaseSignOut(auth);
        throw new Error('ไม่รองรับผู้ให้บริการเข้าสู่ระบบนี้');
      }

      const userData = await upsertUserAfterSignIn(result.user, provider, {
        requireUniversityEmail: provider === 'microsoft',
      });
      await SessionManager.ensureSession(result.user.uid, result.user.email || '');
      return { user: result.user, userData, provider };
    })();
  }
  return redirectResultPromise;
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
          let userData = await getUserProfile(firebaseUser.uid);
          // race: Google/Microsoft กำลัง upsert โปรไฟล์ — รอสั้นๆ แล้วลองใหม่
          if (!userData) {
            await new Promise((r) => setTimeout(r, 500));
            userData = await getUserProfile(firebaseUser.uid);
          }
          await SessionManager.ensureSession(firebaseUser.uid, firebaseUser.email || '');
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

  // รับผลหลัง OAuth redirect (Google / Microsoft)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await consumeAuthRedirectResult();
        if (cancelled || !result) return;
        setAuthState({
          user: result.user,
          userData: result.userData,
          loading: false,
          error: null,
        });
      } catch (e: any) {
        if (cancelled) return;
        const msg = mapAuthError(e) || e?.message;
        if (msg) setAuthState((prev) => ({ ...prev, loading: false, error: msg }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async () => {
    try {
      const { user, userData } = await signInWithMicrosoft();
      setAuthState({ user, userData, loading: false, error: null });
      return { user, userData };
    } catch (e: any) {
      if (e instanceof AuthRedirectPendingError || e?.code === 'auth/redirect-pending') {
        return { user: null, userData: null, redirecting: true as const };
      }
      throw e;
    }
  };

  const loginWithGoogle = async () => {
    try {
      const { user, userData } = await signInWithGoogle();
      setAuthState({ user, userData, loading: false, error: null });
      return { user, userData };
    } catch (e: any) {
      if (e instanceof AuthRedirectPendingError || e?.code === 'auth/redirect-pending') {
        return { user: null, userData: null, redirecting: true as const };
      }
      throw e;
    }
  };

  const logout = async () => {
    const uid = auth.currentUser?.uid;
    if (uid) await SessionManager.destroySession(uid);
    await signOutUser();
    setAuthState({ user: null, userData: null, loading: false, error: null });
  };

  const refreshUserData = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return null;
    const userData = await getUserProfile(firebaseUser.uid);
    setAuthState((prev) => ({ ...prev, user: firebaseUser, userData }));
    return userData;
  };

  return { ...authState, login, loginWithGoogle, logout, refreshUserData };
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
