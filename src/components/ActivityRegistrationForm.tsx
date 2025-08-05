'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Grid,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Paper,
  Fade,
  Grow,
  Slide,
  Divider,
  Avatar,
  Chip,
  Stack
} from '@mui/material';
import {
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Person as PersonIcon,
  LocationOn as LocationIcon,
  AccessTime as AccessTimeIcon,
  School as SchoolIcon,
  Badge as BadgeIcon,
  Security as SecurityIcon,
  Edit as EditIcon,
  AccountCircle as AccountCircleIcon,
  Warning as WarningIcon,
  Lock as LockIcon,
  ExitToApp as LogoutIcon,
  AutoAwesome as AutoAwesomeIcon,
  Verified as VerifiedIcon
} from '@mui/icons-material';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import LocationChecker from './LocationChecker';
import { ActivityRecord, AdminSettings } from '../types';
import { validateStudentId, validateThaiName } from '../utils/validation';

interface Department {
  id: string;
  name: string;
  faculty: string;
  isActive: boolean;
}

interface ActivityStatus {
  exists: boolean;
  isActive: boolean;
  activityCode: string;
  description?: string;
  userCode?: string;
  requiresUniversityLogin?: boolean;
  latitude?: number;
  longitude?: number;
  checkInRadius?: number;
  singleUserMode?: boolean;
}

interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  givenName?: string;
  surname?: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  mobilePhone?: string;
}

interface ActivityRegistrationFormProps {
  activityCode: string;
  adminSettings: AdminSettings;
  onSuccess?: () => Promise<void>;
  existingUserProfile?: UserProfile;
  existingAuthStatus: boolean;
  onLogout?: () => Promise<void>;
}

// PSU Faculties
const PSU_FACULTIES = [
  { name: 'คณะวิศวกรรมศาสตร์', code: '01' },
  { name: 'คณะวิทยาศาสตร์', code: '02' },
  { name: 'คณะแพทยศาสตร์', code: '03' },
  { name: 'คณะทรัพยากรธรรมชาติ', code: '04' },
  { name: 'คณะศึกษาศาสตร์', code: '05' },
  { name: 'คณะมนุษยศาสตร์และสังคมศาสตร์', code: '06' },
  { name: 'คณะเศรษฐศาสตร์', code: '07' },
  { name: 'คณะบริหารธุรกิจ', code: '08' },
  { name: 'คณะศิลปกรรมศาสตร์', code: '09' },
  { name: 'คณะพยาบาลศาสตร์', code: '10' },
  { name: 'คณะเภสัชศาสตร์', code: '11' },
  { name: 'คณะทันตแพทยศาสตร์', code: '12' },
  { name: 'คณะสัตวแพทยศาสตร์', code: '13' }
];

// Degree levels
const DEGREE_LEVELS = [
  { name: 'ปริญญาตรี', code: '1' },
  { name: 'ปริญญาโท', code: '2' },
  { name: 'ปริญญาเอก', code: '3' }
];

// สาขาวิชาแยกตามคณะ
const DEPARTMENTS_BY_FACULTY = {
  'คณะวิศวกรรมศาสตร์': [
    'วิศวกรรมคอมพิวเตอร์',
    'วิศวกรรมไฟฟ้า',
    'วิศวกรรมเครื่องกล',
    'วิศวกรรมโยธา',
    'วิศวกรรมเคมี',
    'วิศวกรรมอุตสาหการ',
    'วิศวกรรมสิ่งแวดล้อม',
    'วิศวกรรมเหมืองแร่',
    'วิศวกรรมนิวเคลียร์',
    'วิศวกรรมวัสดุ',
    'วิศวกรรมการผลิต'
  ],
  'คณะวิทยาศาสตร์': [
    'วิทยาการคอมพิวเตอร์',
    'เทคโนโลยีสารสนเทศและการสื่อสาร',
    'เทคโนโลยีสารสนเทศ (ต่อเนื่อง)',
    'คณิตศาสตร์',
    'สถิติ',
    'เคมี',
    'ฟิสิกส์',
    'ชีววิทยา',
    'จุลชีววิทยา',
    'เทคโนโลยีชีวภาพ',
    'วัสดุศาสตร์',
    'เคมี-ชีววิทยาประยุกต์',
    'วิทยาศาสตร์พอลิเมอร์',
    'วิทยาศาสตร์และเทคโนโลยีการอาหาร'
  ],
  'คณะแพทยศาสตร์': [
    'การแพทย์',
    'กายภาพบำบัด',
    'เทคนิคการแพทย์',
    'อาชีวอนามัยและความปลอดภัย'
  ],
  'คณะทรัพยากรธรรมชาติ': [
    'ทรัพยากรธรรมชาติ',
    'วนศาสตร์',
    'ประมง',
    'เทคโนโลยีการประมง',
    'วิทยาศาสตร์สิ่งแวดล้อม',
    'เทคโนโลยีสิ่งแวดล้อม',
    'การจัดการสิ่งแวดล้อม'
  ],
  'คณะศึกษาศาสตร์': [
    'การศึกษาปฐมวัย',
    'การศึกษาประถมศึกษา',
    'คณิตศาสตรศึกษา',
    'วิทยาศาสตรศึกษา',
    'ภาษาไทย',
    'ภาษาอังกฤษ',
    'สังคมศึกษา',
    'พลศึกษา',
    'ดนตรีศึกษา',
    'ศิลปศึกษา'
  ],
  'คณะมนุษยศาสตร์และสังคมศาสตร์': [
    'ภาษาไทย',
    'ภาษาอังกฤษ',
    'ภาษาจีน',
    'ภาษาญี่ปุ่น',
    'ภาษามาเลย์',
    'ประวัติศาสตร์',
    'ปรัชญา',
    'จิตวิทยา',
    'สังคมวิทยา',
    'รัฐศาสตร์',
    'ภูมิศาสตร์',
    'มานุษยวิทยา',
    'นิติศาสตร์',
    'การสื่อสารมวลชน'
  ],
  'คณะเศรษฐศาสตร์': [
    'เศรษฐศาสตร์',
    'เศรษฐศาสตร์ธุรกิจ',
    'เศรษฐศาสตร์การเงินและการธนาคาร',
    'เศรษฐศาสตร์การพัฒนา',
    'เศรษฐศาสตร์การค้าระหว่างประเทศ'
  ],
  'คณะบริหารธุรกิจ': [
    'การจัดการ',
    'การตลาด',
    'การเงิน',
    'การบัญชี',
    'ระบบสารสนเทศทางการจัดการ',
    'การจัดการโลจิสติกส์',
    'การจัดการการท่องเที่ยว',
    'การจัดการทรัพยากรมนุษย์',
    'การประกอบการ'
  ],
  'คณะศิลปกรรมศาสตร์': [
    'ศิลปกรรม',
    'การออกแบบ',
    'สถาปัtyกรรม',
    'ศิลปะการแสดง',
    'ดนตรี',
    'นาฏศิลป์',
    'การออกแบบผลิตภัณฑ์',
    'การออกแบบกราฟิก'
  ],
  'คณะพยาบาลศาสตร์': [
    'พยาบาลศาสตร์',
    'การพยาบาลเวชปฏิบัติ',
    'การพยาบาลชุมชน'
  ],
  'คณะเภสัชศาสตร์': [
    'เภสัชศาสตร์',
    'เภสัชกรรมอุตสาหการ',
    'เวชศาสตร์ชะลอวัย'
  ],
  'คณะทันตแพทยศาสตร์': [
    'ทันตแพทยศาสตร์',
    'ทันตแพทยศาสตร์ชุมชน'
  ],
  'คณะสัตวแพทยศาสตร์': [
    'สัตวแพทยศาสตร์',
    'วิทยาศาสตร์การสัตว์',
    'อนามัยสัตว์น้ำ'
  ]
};

