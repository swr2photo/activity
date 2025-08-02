// lib/adminFirebase.ts
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { 
  getDoc, 
  doc, 
  query, 
  collection, 
  orderBy, 
  getDocs, 
  where, 
  updateDoc, 
  serverTimestamp,
  QueryDocumentSnapshot,
  DocumentData,
  addDoc,
  deleteDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';

// Import types from your admin types file
import type { AdminProfile, AdminRole, AdminDepartment, AdminPermission } from '../types/admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  department: string;
  role: string;
  isVerified: boolean;
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface ActivityRecord {
  id: string;
  activityName: string;
  activityCode: string;
  userCode: string;
  department: string;
  qrCode: string;
  qrUrl: string;
  description?: string;
  bannerUrl?: string;
  location?: string;
  startDateTime: Date;
  endDateTime: Date;
  checkInRadius: number;
  maxParticipants: number;
  currentParticipants?: number;
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
  userId?: string;
  userName?: string;
  timestamp?: any;
  participantCount?: number;
}

// Authentication functions
export const getCurrentAdmin = async (): Promise<AdminProfile | null> => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe(); // Clean up listener
      
      if (!user) {
        resolve(null);
        return;
      }

      try {
        // Get admin profile from Firestore
        const adminDoc = await getDoc(doc(db, 'admins', user.uid));
        
        if (!adminDoc.exists()) {
          // User exists but not in admins collection
          await signOut(auth);
          resolve(null);
          return;
        }

        const adminData = adminDoc.data();
        const adminProfile: AdminProfile = {
          uid: user.uid,
          email: user.email!,
          displayName: adminData.displayName || `${adminData.firstName || ''} ${adminData.lastName || ''}`.trim() || 'ไม่ระบุ',
          firstName: adminData.firstName || 'ไม่ระบุ',
          lastName: adminData.lastName || 'ไม่ระบุ',
          role: adminData.role as AdminRole || 'viewer',
          department: adminData.department as AdminDepartment || 'all',
          permissions: adminData.permissions as AdminPermission[] || [],
          isActive: adminData.isActive ?? true,
          createdAt: adminData.createdAt || null,
          updatedAt: adminData.updatedAt || null,
          createdBy: adminData.createdBy || undefined,
          lastLoginAt: adminData.lastLoginAt || null,
          profileImage: adminData.profileImage || undefined
        };

        resolve(adminProfile);
      } catch (error) {
        console.error('Error fetching admin profile:', error);
        resolve(null);
      }
    });
  });
};

export const signInAdmin = async (email: string, password: string): Promise<AdminProfile> => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    
    // Verify if user is admin and get admin profile
    const adminDoc = await getDoc(doc(db, 'admins', result.user.uid));
    
    if (!adminDoc.exists()) {
      await signOut(auth);
      throw new Error('ไม่พบสิทธิ์แอดมิน');
    }

    const adminData = adminDoc.data();
    
    // Check if admin account is active
    if (adminData.isActive === false) {
      await signOut(auth);
      throw new Error('บัญชีผู้ดูแลถูกระงับการใช้งาน');
    }

    // Update last login time
    try {
      await updateDoc(doc(db, 'admins', result.user.uid), {
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (updateError) {
      console.warn('Could not update last login time:', updateError);
    }

    // Return AdminProfile
    const adminProfile: AdminProfile = {
      uid: result.user.uid,
      email: result.user.email!,
      displayName: adminData.displayName || `${adminData.firstName || ''} ${adminData.lastName || ''}`.trim() || 'ไม่ระบุ',
      firstName: adminData.firstName || 'ไม่ระบุ',
      lastName: adminData.lastName || 'ไม่ระบุ',
      role: adminData.role as AdminRole || 'viewer',
      department: adminData.department as AdminDepartment || 'all',
      permissions: adminData.permissions as AdminPermission[] || [],
      isActive: adminData.isActive ?? true,
      createdAt: adminData.createdAt || null,
      updatedAt: serverTimestamp(),
      createdBy: adminData.createdBy || undefined,
      lastLoginAt: serverTimestamp(),
      profileImage: adminData.profileImage || undefined
    };

    return adminProfile;
  } catch (error: any) {
    // Handle Firebase Auth errors
    switch (error.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      case 'auth/invalid-email':
        throw new Error('รูปแบบอีเมลไม่ถูกต้อง');
      case 'auth/user-disabled':
        throw new Error('บัญชีถูกระงับการใช้งาน');
      case 'auth/too-many-requests':
        throw new Error('มีการพยายามเข้าสู่ระบบมากเกินไป กรุณาลองใหม่ภายหลัง');
      default:
        throw new Error(error.message || 'เข้าสู่ระบบไม่สำเร็จ');
    }
  }
};

export const signOutAdmin = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    throw new Error('ออกจากระบบไม่สำเร็จ');
  }
};

