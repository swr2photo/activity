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
import {
  clearRefreshCache,
  isRefreshCacheFresh,
  readRefreshCache,
  RefreshCacheKey,
  RefreshCacheTtl,
  writeRefreshCache,
} from './refreshCache';

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
  '03': 'คณะแพทยศาสตร์',
  '04': 'คณะทรัพยากรธรรมชาติ',
  '05': 'คณะศึกษาศาสตร์',
  '06': 'คณะมนุษยศาสตร์และสังคมศาสตร์',
  '07': 'คณะเศรษฐศาสตร์',
  '08': 'คณะบริหารธุรกิจ',
  '09': 'คณะศิลปกรรมศาสตร์',
  '10': 'คณะพยาบาลศาสตร์',
  '11': 'คณะเภสัชศาสตร์',
  '12': 'คณะทันตแพทยศาสตร์',
  '13': 'คณะสัตวแพทยศาสตร์',
  '14': 'คณะนิติศาสตร์',
  '15': 'คณะอุตสาหกรรมเกษตร',
  '16': 'คณะการจัดการสิ่งแวดล้อม',
  '18': 'คณะเทคนิคการแพทย์',
};

export const departmentMap: Record<string, Record<string, string>> = {
  '01': {
    '01': 'วิศวกรรมคอมพิวเตอร์',
    '02': 'วิศวกรรมไฟฟ้า',
    '03': 'วิศวกรรมเครื่องกล',
    '04': 'วิศวกรรมโยธา',
    '05': 'วิศวกรรมเคมี',
    '06': 'วิศวกรรมอุตสาหการ',
    '07': 'วิศวกรรมเหมืองแร่และวัสดุ',
    '08': 'วิศวกรรมสิ่งแวดล้อม',
    '09': 'วิศวกรรมชีวการแพทย์',
    '10': 'วิศวกรรมปัญญาประดิษฐ์',
  },
  '02': {
    '01': 'คณิตศาสตร์',
    '02': 'ฟิสิกส์',
    '03': 'เคมี',
    '04': 'ชีววิทยา',
    '05': 'วิทยาการคอมพิวเตอร์',
    '06': 'สถิติ',
    '07': 'วิทยาการคำนวณ',
    '08': 'เทคโนโลยีสารสนเทศและการสื่อสาร',
    '09': 'จุลชีววิทยา',
    '10': 'เทคโนโลยีชีวภาพ',
    '11': 'วัสดุศาสตร์',
    '12': 'วิทยาศาสตร์พอลิเมอร์',
    '13': 'วิทยาศาสตร์และเทคโนโลยีการอาหาร',
    '14': 'เคมี-ชีววิทยาประยุกต์',
    '15': 'เทคโนโลยีสารสนเทศ (ต่อเนื่อง)',
  },
  '03': {
    '01': 'แพทยศาสตรบัณฑิต',
    '02': 'กายภาพบำบัด',
    '03': 'รังสีเทคนิค',
    '04': 'ฉุกเฉินการแพทย์',
  },
  '04': {
    '01': 'ทรัพยากรธรรมชาติและสิ่งแวดล้อม',
    '02': 'สัตวศาสตร์',
    '03': 'วาริชศาสตร์และนวัตกรรมการประมง',
    '04': 'พืชศาสตร์',
  },
  '05': {
    '01': 'การศึกษาปฐมวัย',
    '02': 'วิทยาศาสตรศึกษา',
    '03': 'การประถมศึกษา',
  },
  '06': {
    '01': 'ภาษาไทย',
    '02': 'ภาษาอังกฤษ',
    '03': 'ประวัติศาสตร์',
    '04': 'รัฐศาสตร์',
    '05': 'สังคมวิทยา',
    '06': 'จิตวิทยา',
  },
  '07': {
    '01': 'เศรษฐศาสตร์',
  },
  '08': {
    '01': 'การจัดการ',
    '02': 'การตลาด',
    '03': 'การบัญชี',
    '04': 'การเงินและการลงทุน',
    '05': 'ระบบสารสนเทศทางธุรกิจ',
    '06': 'รัฐประศาสนศาสตร์',
  },
  '09': {
    '01': 'ทัศนศิลป์',
    '02': 'การออกแบบ',
  },
  '10': {
    '01': 'พยาบาลศาสตรบัณฑิต',
  },
  '11': {
    '01': 'เภสัชศาสตรบัณฑิต',
  },
  '12': {
    '01': 'ทันตแพทยศาสตรบัณฑิต',
  },
  '13': {
    '01': 'สัตวแพทยศาสตรบัณฑิต',
  },
  '14': {
    '01': 'นิติศาสตรบัณฑิต',
  },
  '15': {
    '01': 'วิทยาศาสตร์และเทคโนโลยีอาหาร',
    '02': 'เทคโนโลยีการจัดการอุตสาหกรรมเกษตร',
  },
};

