'use client';
import React, { useState, useEffect, useMemo } from 'react';
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
  Autocomplete,
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
import type { UserType } from '../lib/firebaseAuth';
import LocationChecker from './LocationChecker';
import { AdminSettings } from '../types';
import SurveyForm from './activity/SurveyForm';
import { validateStudentId, validateThaiName, validateNameTitle, filterThaiNameInput, NAME_TITLE_OPTIONS } from '../utils/validation';
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
  nameTitle?: string;
  department?: string;
  faculty?: string;
  studentId?: string;
  userType?: UserType;
  institutionName?: string;
  educationLevel?: string;
}

export type ActivityUserProfile = UserProfile;

interface ActivityRegistrationFormProps {
  activityCode: string;
  activityDocId: string; // id ของ doc ใน activityQRCodes (ใช้กับ rules)
  adminSettings: AdminSettings;
  onSuccess?: () => Promise<void>;
  existingUserProfile?: UserProfile;
  existingAuthStatus: boolean;
  onLogout?: () => Promise<void>;
  surveyConfig?: any;
  sessions?: any[];
  checkedInSessions?: string[];
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
      nameTitle: '',
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
  const isExternal = profile.userType === 'external';

  let studentId = profile.studentId?.trim() || '';
  if (!studentId && !isExternal) {
    const emailMatch = email.match(/^(\d{8,12})/);
    if (emailMatch) studentId = emailMatch[1];
    else studentId = generateStudentId('คณะวิทยาศาสตร์');
  }

  const rawFirst = profile.givenName || extracted.firstName || '';
  const rawLast = profile.surname || extracted.lastName || '';
  const firstName = validateThaiName(rawFirst) ? rawFirst.trim() : '';
  const lastName = validateThaiName(rawLast) ? rawLast.trim() : '';
  const nameTitle = validateNameTitle(profile.nameTitle || '') ? (profile.nameTitle as string) : '';

  if (isExternal) {
    return {
      studentId,
      nameTitle,
      firstName,
      lastName,
      department: profile.institutionName || profile.department || 'ไม่ระบุ',
      faculty: 'บุคคลภายนอก',
      degree: profile.educationLevel || 'ไม่ระบุ',
      englishName: extracted.englishName,
      isAutoFilled: true,
    };
  }

  const detected = detectInfoFromStudentId(studentId);

  return {
    studentId,
    nameTitle,
    firstName,
    lastName,
    department: profile.department || 'วิทยาการคอมพิวเตอร์',
    faculty: profile.faculty || detected.faculty,
    degree: detected.degree,
    englishName: extracted.englishName,
    isAutoFilled: true,
  };
}

