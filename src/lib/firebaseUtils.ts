// lib/firebaseUtils.ts
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from './firebase';
import { AdminSettings, ActivityRecord, Department } from '../types';

/**
 * ดึงการตั้งค่าแอดมิน
 */
export const getAdminSettings = async (): Promise<AdminSettings | null> => {
  try {
    const docRef = doc(db, 'adminSettings', 'main');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      } as AdminSettings;
    } else {
      console.log('No admin settings found, creating default...');
      return await createDefaultAdminSettings();
    }
  } catch (error) {
    console.error('Error getting admin settings:', error);
    throw error;
  }
};

/**
 * สร้างการตั้งค่าแอดมินเริ่มต้น
 */
export const createDefaultAdminSettings = async (): Promise<AdminSettings> => {
  const defaultSettings: AdminSettings = {
    id: 'main',
    allowedLocation: {
      latitude: 7.007373066216206, // พิกัดมหาวิทยาลัยสงขลานครินทร์
      longitude: 100.4925,
      radius: 100 // 100 เมตร
      ,
      endTime: undefined,
      startTime: undefined
    },
    adminCode: 'ADMIN123',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  try {
    const docRef = doc(db, 'adminSettings', 'main');
    await setDoc(docRef, {
      ...defaultSettings,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Default admin settings created');
    return defaultSettings;
  } catch (error) {
    console.error('Error creating default admin settings:', error);
    throw error;
  }
};

/**
 * อัพเดตการตั้งค่าแอดมิน
 */
export const updateAdminSettings = async (settings: Partial<AdminSettings>): Promise<void> => {
  try {
    const docRef = doc(db, 'adminSettings', 'main');
    await updateDoc(docRef, {
      ...settings,
      updatedAt: serverTimestamp()
    });
    console.log('✅ Admin settings updated');
  } catch (error) {
    console.error('Error updating admin settings:', error);
    throw error;
  }
};

/**
 * บันทึกข้อมูลการลงทะเบียนกิจกรรม
 */
export const saveActivityRecord = async (record: Omit<ActivityRecord, 'id' | 'timestamp'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'activityRecords'), {
      ...record,
      timestamp: serverTimestamp()
    });
    
    console.log('✅ Activity record saved with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving activity record:', error);
    throw error;
  }
};

/**
 * ตรวจสอบการลงทะเบียนซ้ำ
 */
export const checkDuplicateRegistration = async (studentId: string, activityCode: string): Promise<boolean> => {
  try {
    const q = query(
      collection(db, 'activityRecords'),
      where('studentId', '==', studentId),
      where('activityCode', '==', activityCode)
    );
    
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking duplicate registration:', error);
    return false; // ในกรณีเกิด error ให้อนุญาตการลงทะเบียน
  }
};

/**
 * ดึงข้อมูลการลงทะเบียนทั้งหมดของกิจกรรม
 */
export const getActivityRecords = async (activityCode?: string): Promise<ActivityRecord[]> => {
  try {
    let q;
    if (activityCode) {
      q = query(
        collection(db, 'activityRecords'),
        where('activityCode', '==', activityCode),
        orderBy('timestamp', 'desc')
      );
    } else {
      q = query(
        collection(db, 'activityRecords'),
        orderBy('timestamp', 'desc'),
        limit(100) // จำกัด 100 รายการล่าสุด
      );
    }
    
    const querySnapshot = await getDocs(q);
    const records: ActivityRecord[] = [];
    
    querySnapshot.forEach((doc) => {
      records.push({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() // แปลง Firestore Timestamp เป็น Date
      } as ActivityRecord);
    });
    
    return records;
  } catch (error) {
    console.error('Error getting activity records:', error);
    throw error;
  }
};

/**
 * ดึงข้อมูลสาขาทั้งหมด
 */
export const getDepartments = async (): Promise<Department[]> => {
  try {
    const q = query(
      collection(db, 'departments'),
      where('isActive', '==', true),
      orderBy('name')
    );
    
    const querySnapshot = await getDocs(q);
    const departments: Department[] = [];
    
    querySnapshot.forEach((doc) => {
      departments.push({
        id: doc.id,
        ...doc.data()
      } as Department);
    });
    
    return departments;
  } catch (error) {
    console.error('Error getting departments:', error);
    throw error;
  }
};

/**
 * สร้างสาขาใหม่
 */
