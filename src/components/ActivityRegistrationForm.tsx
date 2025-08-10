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
  Verified as VerifiedIcon,
  ContentCopy as ContentCopyIcon
} from '@mui/icons-material';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import LocationChecker from './LocationChecker';
import { ActivityRecord, AdminSettings } from '../types';
import { validateStudentId, validateThaiName } from '../utils/validation';

/** =========================
 * Types & Interfaces
 * =======================*/
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
  userCode?: string;                 // organizer passcode shown to user
  requiresUniversityLogin?: boolean;
  latitude?: number;
  longitude?: number;
  checkInRadius?: number;
  singleUserMode?: boolean;
  forceRefresh?: boolean;
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

/** =========================
 * Static Data
 * =======================*/
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

// Departments by faculty (ย่อให้พอใช้งาน — เพิ่มได้ตามจริง)
const DEPARTMENTS_BY_FACULTY: Record<string, string[]> = {
  'คณะวิศวกรรมศาสตร์': [
    'วิศวกรรมคอมพิวเตอร์',
    'วิศวกรรมไฟฟ้า',
    'วิศวกรรมเครื่องกล',
    'วิศวกรรมโยธา',
  ],
  'คณะวิทยาศาสตร์': [
    'วิทยาการคอมพิวเตอร์',
    'เทคโนโลยีสารสนเทศและการสื่อสาร',
    'คณิตศาสตร์',
    'ฟิสิกส์',
  ],
  'คณะแพทยศาสตร์': ['การแพทย์', 'กายภาพบำบัด'],
  'คณะทรัพยากรธรรมชาติ': ['ทรัพยากรธรรมชาติ', 'ประมง'],
  'คณะศึกษาศาสตร์': ['การศึกษาปฐมวัย', 'วิทยาศาสตรศึกษา'],
  'คณะมนุษยศาสตร์และสังคมศาสตร์': ['ภาษาไทย', 'ภาษาอังกฤษ'],
  'คณะเศรษฐศาสตร์': ['เศรษฐศาสตร์'],
  'คณะบริหารธุรกิจ': ['การจัดการ', 'การตลาด', 'การบัญชี'],
  'คณะศิลปกรรมศาสตร์': ['ศิลปกรรม', 'การออกแบบ'],
  'คณะพยาบาลศาสตร์': ['พยาบาลศาสตร์'],
  'คณะเภสัชศาสตร์': ['เภสัชศาสตร์'],
  'คณะทันตแพทยศาสตร์': ['ทันตแพทยศาสตร์'],
  'คณะสัตวแพทยศาสตร์': ['สัตวแพทยศาสตร์'],
};

// รวมรายการสาขาทั้งหมดสำหรับ fallback
const ALL_DEPARTMENTS = Object.values(DEPARTMENTS_BY_FACULTY).flat();

/** =========================
 * Helpers
 * =======================*/
