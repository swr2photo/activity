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
  Divider,
  Chip,
  Stack,
  LinearProgress,
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
  Warning as WarningIcon,
  Lock as LockIcon,
  ExitToApp as LogoutIcon,
  Verified as VerifiedIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import {
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
  doc,
  onSnapshot,
  runTransaction,
  increment,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import LocationChecker from './LocationChecker';
import { AdminSettings } from '../types';
import { validateStudentId, validateThaiName } from '../utils/validation';
import { accentCardSx, glassCardSx, pageColors } from '../lib/uiTheme';

/** =========================
 * Types & Interfaces
 * =======================*/
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
  forceRefresh?: boolean;
  closeReason?: string;
}

interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  givenName?: string;
  surname?: string;
}

interface ActivityRegistrationFormProps {
  activityCode: string;
  activityDocId: string; // id ของ doc ใน activityQRCodes (ใช้กับ rules)
  adminSettings: AdminSettings;
  onSuccess?: () => Promise<void>;
  existingUserProfile?: UserProfile;
  existingAuthStatus: boolean;
  onLogout?: () => Promise<void>;
}

/** =========================
 * Static Data
 * =======================*/
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
  { name: 'คณะสัตวแพทยศาสตร์', code: '13' },
];

const DEGREE_LEVELS = [
  { name: 'ปริญญาตรี', code: '1' },
  { name: 'ปริญญาโท', code: '2' },
  { name: 'ปริญญาเอก', code: '3' },
];

const DEPARTMENTS_BY_FACULTY: Record<string, string[]> = {
  คณะวิศวกรรมศาสตร์: ['วิศวกรรมคอมพิวเตอร์', 'วิศวกรรมไฟฟ้า', 'วิศวกรรมเครื่องกล', 'วิศวกรรมโยธา'],
  คณะวิทยาศาสตร์: ['วิทยาการคอมพิวเตอร์', 'วิทยาการคำนวณ', 'เทคโนโลยีสารสนเทศและการสื่อสาร', 'คณิตศาสตร์', 'ฟิสิกส์'],
  คณะแพทยศาสตร์: ['การแพทย์', 'กายภาพบำบัด'],
  คณะทรัพยากรธรรมชาติ: ['ทรัพยากรธรรมชาติ', 'ประมง'],
  คณะศึกษาศาสตร์: ['การศึกษาปฐมวัย', 'วิทยาศาสตรศึกษา'],
  คณะมนุษยศาสตร์และสังคมศาสตร์: ['ภาษาไทย', 'ภาษาอังกฤษ'],
  คณะเศรษฐศาสตร์: ['เศรษฐศาสตร์'],
  คณะบริหารธุรกิจ: ['การจัดการ', 'การตลาด', 'การบัญชี'],
  คณะศิลปกรรมศาสตร์: ['ศิลปกรรม', 'การออกแบบ'],
  คณะพยาบาลศาสตร์: ['พยาบาลศาสตร์'],
  คณะเภสัชศาสตร์: ['เภสัชศาสตร์'],
  คณะทันตแพทยศาสตร์: ['ทันตแพทยศาสตร์'],
  คณะสัตวแพทยศาสตร์: ['สัตวแพทยศาสตร์'],
};
const ALL_DEPARTMENTS = Object.values(DEPARTMENTS_BY_FACULTY).flat();

/** =========================
 * Helpers
 * =======================*/
const extractMicrosoftUserInfo = (displayName: string) => {
  const result = { englishName: '', firstName: '', lastName: '' };
  const englishNameMatch = displayName.match(/^([^(]+)/);
  if (englishNameMatch) result.englishName = englishNameMatch[1].trim();
  const thaiNameMatch = displayName.match(/\(([^)]+)\)/);
  if (thaiNameMatch) {
    const parts = thaiNameMatch[1].trim().split(/\s+/);
    result.firstName = parts[0] || '';
    result.lastName = parts.slice(1).join(' ');
  }
  return result;
};