export const getCurrentUser = () => {
  return auth.currentUser;
};

// Admin utility functions
export const hasPermission = (admin: AdminProfile, permission: AdminPermission): boolean => {
  return admin.permissions.includes(permission) || admin.role === 'super_admin';
};

export const canAccessDepartment = (admin: AdminProfile, targetDepartment: AdminDepartment): boolean => {
  // Super admin can access all departments
  if (admin.role === 'super_admin' || admin.department === 'all') {
    return true;
  }
  
  // Admin can only access their own department
  return admin.department === targetDepartment;
};

export const getAdminPermissions = (role: AdminRole): AdminPermission[] => {
  const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
    super_admin: [
      'manage_users', 'manage_activities', 'view_reports', 
      'export_data', 'manage_admins', 'system_settings', 'moderate_content'
    ],
    department_admin: [
      'manage_users', 'manage_activities', 'view_reports', 
      'export_data', 'moderate_content'
    ],
    moderator: [
      'manage_activities', 'view_reports', 'moderate_content'
    ],
    viewer: [
      'view_reports'
    ]
  };
  
  return ROLE_PERMISSIONS[role] || [];
};

export const getAllAdmins = async (): Promise<AdminProfile[]> => {
  try {
    const q = query(collection(db, 'admins'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
      uid: doc.id,
      ...doc.data()
    })) as AdminProfile[];
  } catch (error) {
    console.error('Error fetching admins:', error);
    throw new Error('ไม่สามารถดึงข้อมูลผู้ดูแลได้');
  }
};

// User management functions
export const getAllUsers = async (): Promise<UserProfile[]> => {
  try {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
      uid: doc.id,
      ...doc.data()
    })) as UserProfile[];
  } catch (error) {
    console.error('Error fetching users:', error);
    throw new Error('ไม่สามารถดึงข้อมูลผู้ใช้ได้');
  }
};

export const getPendingUsers = async (): Promise<UserProfile[]> => {
  try {
    const q = query(
      collection(db, 'users'),
      where('isVerified', '==', false),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
      uid: doc.id,
      ...doc.data()
    })) as UserProfile[];
  } catch (error) {
    console.error('Error fetching pending users:', error);
    throw new Error('ไม่สามารถดึงข้อมูลผู้ใช้รอการอนุมัติได้');
  }
};

export const getUsersByDepartment = async (department: string): Promise<UserProfile[]> => {
  try {
    const q = query(
      collection(db, 'users'),
      where('department', '==', department),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
      uid: doc.id,
      ...doc.data()
    })) as UserProfile[];
  } catch (error) {
    console.error('Error fetching users by department:', error);
    // If compound query fails, try simple query without orderBy
    try {
      const simpleQ = query(
        collection(db, 'users'),
        where('department', '==', department)
      );
      const simpleSnapshot = await getDocs(simpleQ);
      return simpleSnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
        uid: doc.id,
        ...doc.data()
      })) as UserProfile[];
    } catch (fallbackError) {
      console.error('Error in fallback query:', fallbackError);
      throw new Error('ไม่สามารถดึงข้อมูลผู้ใช้ตามแผนกได้');
    }
  }
};

export const getPendingUsersByDepartment = async (department: string): Promise<UserProfile[]> => {
  try {
    const q = query(
      collection(db, 'users'),
      where('department', '==', department),
      where('isVerified', '==', false),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
      uid: doc.id,
      ...doc.data()
    })) as UserProfile[];
  } catch (error) {
    console.error('Error fetching pending users by department:', error);
    // If compound query fails, try without orderBy
    try {
      const simpleQ = query(
        collection(db, 'users'),
        where('department', '==', department),
        where('isVerified', '==', false)
      );
      const simpleSnapshot = await getDocs(simpleQ);
      return simpleSnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
        uid: doc.id,
        ...doc.data()
      })) as UserProfile[];
    } catch (fallbackError) {
      console.error('Error in fallback query:', fallbackError);
      throw new Error('ไม่สามารถดึงข้อมูลผู้ใช้รอการอนุมัติตามแผนกได้');
    }
  }
};

export const approveUser = async (userId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      isVerified: true,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error approving user:', error);
    throw new Error('ไม่สามารถอนุมัติผู้ใช้ได้');
  }
};

export const suspendUser = async (userId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      isActive: false,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error suspending user:', error);
    throw new Error('ไม่สามารถระงับผู้ใช้ได้');
  }
};