/**
 * แมปข้อมูลจากรหัสนักศึกษา ม.อ. (10 หลัก เช่น 6710210317 = ปี 67 + ระดับ 1 ป.ตรี + คณะ 02 วิทยาศาสตร์)
 * หรืออีเมลนักศึกษา เป็น faculty / department / degreeLevel
 */
export const parseStudentInfo = (emailOrStudentId: string) => {
  const studentId = (emailOrStudentId || '').trim().split('@')[0];

  let degreeLevel = 'ไม่ระบุ';
  let faculty = 'ไม่ระบุ';
  let department = 'ไม่ระบุ';

  if (studentId.length >= 8) {
    const yearCode = studentId.substring(0, 2);
    const currentYear = (new Date().getFullYear() + 543) % 100;
    const studentYear = parseInt(yearCode, 10);

    // รูปแบบรหัสนักศึกษา ม.อ. 10 หลัก: YY (0..2) + Degree/Campus (2..3) + Faculty (3..5) + ...
    const isTenDigitPsu =
      studentId.length >= 10 &&
      /^\d+$/.test(studentId) &&
      ['1', '2', '3'].includes(studentId.substring(2, 3)) &&
      Boolean(facultyMap[studentId.substring(3, 5)]);

    const degreeDigit = isTenDigitPsu ? studentId.substring(2, 3) : '';
    const facultyCode = isTenDigitPsu ? studentId.substring(3, 5) : studentId.substring(2, 4);
    const deptCode = isTenDigitPsu ? studentId.substring(5, 7) : studentId.substring(4, 6);

    if (/^[Mm]/.test(studentId) || degreeDigit === '2') {
      degreeLevel = 'ปริญญาโท';
    } else if (/^[Dd]/.test(studentId) || degreeDigit === '3') {
      degreeLevel = 'ปริญญาเอก';
    } else if (degreeDigit === '1' || (!Number.isNaN(studentYear) && studentYear <= currentYear + 1)) {
      degreeLevel = 'ปริญญาตรี';
    }

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

    const healedFaculty =
      prev.faculty && prev.faculty !== 'ไม่ระบุ' ? prev.faculty : faculty;
    const healedDegree =
      prev.degreeLevel && prev.degreeLevel !== 'ไม่ระบุ' ? prev.degreeLevel : degreeLevel;
    const healedDept =
      prev.department && prev.department !== 'ไม่ระบุ' ? prev.department : department;

    userData = {
      ...prev,
      displayName: firebaseUser.displayName || prev.displayName,
      photoURL: firebaseUser.photoURL || prev.photoURL,
      userType: prev.userType || userType,
      authProvider,
      // เติม studentId / faculty / degreeLevel ที่เคยเป็น 'ไม่ระบุ' จากรหัสนักศึกษาอัตโนมัติ
      studentId: prev.studentId || studentId,
      faculty: healedFaculty,
      degreeLevel: healedDegree,
      department: healedDept,
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

/** ดึงโปรไฟล์ผู้ใช้ (พร้อมซ่อม faculty / degreeLevel จากรหัสนักศึกษาอัตโนมัติหากเคยถูกบันทึกเป็น 'ไม่ระบุ') */
export const getUserProfile = async (uid: string): Promise<UniversityUserProfile | null> => {
  const ref = doc(db, 'universityUsers', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as UniversityUserProfile;
  if (
    data.userType !== 'external' &&
    (!data.faculty || data.faculty === 'ไม่ระบุ' || !data.degreeLevel || data.degreeLevel === 'ไม่ระบุ')
  ) {
    const parsed = parseStudentInfo(data.studentId || data.email || '');
    const patch: Record<string, string> = {};
    if ((!data.faculty || data.faculty === 'ไม่ระบุ') && parsed.faculty !== 'ไม่ระบุ') {
      data.faculty = parsed.faculty;
      patch.faculty = parsed.faculty;
    }
    if ((!data.degreeLevel || data.degreeLevel === 'ไม่ระบุ') && parsed.degreeLevel !== 'ไม่ระบุ') {
      data.degreeLevel = parsed.degreeLevel;
      patch.degreeLevel = parsed.degreeLevel;
    }
    if ((!data.department || data.department === 'ไม่ระบุ') && parsed.department !== 'ไม่ระบุ') {
      data.department = parsed.department;
      patch.department = parsed.department;
    }
    if (Object.keys(patch).length > 0) {
      void setDoc(ref, { ...patch, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
    }
  }
  return data;
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
type AuthShellCache = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  userData: UniversityUserProfile | null;
};

function healProfileInMemory(data: UniversityUserProfile | null): UniversityUserProfile | null {
  if (!data || data.userType === 'external') return data;
  if (
    !data.faculty ||
    data.faculty === 'ไม่ระบุ' ||
    !data.degreeLevel ||
    data.degreeLevel === 'ไม่ระบุ'
  ) {
    const parsed = parseStudentInfo(data.studentId || data.email || '');
    return {
      ...data,
      faculty: !data.faculty || data.faculty === 'ไม่ระบุ' ? parsed.faculty : data.faculty,
      degreeLevel:
        !data.degreeLevel || data.degreeLevel === 'ไม่ระบุ' ? parsed.degreeLevel : data.degreeLevel,
      department:
        !data.department || data.department === 'ไม่ระบุ' ? parsed.department : data.department,
    };
  }
  return data;
}

function readAuthShell(): AuthShellCache | null {
  const raw = readRefreshCache<AuthShellCache>(RefreshCacheKey.auth)?.data ?? null;
  if (!raw) return null;
  return {
    ...raw,
    userData: healProfileInMemory(raw.userData),
  };
}

function writeAuthShell(user: User, userData: UniversityUserProfile | null) {
  writeRefreshCache<AuthShellCache>(RefreshCacheKey.auth, {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    userData,
  });
}

/** เชลล์พอให้ Navbar/เมนูแสดงได้ทันทีตอนรีเฟรช — ยังไม่ใช่ Firebase User เต็ม */
function shellAsUser(shell: AuthShellCache): User {
  return {
    uid: shell.uid,
    email: shell.email,
    displayName: shell.displayName,
    photoURL: shell.photoURL,
  } as User;
}

function initialAuthState(): AuthState {
  // SSR / hydrate ต้องค่าคงที่ — อ่าน cache ใน useLayoutEffect แทน
  return { user: null, userData: null, loading: true, error: null };
}

/**
 * Shared singleton auth store (แทนการสร้าง onAuthStateChanged ซ้ำในทุก component)
 * - ลด Firestore reads ซ้ำระหว่าง Navbar + /register + /my-history
 * - เมื่อแก้ไขโปรไฟล์จากจุดใดจุดหนึ่ง ทุก component จะได้ userData ใหม่พร้อมกันทันที
 * - ไม่ต้องวาง Provider ใน layout.tsx เพื่อไม่ให้ดึง Firebase SDK เข้าหน้าสาธารณะ
 */
type AuthListener = (state: AuthState) => void;

const authStore = {
  state: initialAuthState(),
  listeners: new Set<AuthListener>(),
  initialized: false,
  ensuredSessionUid: null as string | null,
  redirectConsumed: false,
};

function emitAuthState(next: AuthState) {
  authStore.state = next;
  authStore.listeners.forEach((fn) => fn(next));
}

function patchAuthState(updater: (prev: AuthState) => AuthState) {
  emitAuthState(updater(authStore.state));
}

function ensureAuthStoreStarted() {
  if (authStore.initialized || typeof window === 'undefined' || !auth) return;
  authStore.initialized = true;

  onAuthStateChanged(auth, async (firebaseUser) => {
    try {
      if (firebaseUser) {
        const cached = readAuthShell();
        const cacheFresh =
          cached?.uid === firebaseUser.uid &&
          isRefreshCacheFresh(RefreshCacheKey.auth, RefreshCacheTtl.auth);

        const shouldEnsureSession = authStore.ensuredSessionUid !== firebaseUser.uid;
        if (shouldEnsureSession) {
          authStore.ensuredSessionUid = firebaseUser.uid;
          void SessionManager.ensureSession(firebaseUser.uid, firebaseUser.email || '');
        }

        if (cacheFresh && cached.userData) {
          writeAuthShell(firebaseUser, cached.userData);
          emitAuthState({
            user: firebaseUser,
            userData: cached.userData,
            loading: false,
            error: null,
          });
          return;
        }

        let userData = await getUserProfile(firebaseUser.uid);
        if (!userData) {
          await new Promise((r) => setTimeout(r, 400));
          userData = await getUserProfile(firebaseUser.uid);
        }
        writeAuthShell(firebaseUser, userData);
        emitAuthState({ user: firebaseUser, userData, loading: false, error: null });
      } else {
        authStore.ensuredSessionUid = null;
        clearRefreshCache(RefreshCacheKey.auth);
        emitAuthState({ user: null, userData: null, loading: false, error: null });
      }
    } catch (e: any) {
      clearRefreshCache(RefreshCacheKey.auth);
      emitAuthState({ user: null, userData: null, loading: false, error: e.message });
    }
  });

  if (!authStore.redirectConsumed) {
    authStore.redirectConsumed = true;
    void (async () => {
      try {
        const result = await consumeAuthRedirectResult();
        if (!result) return;
        authStore.ensuredSessionUid = result.user.uid;
        writeAuthShell(result.user, result.userData);
        emitAuthState({
          user: result.user,
          userData: result.userData,
          loading: false,
          error: null,
        });
      } catch (e: any) {
        const msg = mapAuthError(e) || e?.message;
        if (msg) patchAuthState((prev) => ({ ...prev, loading: false, error: msg }));
      }
    })();
  }
}

export const useAuth = () => {
  const [authState, setAuthState] = React.useState<AuthState>(() =>
    authStore.initialized ? authStore.state : initialAuthState()
  );

  // ตอนรีเฟรช: คืนเชลล์จาก session ก่อน paint — ไม่ต้องรอ Firebase / ไม่แวบปุ่ม login
  React.useLayoutEffect(() => {
    if (authStore.state.user?.uid) {
      setAuthState(authStore.state);
      return;
    }
    const shell = readAuthShell();
    if (!shell?.uid) return;
    const shellState: AuthState = {
      user: shellAsUser(shell),
      userData: shell.userData,
      loading: false,
      error: null,
    };
    if (!authStore.state.user?.uid) {
      authStore.state = shellState;
    }
    setAuthState(shellState);
  }, []);

  React.useEffect(() => {
    authStore.listeners.add(setAuthState);
    ensureAuthStoreStarted();
    setAuthState(authStore.state);
    return () => {
      authStore.listeners.delete(setAuthState);
    };
  }, []);

  const login = React.useCallback(async () => {
    try {
      const { user, userData } = await signInWithMicrosoft();
      authStore.ensuredSessionUid = user.uid;
      writeAuthShell(user, userData);
      emitAuthState({ user, userData, loading: false, error: null });
      return { user, userData };
    } catch (e: any) {
      if (e instanceof AuthRedirectPendingError || e?.code === 'auth/redirect-pending') {
        return { user: null, userData: null, redirecting: true as const };
      }
      throw e;
    }
  }, []);

  const loginWithGoogle = React.useCallback(async () => {
    try {
      const { user, userData } = await signInWithGoogle();
      authStore.ensuredSessionUid = user.uid;
      writeAuthShell(user, userData);
      emitAuthState({ user, userData, loading: false, error: null });
      return { user, userData };
    } catch (e: any) {
      if (e instanceof AuthRedirectPendingError || e?.code === 'auth/redirect-pending') {
        return { user: null, userData: null, redirecting: true as const };
      }
      throw e;
    }
  }, []);

  const logout = React.useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (uid) await SessionManager.destroySession(uid);
    await signOutUser();
    authStore.ensuredSessionUid = null;
    clearRefreshCache(RefreshCacheKey.auth);
    clearRefreshCache(RefreshCacheKey.homeActivities);
    emitAuthState({ user: null, userData: null, loading: false, error: null });
  }, []);

  const refreshUserData = React.useCallback(async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return null;
    const userData = await getUserProfile(firebaseUser.uid);
    writeAuthShell(firebaseUser, userData);
    patchAuthState((prev) => ({ ...prev, user: firebaseUser, userData }));
    return userData;
  }, []);

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