const generateStudentId = (faculty: string) => {
  const year = new Date().getFullYear().toString().slice(-2);
  const degreeLevel = '1';
  const facultyCode = PSU_FACULTIES.find((x) => x.name === faculty)?.code || '02';
  const majorCode = '1';
  const randomNum = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `${year}${degreeLevel}${facultyCode}${majorCode}${randomNum}`;
};

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

const detectFacultyFromDepartment = (deptName: string): string => {
  for (const [faculty, list] of Object.entries(DEPARTMENTS_BY_FACULTY)) {
    if (list.includes(deptName)) return faculty;
  }
  return 'คณะวิทยาศาสตร์';
};

function extractAndGenerateUserData(profile?: UserProfile) {
  if (!profile) {
    return {
      studentId: '',
      firstName: '',
      lastName: '',
      department: '',
      faculty: '',
      degree: '',
      englishName: '',
      isAutoFilled: false,
    };
  }
  const displayName = profile.displayName || '';
  const email = profile.email || '';
  const extracted = extractMicrosoftUserInfo(displayName);

  let studentId = '';
  const emailMatch = email.match(/^(\d{8,12})/);
  if (emailMatch) studentId = emailMatch[1];
  else studentId = generateStudentId('คณะวิทยาศาสตร์');

  const detected = detectInfoFromStudentId(studentId);

  return {
    studentId,
    firstName: extracted.firstName || 'ไม่ระบุ',
    lastName: extracted.lastName || 'ไม่ระบุ',
    department: 'วิทยาการคอมพิวเตอร์',
    faculty: detected.faculty,
    degree: detected.degree,
    englishName: extracted.englishName,
    isAutoFilled: true,
  };
}

/** =========================
 * Component
 * =======================*/