export const createDepartment = async (name: string): Promise<void> => {
  try {
    const departmentId = name.replace(/\s+/g, '_');
    const docRef = doc(db, 'departments', departmentId);
    
    await setDoc(docRef, {
      name,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Department created:', name);
  } catch (error) {
    console.error('Error creating department:', error);
    throw error;
  }
};

/**
 * สร้างสาขาเริ่มต้นทั้งหมด
 */
export const initializeDefaultDepartments = async (): Promise<void> => {
  const defaultDepartments = [
    'วิศวกรรมศาสตร์',
    'วิทยาศาสตร์',
    'เทคโนโลยีสารสนเทศ',
    'บริหารธุรกิจ',
    'ศิลปศาสตร์',
    'ครุศาสตร์',
    'แพทยศาสตร์',
    'พยาบาลศาสตร์',
    'เภสัชศาสตร์',
    'ทันตแพทยศาสตร์',
    'วิศวกรรมคอมพิวเตอร์',
    'นิเทศศาสตร์',
    'นิติศาสตร์',
    'เศรษฐศาสตร์',
    'การจัดการ'
  ];

  try {
    for (const deptName of defaultDepartments) {
      await createDepartment(deptName);
    }
    console.log('✅ All default departments initialized');
  } catch (error) {
    console.error('Error initializing departments:', error);
    throw error;
  }
};

/**
 * ลบข้อมูลการลงทะเบียน
 */
export const deleteActivityRecord = async (recordId: string): Promise<void> => {
  try {
    const docRef = doc(db, 'activityRecords', recordId);
    await deleteDoc(docRef);
    console.log('✅ Activity record deleted:', recordId);
  } catch (error) {
    console.error('Error deleting activity record:', error);
    throw error;
  }
};

/**
 * คำนวณระยะทางระหว่างสองจุด (ใช้ Haversine formula)
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // รัศมีโลกเป็นเมตร
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + 
            Math.cos(φ1) * Math.cos(φ2) * 
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // ระยะทางเป็นเมตร
};

/**
 * ตรวจสอบว่าอยู่ในรัศมีที่กำหนดหรือไม่
 */
export const isWithinRadius = (
  userLat: number,
  userLon: number,
  targetLat: number,
  targetLon: number,
  radiusMeters: number
): boolean => {
  const distance = calculateDistance(userLat, userLon, targetLat, targetLon);
  return distance <= radiusMeters;
};

/**
 * ฟังก์ชันสำหรับ Real-time updates
 */
export const subscribeToActivityRecords = (
  activityCode: string,
  callback: (records: ActivityRecord[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'activityRecords'),
    where('activityCode', '==', activityCode),
    orderBy('timestamp', 'desc')
  );

  return onSnapshot(q, (querySnapshot) => {
    const records: ActivityRecord[] = [];
    querySnapshot.forEach((doc) => {
      records.push({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate()
      } as ActivityRecord);
    });
    callback(records);
  });
};

/**
 * สร้างรายงานสถิติ
 */
export const getActivityStatistics = async (activityCode: string) => {
  try {
    const records = await getActivityRecords(activityCode);
    
    // นับจำนวนตามสาขา
    const departmentCounts = records.reduce((acc, record) => {
      acc[record.department] = (acc[record.department] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // นับจำนวนตามวันที่
    const dateCounts = records.reduce((acc, record) => {
      const date = record.timestamp?.toDateString() || 'Unknown';
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRegistrations: records.length,
      departmentCounts,
      dateCounts,
      records
    };
  } catch (error) {
    console.error('Error getting activity statistics:', error);
    throw error;
  }
};

/**
 * ส่งออกข้อมูลเป็น CSV
 */
export const exportToCSV = (records: ActivityRecord[]): string => {
  const headers = ['รหัสนักศึกษา', 'ชื่อ', 'นามสกุล', 'สาขา', 'รหัสกิจกรรม', 'วันที่เวลา'];
  
  const csvContent = [
    headers.join(','),
    ...records.map(record => [
      record.studentId,
      record.firstName,
      record.lastName,
      record.department,
      record.activityCode,
      record.timestamp?.toLocaleString('th-TH') || ''
    ].join(','))
  ].join('\n');

  return csvContent;
};

/**
 * ฟังก์ชันทดสอบการเชื่อมต่อ Firebase
 */
export const testFirebaseConnection = async (): Promise<boolean> => {
  try {
    const testDoc = doc(db, 'test', 'connection');
    await getDoc(testDoc);
    console.log('✅ Firebase connection successful');
    return true;
  } catch (error) {
    console.error('❌ Firebase connection failed:', error);
    return false;
  }
};