const NextSessionCountdown: React.FC<{ nextSession: any }> = ({ nextSession }) => {
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);

  const sStart = useMemo(() => nextSession.startDateTime?.toDate?.() || new Date(nextSession.startDateTime), [nextSession.startDateTime]);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      if (now < sStart) {
        const diff = sStart.getTime() - now.getTime();
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / 1000 / 60) % 60);
        const s = Math.floor((diff / 1000) % 60);
        setTimeLeft({ d, h, m, s });
      } else {
        setTimeLeft(null);
      }
    };
    
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [sStart]);

  if (!timeLeft) {
    return (
      <Chip 
        label="กำลังจะเริ่มเร็วๆ นี้" 
        color="info" 
        variant="outlined" 
        sx={{ fontWeight: 600, mt: 1.5 }} 
      />
    );
  }

  return (
    <Chip 
      label={`เปิดให้เช็กอินในอีก ${timeLeft.d > 0 ? `${timeLeft.d} วัน ` : ''}${timeLeft.h > 0 ? `${timeLeft.h} ชม. ` : ''}${timeLeft.m} นาที ${timeLeft.s} วินาที`}
      color="info"
      variant="filled"
      sx={{ 
        fontWeight: 600, 
        mt: 1.5,
        px: 2,
        py: 2.2,
        borderRadius: '12px',
        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
        boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
        color: '#fff',
        fontSize: '0.9rem'
      }}
    />
  );
};

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
  surveyConfig,
  sessions,
  checkedInSessions = [],
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [activityStatusLoading, setActivityStatusLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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
    selectedSessionId: '', // For session selection
  });

  // Calculate active sessions
  const activeSessions = useMemo(() => {
    if (!sessions || sessions.length === 0) return [];
    const now = new Date();
    return sessions.filter((s) => {
      const sStart = s.startDateTime?.toDate?.() || new Date(s.startDateTime);
      const sEnd = s.endDateTime?.toDate?.() || new Date(s.endDateTime);
      return now >= sStart && now <= sEnd;
    });
  }, [sessions]);

  const nextSession = useMemo(() => {
    if (!sessions || sessions.length === 0) return null;
    const sorted = [...sessions].sort((a, b) => {
      const aTime = a.startDateTime?.toDate?.()?.getTime() || new Date(a.startDateTime).getTime();
      const bTime = b.startDateTime?.toDate?.()?.getTime() || new Date(b.startDateTime).getTime();
      return aTime - bTime;
    });
    const nowTime = new Date();
    return sorted.find((s) => {
      const sStart = s.startDateTime?.toDate?.() || new Date(s.startDateTime);
      return nowTime < sStart;
    });
  }, [sessions]);

  const nextSessionStart = useMemo(() => {
    if (!nextSession) return null;
    return nextSession.startDateTime?.toDate?.() || new Date(nextSession.startDateTime);
  }, [nextSession]);

  // Auto-select if there's exactly one active session
  useEffect(() => {
    if (activeSessions.length === 1 && !formData.selectedSessionId) {
      setFormData((prev) => ({ ...prev, selectedSessionId: activeSessions[0].id }));
    }
  }, [activeSessions, formData.selectedSessionId]);

  const [autoFilledData, setAutoFilledData] = useState({
    firstName: initialData.firstName,
    lastName: initialData.lastName,
    englishName: initialData.englishName,
    studentId: initialData.studentId,
    faculty: initialData.faculty,
    degree: initialData.degree,
    isAutoFilled: initialData.isAutoFilled,
  });

  useEffect(() => {
    if (existingUserProfile) {
      const updatedData = extractAndGenerateUserData(existingUserProfile);
      setFormData((prev) => ({
        ...prev,
        department: updatedData.department,
        faculty: updatedData.faculty,
        nameTitle: updatedData.nameTitle,
        firstName: updatedData.firstName,
        lastName: updatedData.lastName,
        studentId: updatedData.studentId,
        degree: updatedData.degree,
      }));
      setAutoFilledData({
        firstName: updatedData.firstName,
        lastName: updatedData.lastName,
        englishName: updatedData.englishName,
        studentId: updatedData.studentId,
        faculty: updatedData.faculty,
        degree: updatedData.degree,
        isAutoFilled: updatedData.isAutoFilled,
      });
    }
  }, [existingUserProfile?.department, existingUserProfile?.faculty]);

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
          // ถ้ามี sessions → ตรวจว่าเช็กอินรอบปัจจุบันหรือยัง
          if (sessions && sessions.length > 0) {
            const now = new Date();
            const currentSession = sessions.find((s: any) => {
              const sStart = s.startDateTime?.toDate?.() || new Date(s.startDateTime);
              const sEnd = s.endDateTime?.toDate?.() || new Date(s.endDateTime);
              return now >= sStart && now <= sEnd;
            });
            if (currentSession && data.checkedInSessions?.includes(currentSession.id)) {
              setError('คุณได้เช็กอินรอบนี้แล้ว');
              return false;
            }
            // ยังไม่เช็กอินรอบนี้ → ให้ผ่าน
            return true;
          } else {
            // ไม่มี sessions → บล็อกซ้ำเหมือนเดิม
            setError('คุณได้ลงทะเบียนกิจกรรมนี้แล้ว');
            return false;
          }
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
    
    // Only clear if departments are fully loaded, we have a list, and it's not autofilled from profile
    if (
      departments.length > 0 && 
      (formData as any).department && 
      !filtered.some((d) => d.name === (formData as any).department) &&
      !(autoFilledData as any).isAutoFilled
    ) {
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
    const raw = event.target.value;
    const value = field === 'firstName' || field === 'lastName' ? filterThaiNameInput(raw) : raw;
    setFormData({ ...formData, [field]: value });
    setError('');
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSelectChange = (field: string) => (event: SelectChangeEvent<string>) => {
    if (forceRefreshEnabled) return;
    const val = event.target.value;
    setFormData({ ...formData, [field]: val });
    if (field === 'faculty') updateFilteredDepartments(val);
    setError('');
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validateNewStudentId = (studentId: string) => /^\d{10}$/.test(studentId);

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

    const isExternal = existingUserProfile?.userType === 'external';

    if (!isExternal && !validateNewStudentId((formData as any).studentId)) {
      setFieldErrors({ studentId: 'รหัสนักศึกษาไม่ถูกต้อง (ต้องเป็นตัวเลข 10 หลัก)' });
      return false;
    }
    if (isExternal && !(formData as any).studentId?.trim()) {
      setFieldErrors({ studentId: 'ไม่พบรหัสอ้างอิงผู้ใช้ กรุณาเข้าสู่ระบบใหม่' });
      return false;
    }
    if (!validateNameTitle((formData as any).nameTitle)) {
      setFieldErrors({ nameTitle: 'กรุณาเลือกคำนำหน้าชื่อ' });
      return false;
    }
    if (!validateThaiName((formData as any).firstName)) {
      setFieldErrors({ firstName: 'ชื่อต้องเป็นภาษาไทยเท่านั้น (อย่างน้อย 2 ตัวอักษร)' });
      return false;
    }
    if (!validateThaiName((formData as any).lastName)) {
      setFieldErrors({ lastName: 'นามสกุลต้องเป็นภาษาไทยเท่านั้น (อย่างน้อย 2 ตัวอักษร)' });
      return false;
    }
    if (!isExternal && !(formData as any).faculty) {
      setFieldErrors({ faculty: 'กรุณาเลือกคณะ' });
      return false;
    }
    if (!isExternal && !(formData as any).department) {
      setFieldErrors({ department: 'กรุณาเลือกสาขา' });
      return false;
    }
    if (isExternal && !((formData as any).department || existingUserProfile?.institutionName)) {
      setFieldErrors({ department: 'กรุณากรอกสถานศึกษาในโปรไฟล์ก่อน' });
      return false;
    }

    // กันลงทะเบียนซ้ำด้วย studentId (เร็ว)
    try {
      const qBySid = query(
        collection(db, 'activityRecords'),
        where('studentId', '==', (formData as any).studentId),
        where('activityCode', '==', activityCode)
      );
      const s1 = await getDocs(qBySid);
      if (!s1.empty) {
        const existingRecord = s1.docs[0].data();
        // ถ้ามี sessions → ตรวจว่า session ปัจจุบันเคยเช็กอินหรือยัง
        if (sessions && sessions.length > 0) {
          const now = new Date();
          const currentSession = sessions.find((s: any) => {
            const sStart = s.startDateTime?.toDate?.() || new Date(s.startDateTime);
            const sEnd = s.endDateTime?.toDate?.() || new Date(s.endDateTime);
            return now >= sStart && now <= sEnd;
          });
          if (currentSession && existingRecord.checkedInSessions?.includes(currentSession.id)) {
            setError('คุณได้เช็กอินรอบนี้แล้ว');
            return false;
          }
          // ยังไม่เช็กอินรอบนี้ → ให้ผ่าน
        } else {
          // ไม่มี sessions → บล็อกซ้ำเหมือนเดิม
          setError('คุณได้ลงทะเบียนกิจกรรมนี้แล้ว');
          return false;
        }
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

        const userRef = doc(db, 'universityUsers', uid);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) throw new Error('NO_PROFILE');
        const profileData = userSnap.data() as any;
        if (profileData.isActive === false) throw new Error('ACCOUNT_DISABLED');
        const profileStudentId = String(profileData.studentId || '').trim();
        if (!profileStudentId) throw new Error('NO_STUDENT_ID');

        const act = actSnap.data() as any;

        // ปิดฟอร์มหรือหมดเวลา → ปฏิเสธ
        const now = new Date();
        const isActive = act.isActive !== false;
        
        let sessionId: string | undefined;
        let sessionName: string | undefined;
        let inWindow = false;

        if (act.sessions && act.sessions.length > 0) {
          const activeSession = act.sessions.find((s: any) => {
            const sStart = s.startDateTime?.toDate?.() || new Date(s.startDateTime as any);
            const sEnd = s.endDateTime?.toDate?.() || new Date(s.endDateTime as any);
            return now >= sStart && now <= sEnd;
          });
          if (activeSession) {
            inWindow = true;
            sessionId = activeSession.id;
            sessionName = activeSession.name;
          }
        } else {
          inWindow = act.startDateTime?.toDate?.() && act.endDateTime?.toDate?.()
            ? now >= act.startDateTime.toDate() && now <= act.endDateTime.toDate()
            : true;
        }

        if (!isActive || !inWindow) throw new Error('FORM_CLOSED');

        // เต็มแล้ว → ปฏิเสธ
        const max = Number(act.maxParticipants || 0);
        const cur = Number(act.currentParticipants || 0);
        if (max > 0 && cur >= max) throw new Error('FULL');

        // ลงซ้ำ?
        const recordId = `${activityCode}_${uid}`;
        const recordRef = doc(db, 'activityRecords', recordId);
        const recordSnap = await tx.get(recordRef);
        
        let isNewRecord = true;
        if (recordSnap.exists()) {
          const data = recordSnap.data();
          if (sessionId) {
            if (data.checkedInSessions?.includes(sessionId)) {
              throw new Error('ALREADY_REGISTERED');
            }
            isNewRecord = false;
          } else {
            throw new Error('ALREADY_REGISTERED');
          }
        }

        // single user mode claim (only for new records)
        if (isNewRecord && act.singleUserMode === true) {
          const claimRef = doc(db, 'activityClaims', activityCode);
          const claimSnap = await tx.get(claimRef);
          const requester = existingUserProfile?.email || (formData as any).email || uid;
          if (claimSnap.exists() && claimSnap.data()?.email && claimSnap.data()?.email !== requester) {
            throw new Error('SINGLE_USER_TAKEN');
          }
          tx.set(claimRef, { email: requester, claimedAt: serverTimestamp(), uid }, { merge: false });
        }

        // ใช้ studentId จาก universityUsers โดยตรง เพื่อให้ผ่าน Firestore rules
        const rawPayload: Record<string, any> = {
          userId: uid,
          email: existingUserProfile?.email || (formData as any).email || profileData.email || '',
          microsoftId: existingUserProfile?.id || (formData as any).MicrosoftId || '',
          studentId: profileStudentId,
          firstName: (formData as any).firstName,
          lastName: (formData as any).lastName,
          nameTitle: (formData as any).nameTitle || '',
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
        if (sessionId) rawPayload.sessionId = sessionId;
        if (sessionName) rawPayload.sessionName = sessionName;

        // Firestore ปฏิเสธ field ที่เป็น undefined
        const basePayload = Object.fromEntries(
          Object.entries(rawPayload).filter(([, v]) => v !== undefined)
        );

        if (isNewRecord) {
          if (sessionId) {
            basePayload.checkedInSessions = [sessionId];
            basePayload.sessionsDetails = [{ sessionId, sessionName, timestamp: new Date() }];
          }
          tx.set(recordRef, basePayload, { merge: false });
          tx.update(activityRef, { currentParticipants: increment(1) });
        } else {
          const currentSessions = recordSnap.data()?.checkedInSessions || [];
          const currentDetails = recordSnap.data()?.sessionsDetails || [];

          tx.update(recordRef, {
            ...basePayload,
            checkedInSessions: [...currentSessions, sessionId],
            sessionsDetails: [
              ...currentDetails,
              { sessionId, sessionName, timestamp: new Date() },
            ],
          });
        }
      });

      setLoading(false);
      if (onSuccess) await onSuccess();
      // แบบประเมินหลังสิ้นสุดกิจกรรมทำที่หน้า register ตามช่วงเวลาที่แอดมินตั้ง
      setSuccess(true);
    } catch (e: any) {
      // บันทึกสำเร็จไปแล้ว (หรือมี record ค้างจากรอบก่อน) → ถือว่าสำเร็จ ไม่แสดง error
      if (e?.message === 'ALREADY_REGISTERED') {
        setLoading(false);
        setError('');
        if (onSuccess) await onSuccess();
        setSuccess(true);
        return;
      }

      const map: Record<string, string> = {
        FORM_CLOSED: 'กิจกรรมปิดรับข้อมูลแล้ว',
        FULL: 'กิจกรรมนี้มีผู้สมัครครบจำนวนแล้ว',
        SINGLE_USER_TAKEN: 'กิจกรรมนี้อนุญาตผู้ใช้เดียว และถูกลงทะเบียนไปแล้ว',
        ACT_NOT_FOUND: 'ไม่พบข้อมูลกิจกรรม',
        SESSION_CLOSED: 'รอบกิจกรรมที่คุณเลือกได้ปิดรับข้อมูลแล้ว',
        INVALID_SESSION: 'ไม่พบรอบกิจกรรมที่คุณเลือก',
        NO_PROFILE: 'ไม่พบโปรไฟล์ผู้ใช้ กรุณาเข้าสู่ระบบใหม่',
        NO_STUDENT_ID: 'โปรไฟล์ยังไม่มีรหัสนักศึกษา กรุณาแก้ไขโปรไฟล์ก่อนลงทะเบียน',
        ACCOUNT_DISABLED: 'บัญชีของคุณถูกระงับการใช้งาน',
      };
      const code = e?.code || '';
      let msg = map[e?.message];
      if (!msg && (code === 'permission-denied' || String(e?.message || '').includes('permission'))) {
        msg = 'ไม่มีสิทธิ์บันทึกข้อมูล กรุณาตรวจสอบว่าโปรไฟล์ครบและกิจกรรมยังเปิดรับอยู่';
      } else if (!msg && String(e?.message || '').includes('undefined')) {
        msg = 'ข้อมูลไม่ครบถ้วน กรุณาลองใหม่อีกครั้ง';
      }
      console.error('Registration save failed:', e);
      setError(msg || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
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
              ไม่พบกิจกรรมที่คุณกำลังค้นหา
            </Typography>
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

  const now = new Date();
  let currentActiveSessionId: string | null = null;
  let currentActiveSessionName: string | null = null;
  if (sessions && sessions.length > 0) {
    const active = sessions.find((s: any) => {
      const sStart = s.startDateTime?.toDate?.() || new Date(s.startDateTime);
      const sEnd = s.endDateTime?.toDate?.() || new Date(s.endDateTime);
      return now >= sStart && now <= sEnd;
    });
    if (active) {
      currentActiveSessionId = active.id;
      currentActiveSessionName = active.name;
    }
  }



  const isCurrentSessionAlreadyCheckedIn = currentActiveSessionId && checkedInSessions.includes(currentActiveSessionId);

  if (isCurrentSessionAlreadyCheckedIn) {
    return (
      <Fade in>
        <Card elevation={0} sx={accentCardSx(pageColors.accentSuccess)}>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <CheckCircleIcon sx={{ fontSize: 72, mb: 2, color: 'success.main' }} />
            <Typography variant="h5" gutterBottom fontWeight={800} sx={{ color: pageColors.textPrimary }}>
              เช็คอินเรียบร้อย
            </Typography>
            <Typography variant="body1" paragraph sx={{ color: pageColors.textSecondary, mb: 3 }}>
              คุณได้เช็คอินรอบ <b>{currentActiveSessionName}</b> เรียบร้อยแล้ว
            </Typography>

            {nextSession && (
              <Box sx={{ 
                mt: 3, 
                p: 3, 
                bgcolor: 'rgba(2, 132, 199, 0.05)', 
                border: '1px solid rgba(2, 132, 199, 0.15)', 
                borderRadius: '16px',
                textAlign: 'center',
                maxWidth: '450px',
                mx: 'auto',
                boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
              }}>
                <Stack spacing={1.5} alignItems="center">
                  <AccessTimeIcon sx={{ color: 'info.main', fontSize: 32 }} />
                  <Typography variant="subtitle1" fontWeight="bold" color="info.main">
                    รอบถัดไป: {nextSession.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    เปิดให้เช็คอินวันที่: {nextSessionStart?.toLocaleString('th-TH', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })} น.
                  </Typography>
                  <NextSessionCountdown nextSession={nextSession} />
                </Stack>
              </Box>
            )}
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
                {(autoFilledData as any).isAutoFilled && (
                  <Alert 
                    icon={<VerifiedIcon />} 
                    severity="info" 
                    sx={{ mb: 3, borderRadius: 3, bgcolor: 'primary.50', color: 'primary.900', border: '1px solid', borderColor: 'primary.100' }}
                  >
                    ข้อมูลส่วนใหญ่ถูกดึงมาจากระบบของมหาวิทยาลัยและได้รับการยืนยันแล้ว
                  </Alert>
                )}
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
                          </Box>
                        ),
                        endAdornment: isFieldReadOnly('studentId') && (
                          <Chip size="small" icon={<VerifiedIcon />} label="ยืนยันแล้ว" color="primary" variant="outlined" sx={{ border: 'none' }} />
                        )
                      }}
                      error={!!fieldErrors.studentId}
                      helperText={fieldErrors.studentId || (!isFieldReadOnly('studentId') && 'เช่น 6421021234 (10 หลัก)')}
                      sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' }, ...(isFieldReadOnly('studentId') && { '& .MuiOutlinedInput-root': { bgcolor: 'grey.50' } }) }}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 4 }}>
                    <FormControl
                      fullWidth
                      required
                      error={!!fieldErrors.nameTitle}
                      disabled={isFieldReadOnly('firstName') || loading || forceRefreshEnabled}
                    >
                      <InputLabel>คำนำหน้าชื่อ</InputLabel>
                      <Select
                        value={(formData as any).nameTitle || ''}
                        onChange={handleSelectChange('nameTitle')}
                        label="คำนำหน้าชื่อ"
                        sx={isFieldReadOnly('firstName') ? { bgcolor: 'grey.50' } : {}}
                      >
                        {NAME_TITLE_OPTIONS.map((t) => (
                          <MenuItem key={t} value={t}>
                            {t}
                          </MenuItem>
                        ))}
                      </Select>
                      {fieldErrors.nameTitle ? (
                        <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                          {fieldErrors.nameTitle}
                        </Typography>
                      ) : null}
                    </FormControl>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      label="ชื่อ"
                      value={(formData as any).firstName}
                      onChange={handleInputChange('firstName')}
                      fullWidth
                      required
                      disabled={isFieldReadOnly('firstName') || loading || forceRefreshEnabled}
                      inputProps={{ lang: 'th' }}
                      InputProps={{
                        startAdornment: (
                          <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                            <PersonIcon sx={{ color: 'text.secondary' }} />
                          </Box>
                        ),
                        endAdornment: isFieldReadOnly('firstName') && (
                          <Chip size="small" icon={<VerifiedIcon />} label="ยืนยันแล้ว" color="primary" variant="outlined" sx={{ border: 'none' }} />
                        )
                      }}
                      error={!!fieldErrors.firstName}
                      helperText={fieldErrors.firstName || (!isFieldReadOnly('firstName') && 'ชื่อจริงภาษาไทยเท่านั้น')}
                      sx={isFieldReadOnly('firstName') ? { '& .MuiOutlinedInput-root': { bgcolor: 'grey.50' } } : {}}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      label="นามสกุล"
                      value={(formData as any).lastName}
                      onChange={handleInputChange('lastName')}
                      fullWidth
                      required
                      disabled={isFieldReadOnly('lastName') || loading || forceRefreshEnabled}
                      inputProps={{ lang: 'th' }}
                      InputProps={{
                        startAdornment: (
                          <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                            <PersonIcon sx={{ color: 'text.secondary' }} />
                          </Box>
                        ),
                        endAdornment: isFieldReadOnly('lastName') && (
                          <Chip size="small" icon={<VerifiedIcon />} label="ยืนยันแล้ว" color="primary" variant="outlined" sx={{ border: 'none' }} />
                        )
                      }}
                      error={!!fieldErrors.lastName}
                      helperText={fieldErrors.lastName || (!isFieldReadOnly('lastName') && 'นามสกุลภาษาไทยเท่านั้น')}
                      sx={isFieldReadOnly('lastName') ? { '& .MuiOutlinedInput-root': { bgcolor: 'grey.50' } } : {}}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth required error={!!fieldErrors.faculty} disabled={isFieldReadOnly('faculty') || loading || forceRefreshEnabled}>
                      <InputLabel>คณะ</InputLabel>
                      <Select 
                        value={(formData as any).faculty} 
                        onChange={handleSelectChange('faculty')} 
                        label="คณะ"
                        sx={isFieldReadOnly('faculty') ? { bgcolor: 'grey.50' } : {}}
                        endAdornment={isFieldReadOnly('faculty') ? (
                          <Box sx={{ display: 'flex', mr: 3 }}>
                            <Chip size="small" icon={<VerifiedIcon />} label="ยืนยันแล้ว" color="primary" variant="outlined" sx={{ border: 'none' }} />
                          </Box>
                        ) : null}
                      >
                        {PSU_FACULTIES.map((f) => (
                          <MenuItem key={f.code} value={f.name}>
                            {f.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Autocomplete
                      freeSolo
                      options={filteredDepartments.map((d) => d.name)}
                      value={(formData as any).department || null}
                      onChange={(event, newValue) => {
                        if (forceRefreshEnabled) return;
                        setFormData({ ...formData, department: newValue || '' });
                        setError('');
                        setFieldErrors((prev) => ({ ...prev, department: '' }));
                      }}
                      onInputChange={(event, newInputValue) => {
                        if (forceRefreshEnabled) return;
                        setFormData({ ...formData, department: newInputValue });
                      }}
                      disabled={departmentsLoading || loading || forceRefreshEnabled || !(formData as any).faculty}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="สาขาวิชา"
                          required
                          error={!!fieldErrors.department}
                          helperText={
                            fieldErrors.department || (
                            departmentsLoading
                              ? 'กำลังโหลดข้อมูลสาขา...'
                              : !(formData as any).faculty
                              ? 'เลือกคณะก่อน'
                              : filteredDepartments.length === 0
                              ? 'ไม่พบสาขาสำหรับคณะนี้'
                              : `พบ ${filteredDepartments.length} สาขา`
                            )
                          }
                        />
                      )}
                      noOptionsText="ไม่พบสาขาวิชา"
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth required disabled={isFieldReadOnly('degree') || loading || forceRefreshEnabled}>
                      <InputLabel>ระดับการศึกษา</InputLabel>
                      <Select 
                        value={(formData as any).degree} 
                        onChange={handleSelectChange('degree')} 
                        label="ระดับการศึกษา"
                        sx={isFieldReadOnly('degree') ? { bgcolor: 'grey.50' } : {}}
                        endAdornment={isFieldReadOnly('degree') ? (
                          <Box sx={{ display: 'flex', mr: 3 }}>
                            <Chip size="small" icon={<VerifiedIcon />} label="ยืนยันแล้ว" color="primary" variant="outlined" sx={{ border: 'none' }} />
                          </Box>
                        ) : null}
                      >
                        {DEGREE_LEVELS.map((d) => (
                          <MenuItem key={d.code} value={d.name}>
                            {d.name}
                          </MenuItem>
                        ))}
                      </Select>
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
                  <Box sx={{ flex: 1 }} />
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
                      bgcolor: '#007aff',
                      boxShadow: '0 4px 14px 0 rgba(0,122,255,0.39)',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        bgcolor: '#005bb5',
                        boxShadow: '0 6px 20px rgba(0,122,255,0.23)',
                        transform: 'translateY(-2px)'
                      }
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

          {/* Step 3: Survey */}
          {activeStep === 2 && surveyConfig && (
            <Fade in>
              <Box>
                <SurveyForm
                  activityCode={activityCode}
                  activityDocId={activityDocId}
                  surveyConfig={surveyConfig}
                  userId={existingUserProfile?.id || (formData as any).userId || ''}
                  onCompleted={() => {
                    setSuccess(true);
                  }}
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