// รวมรายการสาขาทั้งหมดสำหรับ fallback
const ALL_DEPARTMENTS = Object.values(DEPARTMENTS_BY_FACULTY).flat();

const ActivityRegistrationForm: React.FC<ActivityRegistrationFormProps> = ({
  activityCode,
  adminSettings,
  onSuccess,
  existingUserProfile,
  existingAuthStatus,
  onLogout
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [activityStatusLoading, setActivityStatusLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filteredDepartments, setFilteredDepartments] = useState<Department[]>([]);
  const [activityStatus, setActivityStatus] = useState<ActivityStatus>({
    exists: false,
    isActive: false,
    activityCode: '',
    userCode: '',
    requiresUniversityLogin: false,
    latitude: 0,
    longitude: 0,
    checkInRadius: 100,
    singleUserMode: false
  });

  const [forceRefreshEnabled, setForceRefreshEnabled] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [realtimeListener, setRealtimeListener] = useState<(() => void) | null>(null);

  // สถานะการควบคุม Single User Mode
  const [singleUserViolation, setSingleUserViolation] = useState(false);
  const [currentRegisteredUser, setCurrentRegisteredUser] = useState<string>('');

  // Enhanced function to extract information from Microsoft display name
  const extractMicrosoftUserInfo = (displayName: string) => {
    const result = {
      englishName: '',
      firstName: '',
      lastName: '',
      degree: '',
      department: '',
      faculty: '',
      university: 'มหาวิทยาลัยสงขลานครินทร์'
    };

    // Extract English name (before parentheses)
    const englishNameMatch = displayName.match(/^([^(]+)/);
    if (englishNameMatch) {
      result.englishName = englishNameMatch[1].trim();
    }

    // Extract Thai name from parentheses
    const thaiNameMatch = displayName.match(/\(([^)]+)\)/);
    if (thaiNameMatch) {
      const thaiFullName = thaiNameMatch[1].trim();
      const nameParts = thaiFullName.split(/\s+/);
      if (nameParts.length >= 2) {
        result.firstName = nameParts[0];
        result.lastName = nameParts.slice(1).join(' ');
      } else {
        result.firstName = thaiFullName;
        result.lastName = '';
      }
    }

    // Extract degree information
    const degreeMatch = displayName.match(/ปริญญา\w+/);
    if (degreeMatch) {
      result.degree = degreeMatch[0];
    }

    // Extract department/major (สาขาวิชา...)
    const departmentMatch = displayName.match(/สาขาวิชา([^\s]+(?:\s+[^\s]+)*?)(?:\s+คณะ|$)/);
    if (departmentMatch) {
      result.department = departmentMatch[1].trim();
    }

    // Extract faculty (คณะ...)
    const facultyMatch = displayName.match(/คณะ([^\s]+(?:\s+[^\s]+)*?)(?:\s|$)/);
    if (facultyMatch) {
      const facultyName = `คณะ${facultyMatch[1].trim()}`;
      result.faculty = facultyName;
    }

    return result;
  };

  // Generate student ID based on PSU structure
  const generateStudentId = (faculty: string) => {
    const year = new Date().getFullYear().toString().slice(-2);
    const degreeLevel = '1';
    
    let facultyCode = '02';
    const facultyData = PSU_FACULTIES.find(f => f.name === faculty);
    if (facultyData) {
      facultyCode = facultyData.code;
    }
    
    const majorCode = '1';
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    
    return `${year}${degreeLevel}${facultyCode}${majorCode}${randomNum}`;
  };

  // Function to detect faculty and degree from student ID
  const detectInfoFromStudentId = (studentId: string): { faculty: string, degree: string } => {
    const result = { faculty: 'คณะวิทยาศาสตร์', degree: 'ปริญญาตรี' };
    
    if (studentId.length >= 5) {
      const degreeCode = studentId.substring(2, 3);
      const degree = DEGREE_LEVELS.find(d => d.code === degreeCode);
      if (degree) {
        result.degree = degree.name;
      }
      
      const facultyCode = studentId.substring(3, 5);
      const faculty = PSU_FACULTIES.find(f => f.code === facultyCode);
      if (faculty) {
        result.faculty = faculty.name;
      }
    }
    
    return result;
  };

  // ฟังก์ชันดึงข้อมูลจาก Microsoft Profile และสร้างข้อมูลอัตโนมัติ
  function extractAndGenerateUserData(profile?: UserProfile) {
    if (!profile) {
      return {
        studentId: '',
        firstName: '',
        lastName: '',
        department: '',
        faculty: '',
        degree: '',
        university: '',
        englishName: '',
        isAutoFilled: false
      };
    }

    const displayName = profile.displayName || '';
    const email = profile.email || '';
    
    // Extract information from Microsoft display name
    const extractedInfo = extractMicrosoftUserInfo(displayName);
    
    // Try to extract student ID from email first
    let studentId = '';
    let detectedFaculty = extractedInfo.faculty || 'คณะวิทยาศาสตร์';
    let detectedDegree = 'ปริญญาตรี';
    
    const emailMatch = email.match(/^(\d{8,12})/);
    if (emailMatch) {
      studentId = emailMatch[1];
      const detectedInfo = detectInfoFromStudentId(studentId);
      detectedFaculty = detectedInfo.faculty;
      detectedDegree = detectedInfo.degree;
    } else {
      studentId = generateStudentId(detectedFaculty);
    }

    return {
      studentId,
      firstName: extractedInfo.firstName || 'ไม่ระบุ',
      lastName: extractedInfo.lastName || 'ไม่ระบุ',
      department: extractedInfo.department || 'วิทยาการคอมพิวเตอร์',
      faculty: detectedFaculty,
      degree: detectedDegree,
      university: 'มหาวิทยาลัยสงขลานครินทร์',
      englishName: extractedInfo.englishName,
      isAutoFilled: true
    };
  }

  // ตั้งค่า formData - รองรับการดึงข้อมูลอัตโนมัติ
  const [formData, setFormData] = useState(() => {
    const extractedData = extractAndGenerateUserData(existingUserProfile);
    return {
      ...extractedData,
      userCode: '',
      email: existingUserProfile?.email || '',
      microsoftId: existingUserProfile?.id || ''
    };
  });

  // Auto-filled data that cannot be edited (ข้อมูลที่ไม่สามารถแก้ไขได้)
  const [autoFilledData, setAutoFilledData] = useState(() => {
    const extractedData = extractAndGenerateUserData(existingUserProfile);
    return {
      firstName: extractedData.firstName,
      lastName: extractedData.lastName,
      englishName: extractedData.englishName,
      studentId: extractedData.studentId,
      faculty: extractedData.faculty,
      degree: extractedData.degree,
      university: extractedData.university,
      isAutoFilled: extractedData.isAutoFilled
    };
  });

  const steps = ['กรอกข้อมูล', 'ตรวจสอบตำแหน่ง', 'บันทึกสำเร็จ'];

  // ฟังก์ชันสำหรับบังคับโหลดหน้าใหม่
  const handleForceRefresh = () => {
    console.log('🔄 Initiating force refresh...');
    setIsRefreshing(true);
    
    if (realtimeListener) {
      realtimeListener();
      setRealtimeListener(null);
    }
    
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  // ฟังก์ชันสำหรับ logout
  const handleLogout = async () => {
    if (onLogout) {
      try {
        await onLogout();
      } catch (error) {
        console.error('Error during logout:', error);
      }
    }
  };

  // ตรวจสอบ Single User Mode
  const checkSingleUserMode = async () => {
    if (!activityStatus.singleUserMode || !existingUserProfile?.email) {
      return true; // ไม่มีการจำกัด หรือไม่มีข้อมูลผู้ใช้
    }

    try {
      console.log('Checking single user mode for:', existingUserProfile.email);
      
      // ตรวจสอบการลงทะเบียนที่มีอยู่
      const q = query(
        collection(db, 'activityRecords'),
        where('activityCode', '==', activityCode)
      );
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // มีการลงทะเบียนแล้ว ตรวจสอบว่าเป็นคนเดียวกันหรือไม่
        const existingRecord = querySnapshot.docs[0].data();
        const registeredEmail = existingRecord.email;
        
        if (registeredEmail && registeredEmail !== existingUserProfile.email) {
          // มีคนอื่นลงทะเบียนแล้ว
          console.log('Single user mode violation detected:', {
            currentUser: existingUserProfile.email,
            registeredUser: registeredEmail
          });
          
          setSingleUserViolation(true);
          setCurrentRegisteredUser(registeredEmail);
          setError(`กิจกรรมนี้อนุญาตให้ลงทะเบียนได้เพียงผู้ใช้เดียว และมีผู้ใช้ ${registeredEmail} ลงทะเบียนไปแล้ว`);
          return false;
        } else if (registeredEmail === existingUserProfile.email) {
          // ผู้ใช้คนเดียวกันลงทะเบียนแล้ว
          setError('คุณได้ลงทะเบียนกิจกรรมนี้แล้ว');
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error checking single user mode:', error);
      return true; // ถ้า error ให้ผ่านไป
    }
  };

  // ตรวจสอบสถานะกิจกรรมจาก Firebase
  const checkActivityStatus = async () => {
    try {
      setActivityStatusLoading(true);
      console.log('Checking activity status for:', activityCode);
      
      const q = query(
        collection(db, 'activityQRCodes'),
        where('activityCode', '==', activityCode)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log('Activity not found in database');
        setActivityStatus({
          exists: false,
          isActive: false,
          activityCode: activityCode,
          userCode: '',
          requiresUniversityLogin: false,
          latitude: 0,
          longitude: 0,
          checkInRadius: 100,
          singleUserMode: false
        });
      } else {
        const activityDoc = querySnapshot.docs[0];
        const data = activityDoc.data();
        console.log('Activity found:', data);
        
        setActivityStatus({
          exists: true,
          isActive: data.isActive !== undefined ? data.isActive : true,
          activityCode: data.activityCode,
          description: data.description || '',
          userCode: data.userCode || '',
          requiresUniversityLogin: data.requiresUniversityLogin || false,
          latitude: data.latitude || 13.7563,
          longitude: data.longitude || 100.5018,
          checkInRadius: data.checkInRadius || 100,
          singleUserMode: data.singleUserMode || false
        });

        setForceRefreshEnabled(data.forceRefresh === true);

        // ตรวจสอบ Single User Mode
        const canProceed = await checkSingleUserMode();
        if (!canProceed) {
          return;
        }

        // ตั้ง real-time listener
        const unsubscribe = onSnapshot(doc(db, 'activityQRCodes', activityDoc.id), (docSnapshot) => {
          if (docSnapshot.exists()) {
            const updatedData = docSnapshot.data();
            console.log('Activity status updated in real-time:', updatedData);
            
            setActivityStatus(prev => ({
              ...prev,
              isActive: updatedData.isActive !== undefined ? updatedData.isActive : true,
              description: updatedData.description || '',
              userCode: updatedData.userCode || '',
              requiresUniversityLogin: updatedData.requiresUniversityLogin || false,
              latitude: updatedData.latitude || prev.latitude,
              longitude: updatedData.longitude || prev.longitude,
              checkInRadius: updatedData.checkInRadius || prev.checkInRadius,
              singleUserMode: updatedData.singleUserMode || false
            }));

            const newForceRefresh = updatedData.forceRefresh === true;
            
            if (newForceRefresh && !forceRefreshEnabled) {
              console.log('🔄 Force refresh enabled from server - initiating refresh...');
              setForceRefreshEnabled(true);
              setTimeout(() => {
                handleForceRefresh();
              }, 2000);
            } else if (!newForceRefresh && forceRefreshEnabled) {
              console.log('✅ Force refresh disabled from server');
              setForceRefreshEnabled(false);
            }
          }
        });

        setRealtimeListener(() => unsubscribe);
      }
    } catch (error) {
      console.error('Error checking activity status:', error);
      setError('ไม่สามารถตรวจสอบสถานะกิจกรรมได้');
      setActivityStatus({
        exists: false,
        isActive: false,
        activityCode: activityCode,
        userCode: '',
        requiresUniversityLogin: false,
        latitude: 0,
        longitude: 0,
        checkInRadius: 100,
        singleUserMode: false
      });
    } finally {
      setActivityStatusLoading(false);
    }
  };

  // ฟังก์ชันสร้างสาขาเบื้องต้นใน Firebase ถ้ายังไม่มีข้อมูล
  const initializeDepartments = async () => {
    try {
      console.log('🏗️ Initializing departments in Firebase...');
      setDepartmentsLoading(true);
      
      let successCount = 0;
      let errorCount = 0;
      
      // สร้าง batch operations สำหรับประสิทธิภาพที่ดีขึ้น
      const batchPromises = Object.entries(DEPARTMENTS_BY_FACULTY).flatMap(([faculty, departmentList]) =>
        departmentList.map(async (deptName: string) => {
          const deptId = `${faculty}_${deptName}`.replace(/\s+/g, '_').replace(/[\/\(\)]/g, '');
          const deptDoc = doc(db, 'departments', deptId);
          
          try {
            await setDoc(deptDoc, {
              name: deptName,
              faculty: faculty,
              isActive: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            }, { merge: true });
            
            successCount++;
            console.log(`✅ Department initialized: ${faculty} - ${deptName}`);
          } catch (error) {
            errorCount++;
            console.error(`❌ Error initializing department ${faculty} - ${deptName}:`, error);
          }
        })
      );
      
      await Promise.allSettled(batchPromises);
      console.log(`🎉 Departments initialization completed - Success: ${successCount}, Errors: ${errorCount}`);
      
      // ดึงข้อมูลใหม่หลังจากสร้างเสร็จ
      if (successCount > 0) {
        await fetchDepartmentsAfterInit();
      }
      
    } catch (error) {
      console.error('❌ Error in batch initialization:', error);
      setError('เกิดข้อผิดพลาดในการสร้างข้อมูลสาขาเบื้องต้น');
    } finally {
      setDepartmentsLoading(false);
    }
  };

  // ฟังก์ชันดึงข้อมูลหลังจากสร้างเสร็จ
  const fetchDepartmentsAfterInit = async () => {
    try {
      const departmentsQuery = query(
        collection(db, 'departments'),
        where('isActive', '==', true)
      );
      const querySnapshot = await getDocs(departmentsQuery);
      
      let departmentsList: Department[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        departmentsList.push({
          id: doc.id,
          name: data.name,
          faculty: data.faculty,
          isActive: data.isActive
        } as Department);
      });
      
      // Sort departments by faculty then by name in Thai
      departmentsList.sort((a, b) => {
        const facultyCompare = a.faculty.localeCompare(b.faculty, 'th');
        if (facultyCompare !== 0) return facultyCompare;
        return a.name.localeCompare(b.name, 'th');
      });
      
      setDepartments(departmentsList);
      
      console.log(`✅ Loaded ${departmentsList.length} departments after initialization`);
    } catch (error) {
      console.error('❌ Error fetching departments after initialization:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      setDepartmentsLoading(true);
      console.log('📚 Fetching departments from Firebase...');
      
      const departmentsQuery = query(
        collection(db, 'departments'),
        where('isActive', '==', true)
      );
      const querySnapshot = await getDocs(departmentsQuery);
      
      let departmentsList: Department[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        departmentsList.push({
          id: doc.id,
          name: data.name,
          faculty: data.faculty || 'คณะอื่นๆ',
          isActive: data.isActive
        } as Department);
      });

      if (departmentsList.length === 0) {
        console.log('📝 No departments found, initializing default departments...');
        await initializeDepartments();
        return; // initializeDepartments will call fetchDepartmentsAfterInit
      }

      // Sort departments by faculty then by name in Thai
      departmentsList.sort((a, b) => {
        const facultyCompare = a.faculty.localeCompare(b.faculty, 'th');
        if (facultyCompare !== 0) return facultyCompare;
        return a.name.localeCompare(b.name, 'th');
      });
      
      setDepartments(departmentsList);
      
      console.log(`✅ Loaded ${departmentsList.length} departments successfully`);
      
    } catch (error) {
      console.error('❌ Error fetching departments:', error);
      setError('ไม่สามารถโหลดข้อมูลสาขาได้ กรุณาลองใหม่อีกครั้ง');
      
      // Fallback to static departments if Firebase fails
      const fallbackDepartments: Department[] = ALL_DEPARTMENTS.map((name, index) => ({
        id: `fallback-${index}`,
        name,
        faculty: detectFacultyFromDepartment(name),
        isActive: true
      }));
      
      setDepartments(fallbackDepartments);
      console.log('🔄 Using fallback departments');
    } finally {
      setDepartmentsLoading(false);
    }
  };

  // Helper function to detect faculty from department name
  const detectFacultyFromDepartment = (deptName: string): string => {
    for (const [faculty, departmentList] of Object.entries(DEPARTMENTS_BY_FACULTY)) {
      if (departmentList.includes(deptName)) {
        return faculty;
      }
    }
    return 'คณะวิทยาศาสตร์'; // Default
  };

  // Filter departments based on selected faculty
  const updateFilteredDepartments = (selectedFaculty: string) => {
    if (!selectedFaculty) {
      setFilteredDepartments([]);
      return;
    }
    
    const filtered = departments.filter(dept => dept.faculty === selectedFaculty);
    setFilteredDepartments(filtered);
    
    // If current department is not in the new faculty, clear it
    if (formData.department && !filtered.some(dept => dept.name === formData.department)) {
      setFormData(prev => ({ ...prev, department: '' }));
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      await Promise.all([
        checkActivityStatus(),
        fetchDepartments()
      ]);
    };
    
    loadInitialData();

    return () => {
      if (realtimeListener) {
        console.log('🔌 Cleaning up real-time listener');
        realtimeListener();
      }
    };
  }, [activityCode]);

  // Update filtered departments when faculty changes
  useEffect(() => {
    updateFilteredDepartments(formData.faculty);
  }, [formData.faculty, departments]);

  useEffect(() => {
    return () => {
      if (realtimeListener) {
        realtimeListener();
      }
    };
  }, [realtimeListener]);

  const handleInputChange = (field: string) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (forceRefreshEnabled) return;

    setFormData({
      ...formData,
      [field]: event.target.value
    });
    setError('');
  };

  const handleSelectChange = (field: string) => (
    event: SelectChangeEvent<string>
  ) => {
    if (forceRefreshEnabled) return;

    const newValue = event.target.value;
    setFormData({
      ...formData,
      [field]: newValue
    });
    
    // If faculty is changed, update filtered departments
    if (field === 'faculty') {
      updateFilteredDepartments(newValue);
    }
    
    setError('');
  };

  const validateNewStudentId = (studentId: string): boolean => {
    if (!/^\d{10}$/.test(studentId)) {
      return false;
    }
    
    const prefix = studentId.substring(0, 2);
    const prefixNum = parseInt(prefix);
    return prefixNum >= 64 && prefixNum <= 69;
  };

  const validateForm = async (): Promise<boolean> => {
    if (forceRefreshEnabled) {
      setError('ไม่สามารถบันทึกข้อมูลได้ กรุณาโหลดหน้านี้ใหม่');
      return false;
    }

    if (!validateNewStudentId(formData.studentId)) {
      setError('รหัสนักศึกษาไม่ถูกต้อง (ต้องเป็นตัวเลข 10 หลัก และขึ้นต้นด้วย 64-69)');
      return false;
    }
    
    if (!validateThaiName(formData.firstName)) {
      setError('ชื่อไม่ถูกต้อง (ต้องมีอย่างน้อย 2 ตัวอักษร)');
      return false;
    }
    
    if (!validateThaiName(formData.lastName)) {
      setError('นามสกุลไม่ถูกต้อง (ต้องมีอย่างน้อย 2 ตัวอักษร)');
      return false;
    }
    
    if (!formData.faculty) {
      setError('กรุณาเลือกคณะ');
      return false;
    }
    
    if (!formData.department) {
      setError('กรุณาเลือกสาขา');
      return false;
    }
    
    if (!formData.userCode) {
      setError('กรุณาใส่รหัสผู้ใช้');
      return false;
    }

    if (formData.userCode !== activityStatus.userCode) {
      setError('รหัสผู้ใช้ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
      return false;
    }

    // ตรวจสอบการลงทะเบียนซ้ำ
    try {
      const q = query(
        collection(db, 'activityRecords'),
        where('studentId', '==', formData.studentId),
        where('activityCode', '==', activityCode)
      );
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setError('คุณได้ลงทะเบียนกิจกรรมนี้แล้ว');
        return false;
      }
    } catch (error) {
      console.error('Error checking duplicate:', error);
    }

    // ตรวจสอบ Single User Mode อีกครั้งก่อนส่งข้อมูล
    if (activityStatus.singleUserMode) {
      const canProceed = await checkSingleUserMode();
      if (!canProceed) {
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (forceRefreshEnabled) {
      setError('ไม่สามารถบันทึกข้อมูลได้ กรุณาโหลดหน้านี้ใหม่');
      return;
    }

    if (!(await validateForm())) return;
    
    setLoading(true);
    setActiveStep(1);
  };

  const handleLocationVerified = async (location: {
    latitude: number;
    longitude: number;
  }) => {
    if (forceRefreshEnabled) {
      setError('ไม่สามารถบันทึกข้อมูลได้ กรุณาโหลดหน้านี้ใหม่');
      setLoading(false);
      setActiveStep(0);
      return;
    }

    try {
      const activityRecord = {
        studentId: formData.studentId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        faculty: formData.faculty,
        department: formData.department,
        degree: formData.degree,
        university: formData.university,
        activityCode,
        location,
        userCode: formData.userCode,
        email: formData.email,
        microsoftId: formData.microsoftId,
        ...(existingUserProfile && { microsoftProfile: existingUserProfile }),
        ...(autoFilledData.isAutoFilled && { 
          autoFilledData: {
            englishName: autoFilledData.englishName,
            isFromMicrosoft: true
          }
        })
      };

      await addDoc(collection(db, 'activityRecords'), {
        ...activityRecord,
        timestamp: serverTimestamp()
      });

      setActiveStep(2);
      setSuccess(true);
      setLoading(false);

      if (onSuccess) {
        try {
          await onSuccess();
        } catch (error) {
          console.error('Error in onSuccess callback:', error);
        }
      }
    } catch (error) {
      console.error('Error saving record:', error);
      setError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      setLoading(false);
      setActiveStep(0);
    }
  };

  const handleLocationError = (errorMessage: string) => {
    setError(errorMessage);
    setLoading(false);
    setActiveStep(0);
  };

  const getActivityAllowedLocation = () => {
    return {
      latitude: activityStatus.latitude || 13.7563,
      longitude: activityStatus.longitude || 100.5018,
      radius: activityStatus.checkInRadius || 100
    };
  };

  // Helper function to check if field is read-only
  const isFieldReadOnly = (field: string): boolean => {
    if (!autoFilledData.isAutoFilled) return false;
    
    const readOnlyFields = ['studentId', 'firstName', 'lastName', 'faculty', 'degree', 'university'];
    return readOnlyFields.includes(field);
  };

  // แสดง Loading เมื่อกำลังโหลดหน้าใหม่
  if (isRefreshing) {
    return (
      <Fade in={true}>
        <Card 
          elevation={12} 
          sx={{ 
            borderRadius: 4,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
          }}
        >
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <RefreshIcon 
              sx={{ 
                fontSize: 80, 
                mb: 3, 
                animation: 'spin 1s linear infinite',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' },
                }
              }} 
            />
            <Typography variant="h4" sx={{ mt: 2, fontWeight: 700 }}>
              กำลังโหลดหน้าใหม่...
            </Typography>
            <Typography variant="body1" sx={{ mt: 2, opacity: 0.9 }}>
              กรุณารอสักครู่
            </Typography>
          </CardContent>
        </Card>
      </Fade>
    );
  }

  // แสดง Loading เมื่อกำลังตรวจสอบสถานะกิจกรรม
  if (activityStatusLoading) {
    return (
      <Fade in={true}>
        <Card elevation={8} sx={{ borderRadius: 4 }}>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <CircularProgress size={80} thickness={4} sx={{ mb: 3, color: 'primary.main' }} />
            <Typography variant="h4" sx={{ mt: 2, fontWeight: 600, color: 'primary.main' }}>
              กำลังตรวจสอบสถานะกิจกรรม...
            </Typography>
            <Chip 
              label={`รหัสกิจกรรม: ${activityCode}`} 
              variant="outlined" 
              sx={{ mt: 2, fontFamily: 'monospace', fontWeight: 600 }}
            />
          </CardContent>
        </Card>
      </Fade>
    );
  }

  // แสดงหน้าบังคับโหลดใหม่
  if (forceRefreshEnabled) {
    return (
      <Slide direction="up" in={true}>
        <Card 
          elevation={12} 
          sx={{ 
            borderRadius: 4, 
            border: '3px solid', 
            borderColor: 'warning.main',
            background: 'linear-gradient(135deg, #ff9a56 0%, #ff6b6b 100%)',
            color: 'white'
          }}
        >
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <RefreshIcon sx={{ fontSize: 100, mb: 3 }} />
            <Typography variant="h3" gutterBottom fontWeight="bold">
              {isRefreshing ? 'กำลังโหลดหน้าใหม่...' : 'จำเป็นต้องโหลดหน้าใหม่'}
            </Typography>
            <Typography variant="h6" paragraph sx={{ opacity: 0.9 }}>
              {isRefreshing 
                ? 'กรุณารอสักครู่ ระบบกำลังโหลดหน้าใหม่...'
                : 'แอดมินได้เปิดใช้งานการบังคับโหลดหน้าใหม่'
              }
            </Typography>
            
            {!isRefreshing && (
              <Button
                variant="contained"
                size="large"
                onClick={handleForceRefresh}
                disabled={isRefreshing}
                startIcon={<RefreshIcon />}
                sx={{ 
                  px: 4, 
                  py: 1.5, 
                  borderRadius: 3,
                  bgcolor: 'rgba(255,255,255,0.15)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }
                }}
              >
                โหลดหน้าใหม่ทันที
              </Button>
            )}
          </CardContent>
        </Card>
      </Slide>
    );
  }

  // แสดงข้อความเมื่อกิจกรรมไม่มีอยู่ในระบบ
  if (!activityStatus.exists) {
    return (
      <Grow in={true}>
        <Card 
          elevation={8} 
          sx={{ 
            borderRadius: 4, 
            border: '3px solid', 
            borderColor: 'error.main',
            background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
            color: 'white'
          }}
        >
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <ErrorIcon sx={{ fontSize: 100, mb: 3 }} />
            <Typography variant="h3" gutterBottom fontWeight="bold">
              ไม่พบกิจกรรมนี้
            </Typography>
            <Typography variant="h6" paragraph sx={{ opacity: 0.9 }}>
              ไม่พบกิจกรรมที่มีรหัส
            </Typography>
            <Chip 
              label={activityCode} 
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                color: 'white', 
                fontFamily: 'monospace',
                fontWeight: 600,
                fontSize: '1.1rem'
              }}
            />
          </CardContent>
        </Card>
      </Grow>
    );
  }

  // แสดงข้อความเมื่อกิจกรรมปิดการลงทะเบียน
  if (!activityStatus.isActive) {
    return (
      <Grow in={true}>
        <Card 
          elevation={8} 
          sx={{ 
            borderRadius: 4, 
            border: '3px solid', 
            borderColor: 'warning.main',
            background: 'linear-gradient(135deg, #ffa726 0%, #fb8c00 100%)',
            color: 'white'
          }}
        >
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <BlockIcon sx={{ fontSize: 100, mb: 3 }} />
            <Typography variant="h3" gutterBottom fontWeight="bold">
              กิจกรรมปิดการลงทะเบียนแล้ว
            </Typography>
            <Typography variant="h6" paragraph sx={{ opacity: 0.9 }}>
              กิจกรรมได้ปิดการลงทะเบียนแล้ว
            </Typography>
            <Chip 
              label={activityStatus.activityCode} 
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                color: 'white', 
                fontFamily: 'monospace',
                fontWeight: 600
              }}
            />
          </CardContent>
        </Card>
      </Grow>
    );
  }

  // แสดงข้อความเมื่อไม่มีรหัสผู้ใช้ในกิจกรรม
  if (!activityStatus.userCode) {
    return (
      <Grow in={true}>
        <Card 
          elevation={8} 
          sx={{ 
            borderRadius: 4, 
            border: '3px solid', 
            borderColor: 'warning.main',
            background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
            color: 'white'
          }}
        >
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <PersonIcon sx={{ fontSize: 100, mb: 3 }} />
            <Typography variant="h3" gutterBottom fontWeight="bold">
              ไม่มีรหัสผู้ใช้
            </Typography>
            <Typography variant="h6" paragraph sx={{ opacity: 0.9 }}>
              กิจกรรมยังไม่ได้ตั้งค่ารหัสผู้ใช้
            </Typography>
            <Chip 
              label={activityStatus.activityCode} 
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                color: 'white', 
                fontFamily: 'monospace',
                fontWeight: 600
              }}
            />
          </CardContent>
        </Card>
      </Grow>
    );
  }

  // แสดงข้อความเมื่อละเมิด Single User Mode
  if (singleUserViolation) {
    return (
      <Grow in={true}>
        <Card 
          elevation={8} 
          sx={{ 
            borderRadius: 4, 
            border: '3px solid', 
            borderColor: 'error.main',
            background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
            color: 'white'
          }}
        >
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <LockIcon sx={{ fontSize: 100, mb: 3 }} />
            <Typography variant="h3" gutterBottom fontWeight="bold">
              ไม่สามารถลงทะเบียนได้
            </Typography>
            <Typography variant="h6" paragraph sx={{ opacity: 0.9 }}>
              กิจกรรมนี้อนุญาตให้ลงทะเบียนได้เพียงผู้ใช้เดียวเท่านั้น
            </Typography>
            <Chip 
              label={currentRegisteredUser} 
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                color: 'white', 
                mb: 4,
                fontWeight: 600
              }}
            />
            
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button
                variant="contained"
                size="large"
                onClick={handleLogout}
                startIcon={<LogoutIcon />}
                sx={{ 
                  px: 4, 
                  py: 1.5, 
                  borderRadius: 3,
                  bgcolor: 'rgba(255,255,255,0.15)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }
                }}
              >
                ออกจากระบบ
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => window.close()}
                sx={{ 
                  px: 4, 
                  py: 1.5, 
                  borderRadius: 3,
                  borderColor: 'rgba(255,255,255,0.5)',
                  color: 'white',
                  '&:hover': { 
                    borderColor: 'white',
                    bgcolor: 'rgba(255,255,255,0.1)'
                  }
                }}
              >
                ปิดหน้าต่าง
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Grow>
    );
  }

  // แสดงหน้าเตือนถ้าต้องการ Microsoft Login แต่ไม่มีข้อมูล
  if (activityStatus.requiresUniversityLogin && !existingUserProfile && !existingAuthStatus) {
    return (
      <Grow in={true}>
        <Card 
          elevation={8} 
          sx={{ 
            borderRadius: 4, 
            border: '3px solid', 
            borderColor: 'warning.main',
            background: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)',
            color: 'white'
          }}
        >
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <WarningIcon sx={{ fontSize: 100, mb: 3 }} />
            <Typography variant="h3" gutterBottom fontWeight="bold">
              จำเป็นต้องเข้าสู่ระบบ
            </Typography>
            <Typography variant="h6" paragraph sx={{ opacity: 0.9 }}>
              กิจกรรมนี้ต้องการให้เข้าสู่ระบบด้วยบัญชี Microsoft ของมหาวิทยาลัยก่อน
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={() => window.history.back()}
              sx={{ 
                px: 4, 
                py: 1.5, 
                borderRadius: 3,
                bgcolor: 'rgba(255,255,255,0.15)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }
              }}
            >
              กลับไปเข้าสู่ระบบ
            </Button>
          </CardContent>
        </Card>
      </Grow>
    );
  }

  // แสดงหน้าสำเร็จ
  if (success) {
    return (
      <Fade in={true}>
        <Card 
          elevation={12} 
          sx={{ 
            borderRadius: 4, 
            border: '3px solid', 
            borderColor: 'success.main',
            background: 'linear-gradient(135deg, #00b894 0%, #00a085 100%)',
            color: 'white'
          }}
        >
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <CheckCircleIcon sx={{ fontSize: 120, mb: 3 }} />
            <Typography variant="h3" gutterBottom fontWeight="bold">
              บันทึกสำเร็จ!
            </Typography>
            <Typography variant="h6" paragraph sx={{ opacity: 0.9 }}>
              ข้อมูลการเข้าร่วมกิจกรรมของคุณได้รับการบันทึกเรียบร้อยแล้ว
            </Typography>

            {/* แสดงข้อมูลผู้ใช้ Microsoft ถ้ามี */}
            {existingUserProfile && (
              <Paper sx={{ 
                p: 3, 
                bgcolor: 'rgba(255,255,255,0.15)', 
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.2)', 
                mb: 3,
                borderRadius: 3,
                color: 'white'
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', mr: 2 }}>
                    <AccountCircleIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6" fontWeight="bold">
                      บัญชี Microsoft
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      {existingUserProfile.email}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            )}

            {/* แสดงข้อความสำหรับ Single User Mode */}
            {activityStatus.singleUserMode && (
              <Alert 
                severity="info" 
                sx={{ 
                  mb: 3, 
                  borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.15)',
                  color: 'white',
                  '& .MuiAlert-icon': { color: 'white' }
                }}
              >
                <Typography variant="body2" fontWeight="medium">
                  🔒 กิจกรรมนี้เป็นโหมดผู้ใช้เดียว - การลงทะเบียนของบัญชีอื่นจะถูกปฏิเสธ
                </Typography>
              </Alert>
            )}
            
            <Paper sx={{ 
              p: 4, 
              bgcolor: 'rgba(255,255,255,0.15)', 
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)', 
              mb: 4,
              borderRadius: 3,
              color: 'white'
            }}>
              <Grid container spacing={2} sx={{ textAlign: 'left' }}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <BadgeIcon sx={{ mr: 2 }} />
                    <Box>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>รหัสกิจกรรม</Typography>
                      <Typography variant="body1" fontWeight="600">{formData.firstName} {formData.lastName}</Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <BadgeIcon sx={{ mr: 2 }} />
                    <Box>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>รหัสนักศึกษา</Typography>
                      <Typography variant="body1" fontWeight="600" fontFamily="monospace">{formData.studentId}</Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <SchoolIcon sx={{ mr: 2 }} />
                    <Box>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>คณะ</Typography>
                      <Typography variant="body1" fontWeight="600">{formData.faculty}</Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <SchoolIcon sx={{ mr: 2 }} />
                    <Box>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>สาขา</Typography>
                      <Typography variant="body1" fontWeight="600">{formData.department}</Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <SchoolIcon sx={{ mr: 2 }} />
                    <Box>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>ระดับการศึกษา</Typography>
                      <Typography variant="body1" fontWeight="600">{formData.degree}</Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <AccessTimeIcon sx={{ mr: 2 }} />
                    <Box>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>เวลาที่บันทึก</Typography>
                      <Typography variant="body1" fontWeight="600">{new Date().toLocaleString('th-TH')}</Typography>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
            
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button
                variant="contained"
                size="large"
                onClick={() => window.close()}
                sx={{ 
                  px: 4, 
                  py: 1.5, 
                  borderRadius: 3,
                  bgcolor: 'rgba(255,255,255,0.15)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }
                }}
              >
                ปิดหน้าต่าง
              </Button>
              {/* ปุ่มลงทะเบียนคนอื่นจะแสดงเฉพาะเมื่อไม่ใช่ Single User Mode */}
              {!activityStatus.singleUserMode && (
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => {
                    setSuccess(false);
                    setActiveStep(0);
                    const extractedData = extractAndGenerateUserData(existingUserProfile);
                    setFormData({
                      ...extractedData,
                      userCode: '',
                      email: existingUserProfile?.email || '',
                      microsoftId: existingUserProfile?.id || ''
                    });
                  }}
                  sx={{ 
                    px: 4, 
                    py: 1.5, 
                    borderRadius: 3,
                    borderColor: 'rgba(255,255,255,0.5)',
                    color: 'white',
                    '&:hover': { 
                      borderColor: 'white',
                      bgcolor: 'rgba(255,255,255,0.1)'
                    }
                  }}
                >
                  ลงทะเบียนคนอื่น
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Fade>
    );
  }

  // แสดงฟอร์มลงทะเบียน (เมื่อกิจกรรมเปิดใช้งาน)
  return (
    <Fade in={true}>
      <Card elevation={8} sx={{ borderRadius: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography 
              variant="h3" 
              gutterBottom 
              fontWeight="bold" 
              sx={{
                background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              ลงทะเบียนกิจกรรม
            </Typography>
            
            {/* แสดงสถานะ Single User Mode */}
            {activityStatus.singleUserMode && (
              <Alert 
                severity="warning" 
                sx={{ 
                  mt: 2, 
                  mb: 2, 
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, #ff9a56 0%, #ff6b6b 100%)',
                  color: 'white',
                  '& .MuiAlert-icon': { color: 'white' },
                  border: 'none'
                }}
              >
                <Typography variant="body2" fontWeight="medium">
                  🔒 <strong>โหมดผู้ใช้เดียว</strong> - กิจกรรมนี้อนุญาตให้ลงทะเบียนได้เพียงบัญชีเดียวเท่านั้น
                </Typography>
              </Alert>
            )}
            
            {/* แสดงสถานะการโหลดสาขา */}
            {departmentsLoading && (
              <Alert 
                severity="info" 
                sx={{ 
                  mt: 2, 
                  mb: 2, 
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)',
                  color: 'white',
                  '& .MuiAlert-icon': { color: 'white' },
                  border: 'none'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CircularProgress size={20} sx={{ color: 'white' }} />
                  <Typography variant="body2">
                    กำลังโหลดข้อมูลสาขา... ({Object.values(DEPARTMENTS_BY_FACULTY).flat().length} สาขา)
                  </Typography>
                </Box>
              </Alert>
            )}
          </Box>

          <Stepper 
            activeStep={activeStep} 
            sx={{ 
              mb: 4,
              '& .MuiStepLabel-root .Mui-completed': {
                color: 'success.main',
              },
              '& .MuiStepLabel-root .Mui-active': {
                color: 'primary.main',
              },
            }}
          >
            {steps.map((label, index) => (
              <Step key={label}>
                <StepLabel 
                  sx={{
                    '& .MuiStepLabel-label': {
                      fontWeight: activeStep === index ? 'bold' : 'normal',
                      color: activeStep === index ? 'primary.main' : 'text.secondary'
                    }
                  }}
                >
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>

          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 3, 
                borderRadius: 3,
                background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
                color: 'white',
                '& .MuiAlert-icon': { color: 'white' },
                border: 'none'
              }}
            >
              {error}
            </Alert>
          )}

          {/* Step 1: Form Input */}
          {activeStep === 0 && (
            <Fade in={true}>
              <Box>
                {/* Microsoft Account Info */}
                {existingUserProfile && (
                  <Paper sx={{ 
                    p: 3, 
                    mb: 4, 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    borderRadius: 4,
                    border: 'none'
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', mr: 2 }}>
                        <AccountCircleIcon />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" fontWeight="bold">
                          เข้าสู่ระบบด้วยบัญชี Microsoft
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                          {existingUserProfile.email}
                        </Typography>
                      </Box>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={handleLogout}
                        startIcon={<LogoutIcon />}
                        sx={{ 
                          borderRadius: 2,
                          borderColor: 'rgba(255,255,255,0.5)',
                          color: 'white',
                          '&:hover': { 
                            borderColor: 'white',
                            bgcolor: 'rgba(255,255,255,0.1)'
                          }
                        }}
                      >
                        ออกจากระบบ
                      </Button>
                    </Box>
                    
                    {autoFilledData.isAutoFilled && (
                      <Box 
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          p: 2, 
                          bgcolor: 'rgba(255,255,255,0.15)', 
                          borderRadius: 2,
                          backdropFilter: 'blur(10px)'
                        }}
                      >
                        <AutoAwesomeIcon sx={{ mr: 2, color: '#ffd700' }} />
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            ข้อมูลได้รับการดึงอัตโนมัติจากบัญชี Microsoft
                          </Typography>
                          <Typography variant="caption" sx={{ opacity: 0.8 }}>
                            ข้อมูลบางส่วนจะไม่สามารถแก้ไขได้
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </Paper>
                )}

                <Grid container spacing={3}>
                  {/* Student ID */}
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="รหัสนักศึกษา"
                      value={formData.studentId}
                      onChange={handleInputChange('studentId')}
                      fullWidth
                      required
                      disabled={isFieldReadOnly('studentId') || loading || forceRefreshEnabled}
                      InputProps={{
                        startAdornment: (
                          <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                            <BadgeIcon sx={{ color: 'text.secondary' }} />
                            {isFieldReadOnly('studentId') && (
                              <VerifiedIcon sx={{ color: 'primary.main', ml: 0.5, fontSize: 16 }} />
                            )}
                          </Box>
                        )
                      }}
                      helperText={isFieldReadOnly('studentId') ? 
                        "ข้อมูลจาก Microsoft" : 
                        "เช่น 6421021234 (10 หลัก, ขึ้นต้นด้วย 64-69)"
                      }
                      sx={{
                        '& .MuiInputBase-input': {
                          fontFamily: 'monospace'
                        },
                        '& .MuiFormHelperText-root': {
                          color: isFieldReadOnly('studentId') ? 'primary.main' : 'text.secondary'
                        }
                      }}
                    />
                  </Grid>

                  {/* First Name */}
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="ชื่อ"
                      value={formData.firstName}
                      onChange={handleInputChange('firstName')}
                      fullWidth
                      required
                      disabled={isFieldReadOnly('firstName') || loading || forceRefreshEnabled}
                      InputProps={{
                        startAdornment: (
                          <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                            <PersonIcon sx={{ color: 'text.secondary' }} />
                            {isFieldReadOnly('firstName') && (
                              <VerifiedIcon sx={{ color: 'primary.main', ml: 0.5, fontSize: 16 }} />
                            )}
                          </Box>
                        )
                      }}
                      helperText={isFieldReadOnly('firstName') ? 
                        "ข้อมูลจาก Microsoft" : 
                        "ชื่อจริงเป็นภาษาไทย"
                      }
                      sx={{
                        '& .MuiFormHelperText-root': {
                          color: isFieldReadOnly('firstName') ? 'primary.main' : 'text.secondary'
                        }
                      }}
                    />
                  </Grid>

                  {/* Last Name */}
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="นามสกุล"
                      value={formData.lastName}
                      onChange={handleInputChange('lastName')}
                      fullWidth
                      required
                      disabled={isFieldReadOnly('lastName') || loading || forceRefreshEnabled}
                      InputProps={{
                        startAdornment: (
                          <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                            <PersonIcon sx={{ color: 'text.secondary' }} />
                            {isFieldReadOnly('lastName') && (
                              <VerifiedIcon sx={{ color: 'primary.main', ml: 0.5, fontSize: 16 }} />
                            )}
                          </Box>
                        )
                      }}
                      helperText={isFieldReadOnly('lastName') ? 
                        "ข้อมูลจาก Microsoft" : 
                        "นามสกุลเป็นภาษาไทย"
                      }
                      sx={{
                        '& .MuiFormHelperText-root': {
                          color: isFieldReadOnly('lastName') ? 'primary.main' : 'text.secondary'
                        }
                      }}
                    />
                  </Grid>

                  {/* Faculty */}
                  <Grid item xs={12} sm={6}>
                    <FormControl 
                      fullWidth 
                      required 
                      disabled={isFieldReadOnly('faculty') || loading || forceRefreshEnabled}
                    >
                      <InputLabel>คณะ</InputLabel>
                      <Select
                        value={formData.faculty}
                        onChange={handleSelectChange('faculty')}
                        label="คณะ"
                        startAdornment={
                          <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                            <SchoolIcon sx={{ color: 'text.secondary' }} />
                            {isFieldReadOnly('faculty') && (
                              <VerifiedIcon sx={{ color: 'primary.main', ml: 0.5, fontSize: 16 }} />
                            )}
                          </Box>
                        }
                      >
                        {PSU_FACULTIES.map((faculty) => (
                          <MenuItem key={faculty.code} value={faculty.name}>
                            {faculty.name}
                          </MenuItem>
                        ))}
                      </Select>
                      {isFieldReadOnly('faculty') && (
                        <Typography variant="caption" color="primary.main" sx={{ mt: 0.5, ml: 1 }}>
                          ข้อมูลจาก Microsoft
                        </Typography>
                      )}
                    </FormControl>
                  </Grid>

                  {/* Department */}
                  <Grid item xs={12} sm={6}>
                    <FormControl 
                      fullWidth 
                      required 
                      disabled={departmentsLoading || loading || forceRefreshEnabled || !formData.faculty}
                    >
                      <InputLabel>สาขาวิชา</InputLabel>
                      <Select
                        value={formData.department}
                        onChange={handleSelectChange('department')}
                        label="สาขาวิชา"
                        startAdornment={<SchoolIcon sx={{ mr: 1, color: 'text.secondary' }} />}
                      >
                        {filteredDepartments.map((dept) => (
                          <MenuItem key={dept.id} value={dept.name}>
                            {dept.name}
                          </MenuItem>
                        ))}
                        {filteredDepartments.length === 0 && formData.faculty && !departmentsLoading && (
                          <MenuItem disabled>
                            ไม่พบสาขาสำหรับคณะนี้
                          </MenuItem>
                        )}
                      </Select>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1 }}>
                        {departmentsLoading ? 'กำลังโหลดข้อมูลสาขา...' : 
                         !formData.faculty ? 'เลือกคณะก่อน' :
                         filteredDepartments.length === 0 ? 'ไม่พบสาขาสำหรับคณะนี้' :
                         `พบ ${filteredDepartments.length} สาขา`}
                      </Typography>
                    </FormControl>
                  </Grid>

                  {/* Degree Level */}
                  <Grid item xs={12} sm={6}>
                    <FormControl 
                      fullWidth 
                      required 
                      disabled={isFieldReadOnly('degree') || loading || forceRefreshEnabled}
                    >
                      <InputLabel>ระดับการศึกษา</InputLabel>
                      <Select
                        value={formData.degree}
                        onChange={handleSelectChange('degree')}
                        label="ระดับการศึกษา"
                        startAdornment={
                          <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                            <SchoolIcon sx={{ color: 'text.secondary' }} />
                            {isFieldReadOnly('degree') && (
                              <VerifiedIcon sx={{ color: 'primary.main', ml: 0.5, fontSize: 16 }} />
                            )}
                          </Box>
                        }
                      >
                        {DEGREE_LEVELS.map((degree) => (
                          <MenuItem key={degree.code} value={degree.name}>
                            {degree.name}
                          </MenuItem>
                        ))}
                      </Select>
                      {isFieldReadOnly('degree') && (
                        <Typography variant="caption" color="primary.main" sx={{ mt: 0.5, ml: 1 }}>
                          ข้อมูลจาก Microsoft
                        </Typography>
                      )}
                    </FormControl>
                  </Grid>

                  {/* University */}
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="มหาวิทยาลัย"
                      value={formData.university}
                      onChange={handleInputChange('university')}
                      fullWidth
                      required
                      disabled={isFieldReadOnly('university') || loading || forceRefreshEnabled}
                      InputProps={{
                        startAdornment: (
                          <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                            <SchoolIcon sx={{ color: 'text.secondary' }} />
                            {isFieldReadOnly('university') && (
                              <VerifiedIcon sx={{ color: 'primary.main', ml: 0.5, fontSize: 16 }} />
                            )}
                          </Box>
                        )
                      }}
                      helperText={isFieldReadOnly('university') ? 
                        "ข้อมูลจาก Microsoft" : 
                        "ชื่อมหาวิทยาลัย"
                      }
                      sx={{
                        '& .MuiFormHelperText-root': {
                          color: isFieldReadOnly('university') ? 'primary.main' : 'text.secondary'
                        }
                      }}
                    />
                  </Grid>

                  {/* User Code */}
                  <Grid item xs={12}>
                    <TextField
                      label="รหัสผู้ใช้"
                      value={formData.userCode}
                      onChange={handleInputChange('userCode')}
                      fullWidth
                      required
                      disabled={loading || forceRefreshEnabled}
                      type="password"
                      InputProps={{
                        startAdornment: <SecurityIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      }}
                      helperText="รหัสที่ได้รับจากผู้จัดกิจกรรม"
                      sx={{
                        '& .MuiInputBase-input': {
                          fontFamily: 'monospace'
                        }
                      }}
                    />
                  </Grid>
                </Grid>

                <Divider sx={{ my: 4 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Chip 
                    label={`รหัสกิจกรรม: ${activityCode}`}
                    variant="outlined"
                    sx={{ 
                      fontFamily: 'monospace', 
                      fontWeight: 600,
                      borderColor: 'primary.main',
                      color: 'primary.main'
                    }}
                  />
                  
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleSubmit}
                    disabled={loading || departmentsLoading || forceRefreshEnabled || !formData.faculty || filteredDepartments.length === 0}
                    sx={{ 
                      px: 4, 
                      py: 1.5, 
                      borderRadius: 3,
                      background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
                      boxShadow: '0 3px 5px 2px rgba(102, 126, 234, .3)',
                      '&:hover': {
                        background: 'linear-gradient(45deg, #5a6fd8 30%, #6a4190 90%)',
                        boxShadow: '0 4px 8px 3px rgba(102, 126, 234, .4)',
                      }
                    }}
                  >
                    {loading ? (
                      <>
                        <CircularProgress size={20} sx={{ mr: 1, color: 'white' }} />
                        กำลังตรวจสอบ...
                      </>
                    ) : (
                      'ตรวจสอบตำแหน่ง'
                    )}
                  </Button>
                </Box>
              </Box>
            </Fade>
          )}

          {/* Step 2: Location Verification */}
          {activeStep === 1 && (
            <Fade in={true}>
              <Box sx={{ textAlign: 'center' }}>
                <LocationIcon 
                  sx={{ 
                    fontSize: 80, 
                    mb: 3,
                    color: 'primary.main',
                    filter: 'drop-shadow(0 4px 8px rgba(102, 126, 234, .3))'
                  }} 
                />
                <Typography variant="h4" gutterBottom fontWeight="bold" color="primary.main">
                  กำลังตรวจสอบตำแหน่ง
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                  กรุณาอนุญาตการเข้าถึงตำแหน่งของคุณเพื่อยืนยันการเข้าร่วมกิจกรรม
                </Typography>
                
                <LocationChecker
                  allowedLocation={getActivityAllowedLocation()}
                  onLocationVerified={handleLocationVerified}
                  onLocationError={handleLocationError}
                />
              </Box>
            </Fade>
          )}
        </CardContent>
      </Card>
    </Fade>
  );
};

export default ActivityRegistrationForm;