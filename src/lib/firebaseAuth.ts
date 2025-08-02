'use client';
// lib/firebaseAuth.ts
import { 
  Auth, 
  User,
  OAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  getAdditionalUserInfo
} from 'firebase/auth';
import React, { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
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
  isVerified: boolean;
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

// ฟังก์ชันสำหรับแยกข้อมูลนักศึกษาจาก email
export const parseStudentInfo = (email: string): {
  studentId: string;
  degreeLevel: string;
  department: string;
  faculty: string;
} => {
  const studentId = email.split('@')[0];
  
  // การแมปรหัสคณะ (ปรับตามมหาวิทยาลัยของคุณ)
  const facultyMap: { [key: string]: string } = {
    '01': 'คณะวิศวกรรมศาสตร์',
    '02': 'คณะวิทยาศาสตร์',
    '03': 'คณะมนุษยศาสตร์และสังคมศาสตร์',
    '04': 'คณะแพทยศาสตร์',
    '05': 'คณะพยาบาลศาสตร์',
    '06': 'คณะเทคโนโลยีสารสนเทศ',
    '07': 'คณะบริหารธุรกิจ',
    '08': 'คณะศิลปกรรมศาสตร์',
    '09': 'คณะเกษตรศาสตร์',
    '10': 'คณะสัตวแพทยศาสตร์'
  };

  // การแมปรหัสสาขา (ตัวอย่าง)
  const departmentMap: { [key: string]: { [key: string]: string } } = {
    '01': { // วิศวกรรมศาสตร์
      '01': 'วิศวกรรมคอมพิวเตอร์',
      '02': 'วิศวกรรมไฟฟ้า',
      '03': 'วิศวกรรมเครื่องกล',
      '04': 'วิศวกรรมโยธา',
      '05': 'วิศวกรรมเคมี',
      '06': 'วิศวกรรมอุตสาหการ'
    },
    '02': { // วิทยาศาสตร์
      '01': 'คณิตศาสตร์',
      '02': 'ฟิสิกส์',
      '03': 'เคมี',
      '04': 'ชีววิทยา',
      '05': 'วิทยาการคอมพิวเตอร์',
      '06': 'สถิติ'
    },
    '03': { // มนุษยศาสตร์และสังคมศาสตร์
      '01': 'ภาษาไทย',
      '02': 'ภาษาอังกฤษ',
      '03': 'ประวัติศาสตร์',
      '04': 'รัฐศาสตร์',
      '05': 'สังคมวิทยา',
      '06': 'จิตวิทยา'
    }
  };

  let degreeLevel = 'ไม่ระบุ';
  let faculty = 'ไม่ระบุ';
  let department = 'ไม่ระบุ';

  if (studentId.length >= 8) {
    // รูปแบบ: YYFFDDNN (YY=ปี, FF=คณะ, DD=สาขา, NN=เลขที่)
    const yearCode = studentId.substring(0, 2);
    const facultyCode = studentId.substring(2, 4);
    const deptCode = studentId.substring(4, 6);
    
    // กำหนดระดับปริญญา
    const currentYear = new Date().getFullYear() % 100;
    const studentYear = parseInt(yearCode);
    
    if (studentId.startsWith('M') || studentId.startsWith('m')) {
      degreeLevel = 'ปริญญาโท';
    } else if (studentId.startsWith('D') || studentId.startsWith('d')) {
      degreeLevel = 'ปริญญาเอก';
    } else if (studentYear >= currentYear - 6) {
      degreeLevel = 'ปริญญาตรี';
    } else {
      degreeLevel = 'ไม่ระบุ';
    }

    // แมปคณะและสาขา
    faculty = facultyMap[facultyCode] || 'ไม่ระบุ';
    department = departmentMap[facultyCode]?.[deptCode] || 'ไม่ระบุ';
  }

  return {
    studentId,
    degreeLevel,
    faculty,
    department
  };
};

// ฟังก์ชันสำหรับตรวจสอบว่าเป็น email ของมหาวิทยาลัย
export const isUniversityEmail = (email: string): boolean => {
  const allowedDomains = [
    '@university.ac.th',
    '@student.university.ac.th',
    '@su.ac.th', // ตัวอย่าง domain มหาวิทยาลัย
    '@students.su.ac.th'
  ];
  
  return allowedDomains.some(domain => email.toLowerCase().endsWith(domain.toLowerCase()));
};

// ฟังก์ชันสำหรับเข้าสู่ระบบด้วย Microsoft
export const signInWithMicrosoft = async (): Promise<{
  user: User;
  userData: UniversityUserProfile;
}> => {
  try {
    // สร้าง Microsoft OAuth provider
    const provider = new OAuthProvider('microsoft.com');
    
    // กำหนด scope
    provider.addScope('openid');
    provider.addScope('email');
    provider.addScope('profile');
    
    // เพิ่ม custom parameters (ถ้าจำเป็น)
    provider.setCustomParameters({
      prompt: 'select_account', // ให้ผู้ใช้เลือกบัญชี
    });

    const result = await signInWithPopup(auth, provider);
    const firebaseUser = result.user;

    // ตรวจสอบ email domain
    if (!firebaseUser.email || !isUniversityEmail(firebaseUser.email)) {
      await firebaseSignOut(auth);
      throw new Error('กรุณาใช้บัญชีของมหาวิทยาลัยเท่านั้น');
    }

    // ดึงข้อมูลเพิ่มเติม
    const additionalUserInfo = getAdditionalUserInfo(result);
    const { studentId, degreeLevel, department, faculty } = parseStudentInfo(firebaseUser.email);
    
    // แยกชื่อ-นามสกุล
    const displayName = firebaseUser.displayName || '';
    const nameParts = displayName.trim().split(/\s+/);
    const firstName = nameParts[0] || 'ไม่ระบุ';
    const lastName = nameParts.slice(1).join(' ') || 'ไม่ระบุ';

    // ตรวจสอบว่ามีข้อมูลผู้ใช้ในระบบหรือไม่
    const userDocRef = doc(db, 'universityUsers', firebaseUser.uid);
    const existingUserDoc = await getDoc(userDocRef);
    
    let userData: UniversityUserProfile;

    if (existingUserDoc.exists()) {
      // อัพเดทข้อมูลผู้ใช้ที่มีอยู่
      const existingData = existingUserDoc.data() as UniversityUserProfile;
      userData = {
        ...existingData,
        displayName: firebaseUser.displayName || existingData.displayName,
        photoURL: firebaseUser.photoURL || existingData.photoURL,
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        loginCount: (existingData.loginCount || 0) + 1
      };
      
      await setDoc(userDocRef, userData, { merge: true });
    } else {
      // สร้างข้อมูลผู้ใช้ใหม่
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
        isVerified: false, // ต้องให้ admin verify
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        loginCount: 1
      };
      
      await setDoc(userDocRef, userData);
    }

    return { user: firebaseUser, userData };
  } catch (error: any) {
    console.error('Microsoft sign-in error:', error);
    throw error;
  }
};