// ดึงเฉพาะชื่อไทยในวงเล็บจาก displayName เช่น "Werachart Kaewkham (วีรชาติ แก้วขำ)" -> first/last = วีรชาติ / แก้วขำ
const extractMicrosoftUserInfo = (displayName: string) => {
  const result = {
    englishName: '',
    firstName: '',
    lastName: '',
  };

  const englishNameMatch = displayName.match(/^([^(]+)/);
  if (englishNameMatch) result.englishName = englishNameMatch[1].trim();

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

  return result;
};

// Generate student ID (mock) ตามโครง PSU
const generateStudentId = (faculty: string) => {
  const year = new Date().getFullYear().toString().slice(-2);
  const degreeLevel = '1';
  let facultyCode = '02';
  const f = PSU_FACULTIES.find((x) => x.name === faculty);
  if (f) facultyCode = f.code;
  const majorCode = '1';
  const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${year}${degreeLevel}${facultyCode}${majorCode}${randomNum}`;
};

// Detect faculty/degree from studentId
const detectInfoFromStudentId = (studentId: string): { faculty: string; degree: string } => {
  const result = { faculty: 'คณะวิทยาศาสตร์', degree: 'ปริญญาตรี' };
  if (studentId.length >= 5) {
    const degreeCode = studentId.substring(2, 3);
    const degree = DEGREE_LEVELS.find((d) => d.code === degreeCode);
    if (degree) result.degree = degree.name;

    const facultyCode = studentId.substring(3, 5);
    const faculty = PSU_FACULTIES.find((f) => f.code === facultyCode);
    if (faculty) result.faculty = faculty.name;
  }
  return result;
};

// ช่วยเดาคณะจากชื่อสาขา (fallback)
const detectFacultyFromDepartment = (deptName: string): string => {
  for (const [faculty, list] of Object.entries(DEPARTMENTS_BY_FACULTY)) {
    if (list.includes(deptName)) return faculty;
  }
  return 'คณะวิทยาศาสตร์';
};

// ดึงข้อมูลจาก Microsoft Profile และเตรียม default
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
      isAutoFilled: false,
    };
  }

  const displayName = profile.displayName || '';
  const email = profile.email || '';

  const extracted = extractMicrosoftUserInfo(displayName);

  // from email -> studentId
  let studentId = '';
  const emailMatch = email.match(/^(\d{8,12})/);
  if (emailMatch) {
    studentId = emailMatch[1];
  } else {
    studentId = generateStudentId('คณะวิทยาศาสตร์');
  }

  const detected = detectInfoFromStudentId(studentId);

  return {
    studentId,
    firstName: extracted.firstName || 'ไม่ระบุ',
    lastName: extracted.lastName || 'ไม่ระบุ',
    department: 'วิทยาการคอมพิวเตอร์',
    faculty: detected.faculty,
    degree: detected.degree,
    university: 'มหาวิทยาลัยสงขลานครินทร์',
    englishName: extracted.englishName,
    isAutoFilled: true,
  };
}

/** =========================
 * Component
 * =======================*/
const ActivityRegistrationForm: React.FC<ActivityRegistrationFormProps> = ({
  activityCode,
  adminSettings,
  onSuccess,
  existingUserProfile,
  existingAuthStatus,
  onLogout,
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
    singleUserMode: false,
  });

  const [forceRefreshEnabled, setForceRefreshEnabled] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [realtimeListener, setRealtimeListener] = useState<(() => void) | null>(null);

  // single-user mode flags
  const [singleUserViolation, setSingleUserViolation] = useState(false);
  const [currentRegisteredUser, setCurrentRegisteredUser] = useState<string>('');

  // initial form state (autofill)
  const initialData = extractAndGenerateUserData(existingUserProfile);
  const [formData, setFormData] = useState({
    ...initialData,
    userCode: '',
    email: existingUserProfile?.email || '',
    microsoftId: existingUserProfile?.id || '',
  });

  // read-only group
  const [autoFilledData] = useState({
    firstName: initialData.firstName,
    lastName: initialData.lastName,
    englishName: initialData.englishName,
    studentId: initialData.studentId,
    faculty: initialData.faculty,
    degree: initialData.degree,
    university: initialData.university,
    isAutoFilled: initialData.isAutoFilled,
  });

  const steps = ['กรอกข้อมูล', 'ตรวจสอบตำแหน่ง', 'บันทึกสำเร็จ'];

  /** =========================
   * Utilities
   * =======================*/
  const handleForceRefresh = () => {
    setIsRefreshing(true);
    if (realtimeListener) {
      realtimeListener();
      setRealtimeListener(null);
    }
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  const handleLogout = async () => {
    if (onLogout) {
      try {
        await onLogout();
      } catch (err) {
        console.error('Logout error', err);
      }
    }
  };

  // single user mode check
  const checkSingleUserMode = async () => {
    if (!activityStatus.singleUserMode || !existingUserProfile?.email) return true;

    try {
      const qRef = query(
        collection(db, 'activityRecords'),
        where('activityCode', '==', activityCode)
      );
      const snap = await getDocs(qRef);
      if (!snap.empty) {
        const data = snap.docs[0].data() as any;
        const registeredEmail = data.email;
        if (registeredEmail && registeredEmail !== existingUserProfile.email) {
          setSingleUserViolation(true);
          setCurrentRegisteredUser(registeredEmail);
          setError(`กิจกรรมนี้อนุญาตให้ลงทะเบียนได้เพียงผู้ใช้เดียว และมีผู้ใช้ ${registeredEmail} ลงทะเบียนไปแล้ว`);
          return false;
        } else if (registeredEmail === existingUserProfile.email) {
          setError('คุณได้ลงทะเบียนกิจกรรมนี้แล้ว');
          return false;
        }
      }
      return true;
    } catch (e) {
      console.error('single user check error', e);
      return true;
    }
  };

  // fetch activity status
  const checkActivityStatus = async () => {
    try {
      setActivityStatusLoading(true);
      const qRef = query(collection(db, 'activityQRCodes'), where('activityCode', '==', activityCode));
      const snap = await getDocs(qRef);

      if (snap.empty) {
        setActivityStatus({
          exists: false,
          isActive: false,
          activityCode,
          userCode: '',
          requiresUniversityLogin: false,
          latitude: 0,
          longitude: 0,
          checkInRadius: 100,
          singleUserMode: false,
        });
      } else {
        const activityDoc = snap.docs[0];
        const data = activityDoc.data() as any;
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
          singleUserMode: data.singleUserMode || false,
          forceRefresh: data.forceRefresh === true,
        });

        setForceRefreshEnabled(data.forceRefresh === true);

        const canProceed = await checkSingleUserMode();
        if (!canProceed) {
          setActivityStatusLoading(false);
          return;
        }

        const unsubscribe = onSnapshot(doc(db, 'activityQRCodes', activityDoc.id), (ds) => {
          if (ds.exists()) {
            const updated = ds.data() as any;
            setActivityStatus((prev) => ({
              ...prev,
              isActive: updated.isActive !== undefined ? updated.isActive : true,
              description: updated.description || '',
              userCode: updated.userCode || '',
              requiresUniversityLogin: updated.requiresUniversityLogin || false,
              latitude: updated.latitude || prev.latitude,
              longitude: updated.longitude || prev.longitude,
              checkInRadius: updated.checkInRadius || prev.checkInRadius,
              singleUserMode: updated.singleUserMode || false,
              forceRefresh: updated.forceRefresh === true,
            }));

            const newForce = updated.forceRefresh === true;
            if (newForce && !forceRefreshEnabled) {
              setForceRefreshEnabled(true);
              setTimeout(handleForceRefresh, 2000);
            } else if (!newForce && forceRefreshEnabled) {
              setForceRefreshEnabled(false);
            }
          }
        });

        setRealtimeListener(() => unsubscribe);
      }
    } catch (e) {
      console.error('checkActivityStatus error', e);
      setError('ไม่สามารถตรวจสอบสถานะกิจกรรมได้');
      setActivityStatus({
        exists: false,
        isActive: false,
        activityCode,
        userCode: '',
        requiresUniversityLogin: false,
        latitude: 0,
        longitude: 0,
        checkInRadius: 100,
        singleUserMode: false,
      });
    } finally {
      setActivityStatusLoading(false);
    }
  };

  // init departments
  const fetchDepartments = async () => {
    try {
      setDepartmentsLoading(true);
      const qRef = query(collection(db, 'departments'), where('isActive', '==', true));
      const snap = await getDocs(qRef);

      let list: Department[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        list.push({
          id: d.id,
          name: data.name,
          faculty: data.faculty || 'คณะอื่นๆ',
          isActive: data.isActive,
        });
      });

      if (list.length === 0) {
        // fallback
        const fallback: Department[] = ALL_DEPARTMENTS.map((name, idx) => ({
          id: `fallback-${idx}`,
          name,
          faculty: detectFacultyFromDepartment(name),
          isActive: true,
        }));
        list = fallback;
      }

      list.sort((a, b) => {
        const f = a.faculty.localeCompare(b.faculty, 'th');
        if (f !== 0) return f;
        return a.name.localeCompare(b.name, 'th');
      });

      setDepartments(list);
    } catch (e) {
      console.error('fetchDepartments error', e);
      setError('ไม่สามารถโหลดข้อมูลสาขาได้ กรุณาลองใหม่อีกครั้ง');
      const fallback: Department[] = ALL_DEPARTMENTS.map((name, idx) => ({
        id: `fallback-${idx}`,
        name,
        faculty: detectFacultyFromDepartment(name),
        isActive: true,
      }));
      setDepartments(fallback);
    } finally {
      setDepartmentsLoading(false);
    }
  };

  // filtered departments
  const updateFilteredDepartments = (selectedFaculty: string) => {
    if (!selectedFaculty) {
      setFilteredDepartments([]);
      return;
    }
    const filtered = departments.filter((d) => d.faculty === selectedFaculty);
    setFilteredDepartments(filtered);
    if (formData.department && !filtered.some((d) => d.name === formData.department)) {
      setFormData((prev) => ({ ...prev, department: '' }));
    }
  };

  useEffect(() => {
    const init = async () => {
      await Promise.all([checkActivityStatus(), fetchDepartments()]);
    };
    init();

    return () => {
      if (realtimeListener) {
        realtimeListener();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityCode]);

  useEffect(() => {
    updateFilteredDepartments(formData.faculty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.faculty, departments]);

  useEffect(() => {
    return () => {
      if (realtimeListener) realtimeListener();
    };
  }, [realtimeListener]);

  /** =========================
   * Form handlers
   * =======================*/
  const handleInputChange =
    (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
      if (forceRefreshEnabled) return;
      setFormData({ ...formData, [field]: event.target.value });
      setError('');
    };

  const handleSelectChange =
    (field: string) => (event: SelectChangeEvent<string>) => {
      if (forceRefreshEnabled) return;
      const val = event.target.value;
      setFormData({ ...formData, [field]: val });
      if (field === 'faculty') updateFilteredDepartments(val);
      setError('');
    };

  const validateNewStudentId = (studentId: string) => {
    if (!/^\d{10}$/.test(studentId)) return false;
    const prefixNum = parseInt(studentId.substring(0, 2), 10);
    return prefixNum >= 64 && prefixNum <= 69;
  };

  const isFieldReadOnly = (field: string): boolean => {
    if (!autoFilledData.isAutoFilled) return false;
    return ['studentId', 'firstName', 'lastName', 'faculty', 'degree', 'university'].includes(field);
  };

  const validateForm = async (): Promise<boolean> => {
    if (forceRefreshEnabled) {
      setError('ไม่สามารถบันทึกข้อมูลได้ กรุณาโหลดหน้านี้ใหม่');
      return false;
    }

    // ต้องมีการล็อกอิน (สอดคล้อง Firestore rules ใหม่)
    const uid = auth?.currentUser?.uid;
    if (!uid) {
      setError('กรุณาเข้าสู่ระบบก่อนทำรายการ');
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

    // กันลงทะเบียนซ้ำจาก studentId
    try {
      const qBySid = query(
        collection(db, 'activityRecords'),
        where('studentId', '==', formData.studentId),
        where('activityCode', '==', activityCode)
      );
      const s1 = await getDocs(qBySid);
      if (!s1.empty) {
        setError('คุณได้ลงทะเบียนกิจกรรมนี้แล้ว');
        return false;
      }
    } catch (e) {
      // ignore
    }

    // กันลงทะเบียนซ้ำต่อบัญชี (email / uid)
    try {
      if (existingUserProfile?.email) {
        const qByEmail = query(
          collection(db, 'activityRecords'),
          where('activityCode', '==', activityCode),
          where('email', '==', existingUserProfile.email)
        );
        const sByEmail = await getDocs(qByEmail);
        if (!sByEmail.empty) {
          setError('บัญชีนี้ได้ส่งข้อมูลแล้ว — ส่งได้ 1 ครั้งต่อกิจกรรม');
          return false;
        }
      }
      if (uid) {
        const qByUid = query(
          collection(db, 'activityRecords'),
          where('activityCode', '==', activityCode),
          where('userId', '==', uid)
        );
        const sByUid = await getDocs(qByUid);
        if (!sByUid.empty) {
          setError('บัญชีนี้ได้ส่งข้อมูลแล้ว — ส่งได้ 1 ครั้งต่อกิจกรรม');
          return false;
        }
      }
    } catch (e) {
      // ignore
    }

    // single-user mode check (อีกครั้ง)
    if (activityStatus.singleUserMode) {
      const canProceed = await checkSingleUserMode();
      if (!canProceed) return false;
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

  const handleLocationVerified = async (location: { latitude: number; longitude: number }) => {
    if (forceRefreshEnabled) {
      setError('ไม่สามารถบันทึกข้อมูลได้ กรุณาโหลดหน้านี้ใหม่');
      setLoading(false);
      setActiveStep(0);
      return;
    }

    try {
      const userId = auth?.currentUser?.uid || formData.microsoftId || formData.email || null;

      const activityRecord: any = {
        studentId: formData.studentId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        faculty: formData.faculty,
        department: formData.department,
        degree: formData.degree,
        university: formData.university,
        activityCode,
        location,
        userCode: formData.userCode,     // organizer passcode (for audit)
        userId,                          // ✅ ใช้กับกฎ Firestore (owner)
        email: formData.email,
        microsoftId: formData.microsoftId,
        transcriptSaved: true,           // ✅ ธงบันทึก transcript แล้ว
        ...(existingUserProfile && { microsoftProfile: existingUserProfile }),
        ...(autoFilledData.isAutoFilled && {
          autoFilledData: {
            englishName: autoFilledData.englishName,
            isFromMicrosoft: true,
          },
        }),
      };

      await addDoc(collection(db, 'activityRecords'), {
        ...activityRecord,
        timestamp: serverTimestamp(),
      });

      setActiveStep(2);
      setSuccess(true);
      setLoading(false);

      if (onSuccess) {
        try {
          await onSuccess();
        } catch (e) {
          console.error('onSuccess error', e);
        }
      }
    } catch (e) {
      console.error('save record error', e);
      setError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      setLoading(false);
      setActiveStep(0);
    }
  };

  const handleLocationError = (msg: string) => {
    setError(msg);
    setLoading(false);
    setActiveStep(0);
  };

  const getActivityAllowedLocation = () => ({
    latitude: activityStatus.latitude || 13.7563,
    longitude: activityStatus.longitude || 100.5018,
    radius: activityStatus.checkInRadius || 100,
  });

  /** =========================
   * Rendering states
   * =======================*/
  if (isRefreshing) {
    return (
      <Fade in>
        <Card elevation={12} sx={{ borderRadius: 4, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <RefreshIcon
              sx={{
                fontSize: 80,
                mb: 3,
                animation: 'spin 1s linear infinite',
                '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
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

  if (activityStatusLoading) {
    return (
      <Fade in>
        <Card elevation={8} sx={{ borderRadius: 4 }}>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <CircularProgress size={80} thickness={4} sx={{ mb: 3, color: 'primary.main' }} />
            <Typography variant="h4" sx={{ mt: 2, fontWeight: 600, color: 'primary.main' }}>
              กำลังตรวจสอบสถานะกิจกรรม...
            </Typography>
            <Chip label={`รหัสกิจกรรม: ${activityCode}`} variant="outlined" sx={{ mt: 2, fontFamily: 'monospace', fontWeight: 600 }} />
          </CardContent>
        </Card>
      </Fade>
    );
  }

  if (forceRefreshEnabled) {
    return (
      <Slide direction="up" in>
        <Card
          elevation={12}
          sx={{
            borderRadius: 4,
            border: '3px solid',
            borderColor: 'warning.main',
            background: 'linear-gradient(135deg, #ff9a56 0%, #ff6b6b 100%)',
            color: 'white',
          }}
        >
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <RefreshIcon sx={{ fontSize: 100, mb: 3 }} />
            <Typography variant="h3" gutterBottom fontWeight="bold">
              {isRefreshing ? 'กำลังโหลดหน้าใหม่...' : 'จำเป็นต้องโหลดหน้าใหม่'}
            </Typography>
            <Typography variant="h6" paragraph sx={{ opacity: 0.9 }}>
              {isRefreshing ? 'กรุณารอสักครู่ ระบบกำลังโหลดหน้าใหม่...' : 'แอดมินได้เปิดใช้งานการบังคับโหลดหน้าใหม่'}
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
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
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

  if (!activityStatus.exists) {
    return (
      <Grow in>
        <Card
          elevation={8}
          sx={{
            borderRadius: 4,
            border: '3px solid',
            borderColor: 'error.main',
            background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
            color: 'white',
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
            <Chip label={activityCode} sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontFamily: 'monospace', fontWeight: 600, fontSize: '1.1rem' }} />
          </CardContent>
        </Card>
      </Grow>
    );
  }

  if (!activityStatus.isActive) {
    return (
      <Grow in>
        <Card
          elevation={8}
          sx={{
            borderRadius: 4,
            border: '3px solid',
            borderColor: 'warning.main',
            background: 'linear-gradient(135deg, #ffa726 0%, #fb8c00 100%)',
            color: 'white',
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
            <Chip label={activityStatus.activityCode} sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontFamily: 'monospace', fontWeight: 600 }} />
          </CardContent>
        </Card>
      </Grow>
    );
  }

  if (!activityStatus.userCode) {
    return (
      <Grow in>
        <Card
          elevation={8}
          sx={{
            borderRadius: 4,
            border: '3px solid',
            borderColor: 'warning.main',
            background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
            color: 'white',
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
            <Chip label={activityStatus.activityCode} sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontFamily: 'monospace', fontWeight: 600 }} />
          </CardContent>
        </Card>
      </Grow>
    );
  }

  if (singleUserViolation) {
    return (
      <Grow in>
        <Card
          elevation={8}
          sx={{
            borderRadius: 4,
            border: '3px solid',
            borderColor: 'error.main',
            background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
            color: 'white',
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
            <Chip label={currentRegisteredUser} sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', mb: 4, fontWeight: 600 }} />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
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
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
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
                  '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' },
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

  if (activityStatus.requiresUniversityLogin && !existingUserProfile && !existingAuthStatus) {
    return (
      <Grow in>
        <Card
          elevation={8}
          sx={{
            borderRadius: 4,
            border: '3px solid',
            borderColor: 'warning.main',
            background: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)',
            color: 'white',
          }}
        >
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <WarningIcon sx={{ fontSize: 100, mb: 3 }} />
            <Typography variant="h3" gutterBottom fontWeight="bold">
              จำเป็นต้องเข้าสู่ระบบ
            </Typography>
            <Typography variant="h6" paragraph sx={{ opacity: 0.9 }}>
              กิจกรรมนี้ต้องการให้เข้าสู่ระบบด้วยบัญชีมหาวิทยาลัยก่อน
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
                '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
              }}
            >
              กลับไปเข้าสู่ระบบ
            </Button>
          </CardContent>
        </Card>
      </Grow>
    );
  }

  if (success) {
    return (
      <Fade in>
        <Card
          elevation={12}
          sx={{
            borderRadius: 4,
            border: '3px solid',
            borderColor: 'success.main',
            background: 'linear-gradient(135deg, #00b894 0%, #00a085 100%)',
            color: 'white',
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

            <Alert
              severity="success"
              sx={{
                mb: 3,
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.15)',
                color: 'white',
                '& .MuiAlert-icon': { color: 'white' },
              }}
            >
              บันทึก Transcript เรียบร้อยแล้ว
            </Alert>

            <Paper
              sx={{
                p: { xs: 2, sm: 4 },
                bgcolor: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.2)',
                mb: 4,
                borderRadius: 3,
                color: 'white',
              }}
            >
              <Grid container spacing={2} sx={{ textAlign: 'left' }}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <PersonIcon sx={{ mr: 2 }} />
                    <Box>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        ชื่อ-นามสกุล
                      </Typography>
                      <Typography variant="body1" fontWeight="600">
                        {formData.firstName} {formData.lastName}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <BadgeIcon sx={{ mr: 2 }} />
                    <Box>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        รหัสนักศึกษา
                      </Typography>
                      <Typography variant="body1" fontWeight="600" fontFamily="monospace">
                        {formData.studentId}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <SchoolIcon sx={{ mr: 2 }} />
                    <Box>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        คณะ
                      </Typography>
                      <Typography variant="body1" fontWeight="600">
                        {formData.faculty}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <SchoolIcon sx={{ mr: 2 }} />
                    <Box>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        สาขา
                      </Typography>
                      <Typography variant="body1" fontWeight="600">
                        {formData.department}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <SchoolIcon sx={{ mr: 2 }} />
                    <Box>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        ระดับการศึกษา
                      </Typography>
                      <Typography variant="body1" fontWeight="600">
                        {formData.degree}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <BadgeIcon sx={{ mr: 2 }} />
                    <Box>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        รหัสกิจกรรม
                      </Typography>
                      <Typography variant="body1" fontWeight="600" fontFamily="monospace">
                        {activityStatus.activityCode}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <AccessTimeIcon sx={{ mr: 2 }} />
                    <Box>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        เวลาที่บันทึก
                      </Typography>
                      <Typography variant="body1" fontWeight="600">
                        {new Date().toLocaleString('th-TH')}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </Paper>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
              <Button
                variant="contained"
                size="large"
                onClick={() => window.close()}
                sx={{
                  px: 4,
                  py: 1.5,
                  borderRadius: 3,
                  bgcolor: 'rgba(255,255,255,0.15)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
                }}
              >
                ปิดหน้าต่าง
              </Button>
              {!activityStatus.singleUserMode && (
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => {
                    setSuccess(false);
                    setActiveStep(0);
                    const reset = extractAndGenerateUserData(existingUserProfile);
                    setFormData({
                      ...reset,
                      userCode: '',
                      email: existingUserProfile?.email || '',
                      microsoftId: existingUserProfile?.id || '',
                    });
                  }}
                  sx={{
                    px: 4,
                    py: 1.5,
                    borderRadius: 3,
                    borderColor: 'rgba(255,255,255,0.5)',
                    color: 'white',
                    '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' },
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

  /** =========================
   * Main form
   * =======================*/
  return (
    <Fade in>
      <Card elevation={8} sx={{ borderRadius: 4 }}>
        <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography
              variant="h4"
              gutterBottom
              fontWeight="bold"
              sx={{
                fontSize: { xs: '1.6rem', sm: '2rem' },
                background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              ลงทะเบียนกิจกรรม
            </Typography>

            {activityStatus.singleUserMode && (
              <Alert
                severity="warning"
                sx={{
                  mt: 1,
                  mb: 2,
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, #ff9a56 0%, #ff6b6b 100%)',
                  color: 'white',
                  '& .MuiAlert-icon': { color: 'white' },
                  border: 'none',
                }}
              >
                🔒 <strong>โหมดผู้ใช้เดียว</strong> — กิจกรรมนี้อนุญาตให้ลงทะเบียนได้เพียงบัญชีเดียวเท่านั้น
              </Alert>
            )}

            {departmentsLoading && (
              <Alert
                severity="info"
                sx={{
                  mt: 1,
                  mb: 2,
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)',
                  color: 'white',
                  '& .MuiAlert-icon': { color: 'white' },
                  border: 'none',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CircularProgress size={20} sx={{ color: 'white' }} />
                  <Typography variant="body2">กำลังโหลดข้อมูลสาขา...</Typography>
                </Box>
              </Alert>
            )}
          </Box>

          <Stepper
            activeStep={activeStep}
            sx={{
              mb: { xs: 2.5, sm: 4 },
              '& .MuiStepLabel-root .Mui-completed': { color: 'success.main' },
              '& .MuiStepLabel-root .Mui-active': { color: 'primary.main' },
            }}
          >
            {steps.map((label, index) => (
              <Step key={label}>
                <StepLabel
                  sx={{
                    '& .MuiStepLabel-label': {
                      fontWeight: activeStep === index ? 'bold' : 'normal',
                      color: activeStep === index ? 'primary.main' : 'text.secondary',
                    },
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
                border: 'none',
              }}
            >
              {error}
            </Alert>
          )}

          {/* Step 1: Form */}
          {activeStep === 0 && (
            <Fade in>
              <Box>
                {/* Organizer code – Liquid Glass */}
                <Box
                  sx={(t) => ({
                    mb: 3,
                    p: { xs: 1.5, sm: 2 },
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                    flexWrap: 'wrap',
                    bgcolor: t.palette.mode === 'dark' ? 'rgba(20,20,24,0.35)' : 'rgba(255,255,255,0.65)',
                    backdropFilter: 'blur(16px) saturate(160%)',
                    border: '1px solid rgba(255,255,255,0.35)',
                    boxShadow: '0 8px 32px rgba(0,0,0,.12)',
                  })}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" sx={{ opacity: 0.75, display: 'block' }}>
                      รหัสที่ได้รับจากผู้จัดกิจกรรม
                    </Typography>
                    <Typography
                      variant="h6"
                      sx={{
                        fontFamily: 'monospace',
                        fontWeight: 800,
                        letterSpacing: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: { xs: 180, sm: 260 },
                      }}
                      title={activityStatus.userCode || ''}
                    >
                      {activityStatus.userCode || '—'}
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setFormData((prev) => ({ ...prev, userCode: activityStatus.userCode || '' }))}
                    >
                      ใส่รหัสให้เลย
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      startIcon={<ContentCopyIcon fontSize="small" />}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(activityStatus.userCode || '');
                        } catch {}
                      }}
                    >
                      คัดลอก
                    </Button>
                  </Stack>
                </Box>

                <Grid container spacing={2.5}>
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
                            {isFieldReadOnly('studentId') && <VerifiedIcon sx={{ color: 'primary.main', ml: 0.5, fontSize: 16 }} />}
                          </Box>
                        ),
                      }}
                      helperText={isFieldReadOnly('studentId') ? 'ข้อมูลจาก Microsoft' : 'เช่น 6421021234 (10 หลัก, ขึ้นต้นด้วย 64-69)'}
                      sx={{
                        '& .MuiInputBase-input': { fontFamily: 'monospace' },
                        '& .MuiFormHelperText-root': { color: isFieldReadOnly('studentId') ? 'primary.main' : 'text.secondary' },
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
                            {isFieldReadOnly('firstName') && <VerifiedIcon sx={{ color: 'primary.main', ml: 0.5, fontSize: 16 }} />}
                          </Box>
                        ),
                      }}
                      helperText={isFieldReadOnly('firstName') ? 'ข้อมูลจาก Microsoft' : 'ชื่อจริงเป็นภาษาไทย'}
                      sx={{
                        '& .MuiFormHelperText-root': { color: isFieldReadOnly('firstName') ? 'primary.main' : 'text.secondary' },
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
                            {isFieldReadOnly('lastName') && <VerifiedIcon sx={{ color: 'primary.main', ml: 0.5, fontSize: 16 }} />}
                          </Box>
                        ),
                      }}
                      helperText={isFieldReadOnly('lastName') ? 'ข้อมูลจาก Microsoft' : 'นามสกุลเป็นภาษาไทย'}
                      sx={{
                        '& .MuiFormHelperText-root': { color: isFieldReadOnly('lastName') ? 'primary.main' : 'text.secondary' },
                      }}
                    />
                  </Grid>

                  {/* Faculty */}
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth required disabled={isFieldReadOnly('faculty') || loading || forceRefreshEnabled}>
                      <InputLabel>คณะ</InputLabel>
                      <Select
                        value={formData.faculty}
                        onChange={handleSelectChange('faculty')}
                        label="คณะ"
                        startAdornment={
                          <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                            <SchoolIcon sx={{ color: 'text.secondary' }} />
                            {isFieldReadOnly('faculty') && <VerifiedIcon sx={{ color: 'primary.main', ml: 0.5, fontSize: 16 }} />}
                          </Box>
                        }
                      >
                        {PSU_FACULTIES.map((f) => (
                          <MenuItem key={f.code} value={f.name}>
                            {f.name}
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
                        {filteredDepartments.map((d) => (
                          <MenuItem key={d.id} value={d.name}>
                            {d.name}
                          </MenuItem>
                        ))}
                        {filteredDepartments.length === 0 && formData.faculty && !departmentsLoading && (
                          <MenuItem disabled>ไม่พบสาขาสำหรับคณะนี้</MenuItem>
                        )}
                      </Select>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1 }}>
                        {departmentsLoading
                          ? 'กำลังโหลดข้อมูลสาขา...'
                          : !formData.faculty
                          ? 'เลือกคณะก่อน'
                          : filteredDepartments.length === 0
                          ? 'ไม่พบสาขาสำหรับคณะนี้'
                          : `พบ ${filteredDepartments.length} สาขา`}
                      </Typography>
                    </FormControl>
                  </Grid>

                  {/* Degree */}
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth required disabled={isFieldReadOnly('degree') || loading || forceRefreshEnabled}>
                      <InputLabel>ระดับการศึกษา</InputLabel>
                      <Select
                        value={formData.degree}
                        onChange={handleSelectChange('degree')}
                        label="ระดับการศึกษา"
                        startAdornment={
                          <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                            <SchoolIcon sx={{ color: 'text.secondary' }} />
                            {isFieldReadOnly('degree') && <VerifiedIcon sx={{ color: 'primary.main', ml: 0.5, fontSize: 16 }} />}
                          </Box>
                        }
                      >
                        {DEGREE_LEVELS.map((d) => (
                          <MenuItem key={d.code} value={d.name}>
                            {d.name}
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
                            {isFieldReadOnly('university') && <VerifiedIcon sx={{ color: 'primary.main', ml: 0.5, fontSize: 16 }} />}
                          </Box>
                        ),
                      }}
                      helperText={isFieldReadOnly('university') ? 'ข้อมูลจาก Microsoft' : 'ชื่อมหาวิทยาลัย'}
                      sx={{
                        '& .MuiFormHelperText-root': { color: isFieldReadOnly('university') ? 'primary.main' : 'text.secondary' },
                      }}
                    />
                  </Grid>

                  {/* User Code (input) */}
                  <Grid item xs={12}>
                    <TextField
                      label="รหัสผู้ใช้"
                      value={formData.userCode}
                      onChange={handleInputChange('userCode')}
                      fullWidth
                      required
                      disabled={loading || forceRefreshEnabled}
                      type="password"
                      InputProps={{ startAdornment: <SecurityIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
                      helperText="รหัสที่ได้รับจากผู้จัดกิจกรรม"
                      sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
                    />
                  </Grid>
                </Grid>

                <Divider sx={{ my: { xs: 3, sm: 4 } }} />

                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: 2,
                    alignItems: { xs: 'stretch', sm: 'center' },
                    justifyContent: 'space-between',
                  }}
                >
                  <Chip
                    label={`รหัสกิจกรรม: ${activityCode}`}
                    variant="outlined"
                    sx={{
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      borderColor: 'primary.main',
                      color: 'primary.main',
                      alignSelf: { xs: 'stretch', sm: 'flex-start' },
                    }}
                  />

                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleSubmit}
                    disabled={
                      loading ||
                      departmentsLoading ||
                      forceRefreshEnabled ||
                      !formData.faculty ||
                      filteredDepartments.length === 0
                    }
                    sx={{
                      px: 4,
                      py: 1.5,
                      borderRadius: 3,
                      background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
                      boxShadow: '0 3px 5px 2px rgba(102, 126, 234, .3)',
                      '&:hover': {
                        background: 'linear-gradient(45deg, #5a6fd8 30%, #6a4190 90%)',
                        boxShadow: '0 4px 8px 3px rgba(102, 126, 234, .4)',
                      },
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

          {/* Step 2: Location */}
          {activeStep === 1 && (
            <Fade in>
              <Box sx={{ textAlign: 'center' }}>
                <LocationIcon sx={{ fontSize: 80, mb: 2.5, color: 'primary.main', filter: 'drop-shadow(0 4px 8px rgba(102, 126, 234, .3))' }} />
                <Typography variant="h5" gutterBottom fontWeight="bold" color="primary.main">
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