const ActivityRegistrationForm: React.FC<ActivityRegistrationFormProps> = ({
  activityCode,
  activityDocId,
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
  const [departments, setDepartments] = useState<{ id: string; name: string; faculty: string; isActive: boolean }[]>(
    []
  );
  const [filteredDepartments, setFilteredDepartments] = useState<
    { id: string; name: string; faculty: string; isActive: boolean }[]
  >([]);
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
    forceRefresh: false,
  });

  const [forceRefreshEnabled, setForceRefreshEnabled] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [realtimeListener, setRealtimeListener] = useState<(() => void) | null>(null);

  const [singleUserViolation, setSingleUserViolation] = useState(false);
  const [currentRegisteredUser, setCurrentRegisteredUser] = useState<string>('');

  const initialData = extractAndGenerateUserData(existingUserProfile);
  const [formData, setFormData] = useState({
    ...initialData,
    userCode: '',
    email: existingUserProfile?.email || '',
    microsoftId: existingUserProfile?.id || '',
  });

  const [autoFilledData] = useState({
    firstName: initialData.firstName,
    lastName: initialData.lastName,
    englishName: initialData.englishName,
    studentId: initialData.studentId,
    faculty: initialData.faculty,
    degree: initialData.degree,
    isAutoFilled: initialData.isAutoFilled,
  });

  // 👉 แอนิเมชันเตรียมก่อนตรวจตำแหน่ง
  const [locStage, setLocStage] = useState<'pre' | 'verify'>('pre');
  useEffect(() => {
    if (activeStep === 1) {
      setLocStage('pre');
      const t = setTimeout(() => setLocStage('verify'), 900);
      return () => clearTimeout(t);
    }
  }, [activeStep]);

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
      } catch {}
    }
  };

  const checkSingleUserMode = async () => {
    if (!activityStatus.singleUserMode || !existingUserProfile?.email) return true;
    try {
      const qRef = query(collection(db, 'activityRecords'), where('activityCode', '==', activityCode));
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
    } catch {
      return true;
    }
  };

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
          forceRefresh: false,
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
          closeReason: data.closeReason || '',
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
              closeReason: updated.closeReason || prev.closeReason,
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
    } catch {
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
        forceRefresh: false,
      });
    } finally {
      setActivityStatusLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      setDepartmentsLoading(true);
      const qRef = query(collection(db, 'departments'), where('isActive', '==', true));
      const snap = await getDocs(qRef);

      let list: { id: string; name: string; faculty: string; isActive: boolean }[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        list.push({ id: d.id, name: data.name, faculty: data.faculty || 'คณะอื่นๆ', isActive: data.isActive });
      });

      if (list.length === 0) {
        const fallback = ALL_DEPARTMENTS.map((name, idx) => ({
          id: `fallback-${idx}`,
          name,
          faculty: detectFacultyFromDepartment(name),
          isActive: true,
        }));
        list = fallback;
      } else {
        const hasCompSci = list.some((d) => d.name === 'วิทยาการคำนวณ');
        if (!hasCompSci) {
          list.push({
            id: 'temp-comp-sci',
            name: 'วิทยาการคำนวณ',
            faculty: 'คณะวิทยาศาสตร์',
            isActive: true,
          });
        }
      }

      list.sort((a, b) => {
        const f = a.faculty.localeCompare(b.faculty, 'th');
        if (f !== 0) return f;
        return a.name.localeCompare(b.name, 'th');
      });

      setDepartments(list);
    } catch {
      setError('ไม่สามารถโหลดข้อมูลสาขาได้ กรุณาลองใหม่อีกครั้ง');
      const fallback = ALL_DEPARTMENTS.map((name, idx) => ({
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

  const updateFilteredDepartments = (selectedFaculty: string) => {
    if (!selectedFaculty) {
      setFilteredDepartments([]);
      return;
    }
    const filtered = departments.filter((d) => d.faculty === selectedFaculty);
    setFilteredDepartments(filtered);
    if ((formData as any).department && !filtered.some((d) => d.name === (formData as any).department)) {
      setFormData((prev) => ({ ...prev, department: '' }));
    }
  };

  useEffect(() => {
    const init = async () => {
      await Promise.all([checkActivityStatus(), fetchDepartments()]);
    };
    init();
    return () => {
      if (realtimeListener) realtimeListener();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityCode]);

  useEffect(() => {
    updateFilteredDepartments((formData as any).faculty);
    // eslint-disable-next-line
  }, [(formData as any).faculty, departments]);

  useEffect(() => () => {
    if (realtimeListener) realtimeListener();
  }, [realtimeListener]);

  /** =========================
   * Form handlers
   * =======================*/
  const handleInputChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    if (forceRefreshEnabled) return;
    setFormData({ ...formData, [field]: event.target.value });
    setError('');
  };

  const handleSelectChange = (field: string) => (event: SelectChangeEvent<string>) => {
    if (forceRefreshEnabled) return;
    const val = event.target.value;
    setFormData({ ...formData, [field]: val });
    if (field === 'faculty') updateFilteredDepartments(val);
    setError('');
  };

  const validateNewStudentId = (studentId: string) =>
    /^\d{10}$/.test(studentId) &&
    (() => {
      const prefix = parseInt(studentId.substring(0, 2), 10);
      return prefix >= 64 && prefix <= 69;
    })();

  const isFieldReadOnly = (field: string): boolean => {
    if (!(autoFilledData as any).isAutoFilled) return false;
    return ['studentId', 'firstName', 'lastName', 'faculty', 'degree'].includes(field);
  };

  const validateForm = async (): Promise<boolean> => {
    if (forceRefreshEnabled) {
      setError('ไม่สามารถบันทึกข้อมูลได้ กรุณาโหลดหน้านี้ใหม่');
      return false;
    }
    const uid = auth?.currentUser?.uid;
    if (!uid) {
      setError('กรุณาเข้าสู่ระบบก่อนทำรายการ');
      return false;
    }

    if (!validateNewStudentId((formData as any).studentId)) {
      setError('รหัสนักศึกษาไม่ถูกต้อง (ต้องเป็นตัวเลข 10 หลัก และขึ้นต้นด้วย 64-69)');
      return false;
    }
    if (!validateThaiName((formData as any).firstName)) {
      setError('ชื่อไม่ถูกต้อง (ต้องมีอย่างน้อย 2 ตัวอักษร)');
      return false;
    }
    if (!validateThaiName((formData as any).lastName)) {
      setError('นามสกุลไม่ถูกต้อง (ต้องมีอย่างน้อย 2 ตัวอักษร)');
      return false;
    }
    if (!(formData as any).faculty) {
      setError('กรุณาเลือกคณะ');
      return false;
    }
    if (!(formData as any).department) {
      setError('กรุณาเลือกสาขา');
      return false;
    }
    // Removed userCode check

    // กันลงทะเบียนซ้ำด้วย studentId (เร็ว)
    try {
      const qBySid = query(
        collection(db, 'activityRecords'),
        where('studentId', '==', (formData as any).studentId),
        where('activityCode', '==', activityCode)
      );
      const s1 = await getDocs(qBySid);
      if (!s1.empty) {
        setError('คุณได้ลงทะเบียนกิจกรรมนี้แล้ว');
        return false;
      }
    } catch {}

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

  // ✅ Transaction เขียน activityRecords (ไม่เพิ่มตัวนับที่นี่)
  const handleLocationVerified = async (location: { latitude: number; longitude: number }) => {
    if (forceRefreshEnabled) {
      setError('ไม่สามารถบันทึกข้อมูลได้ กรุณาโหลดหน้านี้ใหม่');
      setLoading(false);
      setActiveStep(0);
      return;
    }

    try {
      const uid = auth?.currentUser?.uid;
      if (!uid) {
        setError('กรุณาเข้าสู่ระบบก่อนทำรายการ');
        setLoading(false);
        setActiveStep(0);
        return;
      }

      await runTransaction(db, async (tx) => {
        const activityRef = doc(db, 'activityQRCodes', activityDocId);
        const actSnap = await tx.get(activityRef);
        if (!actSnap.exists()) throw new Error('ACT_NOT_FOUND');

        const act = actSnap.data() as any;

        // ปิดฟอร์มหรือหมดเวลา → ปฏิเสธ
        const now = new Date();
        const isActive = act.isActive !== false;
        const inWindow =
          act.startDateTime?.toDate?.() && act.endDateTime?.toDate?.()
            ? now >= act.startDateTime.toDate() && now <= act.endDateTime.toDate()
            : true;
        if (!isActive || !inWindow) throw new Error('FORM_CLOSED');

        // เต็มแล้ว → ปฏิเสธ
        const max = Number(act.maxParticipants || 0);
        const cur = Number(act.currentParticipants || 0);
        if (max > 0 && cur >= max) throw new Error('FULL');

        // ลงซ้ำ?
        const recordId = `${activityCode}_${uid}`;
        const recordRef = doc(db, 'activityRecords', recordId);
        const recordSnap = await tx.get(recordRef);
        if (recordSnap.exists()) throw new Error('ALREADY_REGISTERED');

        // single user mode claim
        if (act.singleUserMode === true) {
          const claimRef = doc(db, 'activityClaims', activityCode);
          const claimSnap = await tx.get(claimRef);
          const requester = existingUserProfile?.email || (formData as any).email || uid;
          if (claimSnap.exists() && claimSnap.data()?.email && claimSnap.data()?.email !== requester) {
            throw new Error('SINGLE_USER_TAKEN');
          }
          tx.set(claimRef, { email: requester, claimedAt: serverTimestamp(), uid }, { merge: false });
        }

        // payload (ตัด university ออก)
        const payload: any = {
          userId: uid,
          email: existingUserProfile?.email || (formData as any).email || '',
          microsoftId: existingUserProfile?.id || (formData as any).MicrosoftId || '',
          studentId: (formData as any).studentId,
          firstName: (formData as any).firstName,
          lastName: (formData as any).lastName,
          faculty: (formData as any).faculty,
          department: (formData as any).department,
          degree: (formData as any).degree,
          activityCode,
          activityDocId,
          location,
          userCode: activityStatus.userCode || '',
          transcriptSaved: true,
          timestamp: serverTimestamp(),
        };

        tx.set(recordRef, payload, { merge: false });
        tx.update(activityRef, {
          currentParticipants: increment(1)
        });
      });

      setActiveStep(2);
      setSuccess(true);
      setLoading(false);
      if (onSuccess) await onSuccess(); // ให้หน้า parent อัปเดตสถานะ (เช่น counter)
    } catch (e: any) {
      const map: Record<string, string> = {
        FORM_CLOSED: 'กิจกรรมปิดรับข้อมูลแล้ว',
        FULL: 'กิจกรรมนี้มีผู้สมัครครบจำนวนแล้ว',
        ALREADY_REGISTERED: 'คุณได้ลงทะเบียนกิจกรรมนี้แล้ว',
        SINGLE_USER_TAKEN: 'กิจกรรมนี้อนุญาตผู้ใช้เดียว และถูกลงทะเบียนไปแล้ว',
        ACT_NOT_FOUND: 'ไม่พบข้อมูลกิจกรรม',
      };
      setError(map[e?.message] || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
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
        <Card elevation={0} sx={glassCardSx}>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <RefreshIcon
              sx={{
                fontSize: 48,
                mb: 2,
                color: 'primary.main',
                animation: 'spin 1s linear infinite',
                '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
              }}
            />
            <Typography variant="h5" sx={{ fontWeight: 800, color: pageColors.textPrimary }}>
              กำลังโหลดหน้าใหม่...
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, color: pageColors.textSecondary }}>
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
        <Card elevation={0} sx={glassCardSx}>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <CircularProgress size={48} thickness={4} sx={{ mb: 2, color: 'primary.main' }} />
            <Typography variant="h5" sx={{ fontWeight: 800, color: pageColors.textPrimary }}>
              กำลังตรวจสอบสถานะกิจกรรม...
            </Typography>
            <Chip
              label={`รหัสกิจกรรม: ${activityCode}`}
              variant="outlined"
              sx={{ mt: 2, fontFamily: 'monospace', fontWeight: 600, borderRadius: '10px' }}
            />
          </CardContent>
        </Card>
      </Fade>
    );
  }

  if (!activityStatus.exists) {
    return (
      <Grow in>
        <Card elevation={0} sx={accentCardSx(pageColors.accentError)}>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <ErrorIcon sx={{ fontSize: 64, mb: 2, color: 'error.main' }} />
            <Typography variant="h5" gutterBottom fontWeight={800} sx={{ color: pageColors.textPrimary }}>
              ไม่พบกิจกรรมนี้
            </Typography>
            <Typography variant="body1" paragraph sx={{ color: pageColors.textSecondary }}>
              ไม่พบกิจกรรมที่มีรหัส
            </Typography>
            <Chip label={activityCode} sx={{ fontFamily: 'monospace', fontWeight: 600, borderRadius: '10px' }} />
          </CardContent>
        </Card>
      </Grow>
    );
  }

  if (!activityStatus.isActive) {
    return (
      <Grow in>
        <Card elevation={0} sx={accentCardSx(pageColors.accentWarning)}>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <BlockIcon sx={{ fontSize: 64, mb: 2, color: 'warning.main' }} />
            <Typography variant="h5" gutterBottom fontWeight={800} sx={{ color: pageColors.textPrimary }}>
              กิจกรรมปิดการลงทะเบียนแล้ว
            </Typography>
            <Typography variant="body1" paragraph sx={{ color: pageColors.textSecondary }}>
              {activityStatus.closeReason || 'กิจกรรมได้ปิดการลงทะเบียนแล้ว'}
            </Typography>
            <Chip
              label={activityStatus.activityCode}
              sx={{ fontFamily: 'monospace', fontWeight: 600, borderRadius: '10px' }}
            />
          </CardContent>
        </Card>
      </Grow>
    );
  }

  if (!activityStatus.userCode) {
    return (
      <Grow in>
        <Card elevation={0} sx={accentCardSx(pageColors.accentInfo)}>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <PersonIcon sx={{ fontSize: 64, mb: 2, color: 'info.main' }} />
            <Typography variant="h5" gutterBottom fontWeight={800} sx={{ color: pageColors.textPrimary }}>
              ไม่มีรหัสผู้ใช้
            </Typography>
            <Typography variant="body1" paragraph sx={{ color: pageColors.textSecondary }}>
              กิจกรรมยังไม่ได้ตั้งค่ารหัสผู้ใช้
            </Typography>
            <Chip
              label={activityStatus.activityCode}
              sx={{ fontFamily: 'monospace', fontWeight: 600, borderRadius: '10px' }}
            />
          </CardContent>
        </Card>
      </Grow>
    );
  }

  if (singleUserViolation) {
    return (
      <Grow in>
        <Card elevation={0} sx={accentCardSx(pageColors.accentError)}>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <LockIcon sx={{ fontSize: 64, mb: 2, color: 'error.main' }} />
            <Typography variant="h5" gutterBottom fontWeight={800} sx={{ color: pageColors.textPrimary }}>
              ไม่สามารถลงทะเบียนได้
            </Typography>
            <Typography variant="body1" paragraph sx={{ color: pageColors.textSecondary }}>
              กิจกรรมนี้อนุญาตให้ลงทะเบียนได้เพียงผู้ใช้เดียวเท่านั้น
            </Typography>
            <Chip label={currentRegisteredUser} sx={{ mb: 3, fontWeight: 600, borderRadius: '10px' }} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
              <Button variant="contained" size="large" onClick={handleLogout} startIcon={<LogoutIcon />} sx={{ borderRadius: '12px', px: 4 }}>
                ออกจากระบบ
              </Button>
              <Button variant="outlined" size="large" onClick={() => window.close()} sx={{ borderRadius: '12px', px: 4 }}>
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
        <Card elevation={0} sx={accentCardSx(pageColors.accentWarning)}>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <WarningIcon sx={{ fontSize: 64, mb: 2, color: 'warning.main' }} />
            <Typography variant="h5" gutterBottom fontWeight={800} sx={{ color: pageColors.textPrimary }}>
              จำเป็นต้องเข้าสู่ระบบ
            </Typography>
            <Typography variant="body1" paragraph sx={{ color: pageColors.textSecondary }}>
              กิจกรรมนี้ต้องการให้เข้าสู่ระบบด้วยบัญชีมหาวิทยาลัยก่อน
            </Typography>
            <Button variant="contained" size="large" onClick={() => window.history.back()} sx={{ borderRadius: '12px', px: 4 }}>
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
        <Card elevation={0} sx={accentCardSx(pageColors.accentSuccess)}>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <CheckCircleIcon sx={{ fontSize: 72, mb: 2, color: 'success.main' }} />
            <Typography variant="h5" gutterBottom fontWeight={800} sx={{ color: pageColors.textPrimary }}>
              บันทึกสำเร็จ!
            </Typography>
            <Typography variant="body1" paragraph sx={{ color: pageColors.textSecondary }}>
              ข้อมูลการเข้าร่วมกิจกรรมของคุณได้รับการบันทึกเรียบร้อยแล้ว
            </Typography>
            <Alert severity="success" sx={{ mb: 3, borderRadius: '12px', textAlign: 'left' }}>
              บันทึก Transcript เรียบร้อยแล้ว
            </Alert>
            <Button variant="contained" size="large" onClick={() => window.close()} sx={{ borderRadius: '12px', px: 4 }}>
              ปิดหน้าต่าง
            </Button>
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
      <Card elevation={0} sx={glassCardSx}>
        <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography
              variant="h5"
              gutterBottom
              fontWeight={800}
              sx={{
                fontSize: { xs: '1.5rem', sm: '1.75rem' },
                color: pageColors.textPrimary,
                letterSpacing: '-0.02em',
              }}
            >
              ลงทะเบียนกิจกรรม
            </Typography>

            {activityStatus.singleUserMode && (
              <Alert severity="warning" sx={{ mt: 1, mb: 2, borderRadius: 3 }}>
                🔒 <strong>โหมดผู้ใช้เดียว</strong> — กิจกรรมนี้อนุญาตให้ลงทะเบียนได้เพียงบัญชีเดียวเท่านั้น
              </Alert>
            )}
          </Box>

          {/* Desktop Stepper */}
          <Stepper
            activeStep={activeStep}
            sx={{
              display: { xs: 'none', sm: 'flex' },
              mb: 4,
              '& .MuiStepLabel-root .Mui-completed': { color: 'success.main' },
              '& .MuiStepLabel-root .Mui-active': { color: 'primary.main' },
            }}
          >
            {['กรอกข้อมูล', 'ตรวจสอบตำแหน่ง', 'บันทึกสำเร็จ'].map((label, index) => (
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

          {/* Mobile Stepper / Progress Bar */}
          <Box sx={{ display: { xs: 'block', sm: 'none' }, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" fontWeight="bold" color="primary.main">
                {activeStep === 0 && 'ขั้นตอนที่ 1: กรอกข้อมูล'}
                {activeStep === 1 && 'ขั้นตอนที่ 2: ตรวจสอบตำแหน่ง'}
                {activeStep === 2 && 'ขั้นตอนที่ 3: ลงทะเบียนสำเร็จ'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {activeStep + 1} / 3
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={((activeStep + 1) / 3) * 100}
              sx={(theme) => ({
                height: 6,
                borderRadius: 3,
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              })}
            />
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>
              {error}
            </Alert>
          )}

          {/* Step 1: Form */}
          {activeStep === 0 && (
            <Fade in>
              <Box>
                {/* Organizer code bar removed */}

                <Grid container spacing={2.5}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="รหัสนักศึกษา"
                      value={(formData as any).studentId}
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
                      sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="ชื่อ"
                      value={(formData as any).firstName}
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
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="นามสกุล"
                      value={(formData as any).lastName}
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
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth required disabled={isFieldReadOnly('faculty') || loading || forceRefreshEnabled}>
                      <InputLabel>คณะ</InputLabel>
                      <Select value={(formData as any).faculty} onChange={handleSelectChange('faculty')} label="คณะ">
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

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl
                      fullWidth
                      required
                      disabled={departmentsLoading || loading || forceRefreshEnabled || !(formData as any).faculty}
                    >
                      <InputLabel>สาขาวิชา</InputLabel>
                      <Select value={(formData as any).department} onChange={handleSelectChange('department')} label="สาขาวิชา">
                        {filteredDepartments.map((d) => (
                          <MenuItem key={d.id} value={d.name}>
                            {d.name}
                          </MenuItem>
                        ))}
                        {filteredDepartments.length === 0 && (formData as any).faculty && !departmentsLoading && (
                          <MenuItem disabled>ไม่พบสาขาสำหรับคณะนี้</MenuItem>
                        )}
                      </Select>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1 }}>
                        {departmentsLoading
                          ? 'กำลังโหลดข้อมูลสาขา...'
                          : !(formData as any).faculty
                          ? 'เลือกคณะก่อน'
                          : filteredDepartments.length === 0
                          ? 'ไม่พบสาขาสำหรับคณะนี้'
                          : `พบ ${filteredDepartments.length} สาขา`}
                      </Typography>
                    </FormControl>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth required disabled={isFieldReadOnly('degree') || loading || forceRefreshEnabled}>
                      <InputLabel>ระดับการศึกษา</InputLabel>
                      <Select value={(formData as any).degree} onChange={handleSelectChange('degree')} label="ระดับการศึกษา">
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

                  {/* userCode field removed */}
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
                      !(formData as any).faculty ||
                      filteredDepartments.length === 0
                    }
                    sx={{
                      px: 4,
                      py: 1.5,
                      borderRadius: 3,
                      background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
                    }}
                  >
                    {loading ? (
                      <>
                        <CircularProgress size={20} sx={{ mr: 1, color: 'white' }} />
                        กำลังเตรียมตรวจสอบ...
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
                <LocationIcon
                  sx={{
                    fontSize: 80,
                    mb: 2.5,
                    color: 'primary.main',
                    filter: 'drop-shadow(0 4px 8px rgba(102, 126, 234, .3))',
                  }}
                />
                {locStage === 'pre' ? (
                  <>
                    <Typography variant="h5" gutterBottom fontWeight="bold" color="primary.main">
                      กำลังเตรียมตรวจสอบตำแหน่ง
                    </Typography>
                    <Typography variant="body1" color="text.secondary" paragraph>
                      กรุณารอสักครู่...
                    </Typography>
                    <CircularProgress />
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </Box>
            </Fade>
          )}
        </CardContent>
      </Card>
    </Fade>
  );
};

export default ActivityRegistrationForm;