// ฟังก์ชันสำหรับออกจากระบบ
export const signOutUser = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
};

// ฟังก์ชันสำหรับดึงข้อมูลผู้ใช้จาก Firestore
export const getUserProfile = async (uid: string): Promise<UniversityUserProfile | null> => {
  try {
    const userDocRef = doc(db, 'universityUsers', uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      return userDoc.data() as UniversityUserProfile;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw error;
  }
};

// ฟังก์ชันสำหรับอัพเดทข้อมูลผู้ใช้
export const updateUserProfile = async (
  uid: string, 
  updates: Partial<UniversityUserProfile>
): Promise<void> => {
  try {
    const userDocRef = doc(db, 'universityUsers', uid);
    await setDoc(userDocRef, {
      ...updates,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

// ฟังก์ชันสำหรับตรวจสอบสถานะผู้ใช้
export const checkUserStatus = async (uid: string): Promise<{
  isActive: boolean;
  isVerified: boolean;
  canRegister: boolean;
}> => {
  try {
    const userData = await getUserProfile(uid);
    
    if (!userData) {
      return { isActive: false, isVerified: false, canRegister: false };
    }

    return {
      isActive: userData.isActive,
      isVerified: userData.isVerified,
      canRegister: userData.isActive && userData.isVerified
    };
  } catch (error) {
    console.error('Error checking user status:', error);
    return { isActive: false, isVerified: false, canRegister: false };
  }
};

// ฟังก์ชันสำหรับค้นหาผู้ใช้ตามรหัสนักศึกษา
export const findUserByStudentId = async (studentId: string): Promise<UniversityUserProfile | null> => {
  try {
    const q = query(
      collection(db, 'universityUsers'),
      where('studentId', '==', studentId)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data() as UniversityUserProfile;
    }
    
    return null;
  } catch (error) {
    console.error('Error finding user by student ID:', error);
    throw error;
  }
};

// Hook สำหรับจัดการ auth state
export const useAuth = () => {
  const [authState, setAuthState] = React.useState<AuthState>({
    user: null,
    userData: null,
    loading: true,
    error: null
  });

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
      
      try {
        if (firebaseUser) {
          const userData = await getUserProfile(firebaseUser.uid);
          setAuthState({
            user: firebaseUser,
            userData,
            loading: false,
            error: null
          });
        } else {
          setAuthState({
            user: null,
            userData: null,
            loading: false,
            error: null
          });
        }
      } catch (error: any) {
        setAuthState({
          user: null,
          userData: null,
          loading: false,
          error: error.message
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
      const { user, userData } = await signInWithMicrosoft();
      setAuthState({
        user,
        userData,
        loading: false,
        error: null
      });
      return { user, userData };
    } catch (error: any) {
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOutUser();
      setAuthState({
        user: null,
        userData: null,
        loading: false,
        error: null
      });
    } catch (error: any) {
      setAuthState(prev => ({
        ...prev,
        error: error.message
      }));
      throw error;
    }
  };

  return {
    ...authState,
    login,
    logout
  };
};

// ฟังก์ชันสำหรับ admin ในการอนุมัติผู้ใช้
export const approveUser = async (uid: string): Promise<void> => {
  try {
    await updateUserProfile(uid, {
      isVerified: true,
      isActive: true
    });
  } catch (error) {
    console.error('Error approving user:', error);
    throw error;
  }
};

// ฟังก์ชันสำหรับ admin ในการระงับผู้ใช้
export const suspendUser = async (uid: string): Promise<void> => {
  try {
    await updateUserProfile(uid, {
      isActive: false
    });
  } catch (error) {
    console.error('Error suspending user:', error);
    throw error;
  }
};

// ฟังก์ชันสำหรับดึงรายชื่อผู้ใช้ทั้งหมด (สำหรับ admin)
export const getAllUsers = async (): Promise<UniversityUserProfile[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, 'universityUsers'));
    return querySnapshot.docs.map(doc => doc.data() as UniversityUserProfile);
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  }
};

// ฟังก์ชันสำหรับดึงผู้ใช้ที่รอการอนุมัติ
export const getPendingUsers = async (): Promise<UniversityUserProfile[]> => {
  try {
    const q = query(
      collection(db, 'universityUsers'),
      where('isVerified', '==', false),
      where('isActive', '==', true)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as UniversityUserProfile);
  } catch (error) {
    console.error('Error getting pending users:', error);
    throw error;
  }
};