// Activity management functions
export const getAllActivities = async (): Promise<ActivityRecord[]> => {
  try {
    // Try with orderBy first
    try {
      const q = query(collection(db, 'activityQRCodes'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startDateTime: data.startDateTime?.toDate?.() || new Date(data.startDateTime || Date.now()),
          endDateTime: data.endDateTime?.toDate?.() || new Date(data.endDateTime || Date.now()),
        } as ActivityRecord;
      });
    } catch (orderError) {
      console.warn('OrderBy query failed, trying simple query:', orderError);
      // Fallback without orderBy
      const simpleQ = query(collection(db, 'activityQRCodes'));
      const snapshot = await getDocs(simpleQ);
      return snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startDateTime: data.startDateTime?.toDate?.() || new Date(data.startDateTime || Date.now()),
          endDateTime: data.endDateTime?.toDate?.() || new Date(data.endDateTime || Date.now()),
        } as ActivityRecord;
      });
    }
  } catch (error) {
    console.error('Error fetching activities:', error);
    throw new Error('ไม่สามารถดึงข้อมูลกิจกรรมได้');
  }
};

export const getActivitiesByDepartment = async (department: string): Promise<ActivityRecord[]> => {
  try {
    // Try with orderBy first
    try {
      const q = query(
        collection(db, 'activityQRCodes'),
        where('department', '==', department),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startDateTime: data.startDateTime?.toDate?.() || new Date(data.startDateTime || Date.now()),
          endDateTime: data.endDateTime?.toDate?.() || new Date(data.endDateTime || Date.now()),
        } as ActivityRecord;
      });
    } catch (orderError) {
      console.warn('OrderBy query failed, trying simple query:', orderError);
      // Fallback without orderBy
      const simpleQ = query(
        collection(db, 'activityQRCodes'),
        where('department', '==', department)
      );
      const snapshot = await getDocs(simpleQ);
      return snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startDateTime: data.startDateTime?.toDate?.() || new Date(data.startDateTime || Date.now()),
          endDateTime: data.endDateTime?.toDate?.() || new Date(data.endDateTime || Date.now()),
        } as ActivityRecord;
      });
    }
  } catch (error) {
    console.error('Error fetching activities by department:', error);
    throw new Error('ไม่สามารถดึงข้อมูลกิจกรรมตามแผนกได้');
  }
};

export const getAllActivityRecords = async (): Promise<ActivityRecord[]> => {
  try {
    // Try with orderBy first
    try {
      const q = query(collection(db, 'activityRecords'), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
        id: doc.id,
        ...doc.data()
      })) as ActivityRecord[];
    } catch (orderError) {
      console.warn('OrderBy query failed, trying simple query:', orderError);
      // Fallback without orderBy
      const simpleQ = query(collection(db, 'activityRecords'));
      const snapshot = await getDocs(simpleQ);
      return snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
        id: doc.id,
        ...doc.data()
      })) as ActivityRecord[];
    }
  } catch (error) {
    console.error('Error fetching activity records:', error);
    throw new Error('ไม่สามารถดึงข้อมูลบันทึกกิจกรรมได้');
  }
};

export const getActivityRecordsByDepartment = async (department: string): Promise<ActivityRecord[]> => {
  try {
    // Try with orderBy first
    try {
      const q = query(
        collection(db, 'activityRecords'),
        where('department', '==', department),
        orderBy('timestamp', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
        id: doc.id,
        ...doc.data()
      })) as ActivityRecord[];
    } catch (orderError) {
      console.warn('OrderBy query failed, trying simple query:', orderError);
      // Fallback without orderBy
      const simpleQ = query(
        collection(db, 'activityRecords'),
        where('department', '==', department)
      );
      const snapshot = await getDocs(simpleQ);
      return snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
        id: doc.id,
        ...doc.data()
      })) as ActivityRecord[];
    }
  } catch (error) {
    console.error('Error fetching activity records by department:', error);
    throw new Error('ไม่สามารถดึงข้อมูลบันทึกกิจกรรมตามแผนกได้');
  }
};

// Activity CRUD operations
export const createActivity = async (activityData: Partial<ActivityRecord>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'activityQRCodes'), {
      ...activityData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: true
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating activity:', error);
    throw new Error('ไม่สามารถสร้างกิจกรรมได้');
  }
};

export const updateActivity = async (activityId: string, updates: Partial<ActivityRecord>): Promise<void> => {
  try {
    await updateDoc(doc(db, 'activityQRCodes', activityId), {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating activity:', error);
    throw new Error('ไม่สามารถอัพเดทกิจกรรมได้');
  }
};

export const deleteActivity = async (activityId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'activityQRCodes', activityId));
  } catch (error) {
    console.error('Error deleting activity:', error);
    throw new Error('ไม่สามารถลบกิจกรรมได้');
  }
};

export const toggleActivityStatus = async (activityId: string, isActive: boolean): Promise<void> => {
  try {
    await updateDoc(doc(db, 'activityQRCodes', activityId), {
      isActive: !isActive,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error toggling activity status:', error);
    throw new Error('ไม่สามารถเปลี่ยนสถานะกิจกรรมได้');
  }
};