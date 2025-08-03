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
 * ฟังก์ชันสำหรับลบ undefined values ออกจาก object
 */
const removeUndefinedFields = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    return obj === undefined ? null : obj;
  }
  
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const cleanedValue = removeUndefinedFields(value);
        if (cleanedValue !== null && Object.keys(cleanedValue).length > 0) {
          cleaned[key] = cleanedValue;
        }
      } else {
        cleaned[key] = value;
      }
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : null;
};

/**
 * ดึงการตั้งค่าแอดมิน
 */
export const getAdminSettings = async (): Promise<AdminSettings | null> => {
  try {
    console.log('กำลังโหลดการตั้งค่าผู้ดูแลระบบ...');
    
    const docRef = doc(db, 'adminSettings', 'main');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      console.log('พบการตั้งค่าผู้ดูแลระบบในฐานข้อมูล');
      const data = docSnap.data();
      
      // ตรวจสอบและแก้ไขข้อมูลที่อาจมี undefined
      const cleanedData = removeUndefinedFields(data);
      
      return {
        id: docSnap.id,
        ...cleanedData
      } as AdminSettings;
    } else {
      console.log('ไม่พบการตั้งค่าผู้ดูแลระบบ กำลังสร้างการตั้งค่าเริ่มต้น...');
      return await createDefaultAdminSettings();
    }
  } catch (error) {
    console.error('Error getting admin settings:', error);
    
    // ถ้าเกิด error ให้ return การตั้งค่าเริ่มต้น
    return getDefaultSettings();
  }
};

/**
 * สร้างการตั้งค่าเริ่มต้น (ไม่บันทึกลงฐานข้อมูล)
 */
const getDefaultSettings = (): AdminSettings => {
  return {
    id: 'main',
    allowedLocation: {
      latitude: 7.007373066216206, // พิกัดมหาวิทยาลัยสงขลานครินทร์
      longitude: 100.4925,
      radius: 100, // 100 เมตร
      // ไม่ใส่ endTime และ startTime หรือใส่เป็น null
      endTime: null,
      startTime: null
    },
    adminCode: 'ADMIN123',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
};

/**
 * สร้างการตั้งค่าแอดมินเริ่มต้น
 */
export const createDefaultAdminSettings = async (): Promise<AdminSettings> => {
  const defaultSettings = getDefaultSettings();

  try {
    const docRef = doc(db, 'adminSettings', 'main');
    
    // ลบ undefined fields ออกก่อนบันทึก
    const cleanedSettings = removeUndefinedFields({
      ...defaultSettings,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    if (!cleanedSettings) {
      throw new Error('ไม่สามารถสร้างการตั้งค่าเริ่มต้นได้');
    }
    
    await setDoc(docRef, cleanedSettings);
    
    console.log('✅ สร้างการตั้งค่าผู้ดูแลระบบเริ่มต้นสำเร็จ');
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
    
    // ลบ undefined fields ออกก่อนบันทึก
    const cleanedSettings = removeUndefinedFields({
      ...settings,
      updatedAt: serverTimestamp()
    });
    
    if (!cleanedSettings) {
      throw new Error('ไม่มีข้อมูลที่ถูกต้องสำหรับการอัพเดท');
    }
    
    await updateDoc(docRef, cleanedSettings);
    console.log('✅ อัพเดทการตั้งค่าผู้ดูแลระบบสำเร็จ');
  } catch (error) {
    console.error('Error updating admin settings:', error);
    throw error;
  }
};

/**
 * รีเซ็ตการตั้งค่าเป็นค่าเริ่มต้น
 */
export const resetAdminSettings = async (): Promise<AdminSettings> => {
  try {
    console.log('กำลังรีเซ็ตการตั้งค่าเป็นค่าเริ่มต้น...');
    
    const docRef = doc(db, 'adminSettings', 'main');
    const defaultSettings = getDefaultSettings();
    
    const cleanedSettings = removeUndefinedFields({
      ...defaultSettings,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    await setDoc(docRef, cleanedSettings);
    console.log('✅ รีเซ็ตการตั้งค่าสำเร็จ');
    
    return defaultSettings;
  } catch (error) {
    console.error('Error resetting admin settings:', error);
    throw error;
  }
};

/**
 * บันทึกข้อมูลการลงทะเบียนกิจกรรม
 */
export const saveActivityRecord = async (record: Omit<ActivityRecord, 'id' | 'timestamp'>): Promise<string> => {
  try {
    // ลบ undefined fields ออกก่อนบันทึก
    const cleanedRecord = removeUndefinedFields({
      ...record,
      timestamp: serverTimestamp()
    });
    
    if (!cleanedRecord) {
      throw new Error('ไม่มีข้อมูลที่ถูกต้องสำหรับการบันทึก');
    }
    
    const docRef = await addDoc(collection(db, 'activityRecords'), cleanedRecord);
    
    console.log('✅ บันทึกข้อมูลกิจกรรมสำเร็จ ID:', docRef.id);
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
    
    const departmentData = removeUndefinedFields({
      name,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    await setDoc(docRef, departmentData);
    
    console.log('✅ สร้างสาขาใหม่สำเร็จ:', name);
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
    console.log('✅ สร้างสาขาเริ่มต้นทั้งหมดสำเร็จ');
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
    console.log('✅ ลบข้อมูลการลงทะเบียนสำเร็จ:', recordId);
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
    console.log('✅ การเชื่อมต่อ Firebase สำเร็จ');
    return true;
  } catch (error) {
    console.error('❌ การเชื่อมต่อ Firebase ล้มเหลว:', error);
    return false;
  }
};