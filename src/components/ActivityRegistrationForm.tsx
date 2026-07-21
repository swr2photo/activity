'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Ban as BlockIcon,
  CheckCircle as CheckCircleIcon,
  CircleAlert as ErrorIcon,
  RefreshCw as RefreshIcon,
  User as PersonIcon,
  MapPin as LocationIcon,
  Clock as AccessTimeIcon,
  IdCard as BadgeIcon,
  TriangleAlert as WarningIcon,
  Lock as LockIcon,
  LogOut as LogoutIcon,
  BadgeCheck as VerifiedIcon,
} from 'lucide-react';
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
import { EDUCATION_LEVEL_OPTIONS } from '../lib/firebaseAuth';
import LocationChecker from './LocationChecker';
import { AdminSettings } from '../types';
import SurveyForm from './activity/SurveyForm';
import { validateThaiName, validateNameTitle, filterThaiNameInput, NAME_TITLE_OPTIONS } from '../utils/validation';
import { accentCardClass, glassCardClass, pageColors } from '../lib/uiTheme';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** =========================
 * Types & Interfaces
 * =======================*/
interface ActivityStatus {
  exists: boolean;
  isActive: boolean;
  activityCode: string;
  activityName?: string;
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

/** มหาวิทยาลัย (ม.อ.) | นักเรียนโรงเรียน | บุคคลภายนอกอื่น */
type AffiliationKind = 'university' | 'school' | 'other';

const SCHOOL_EDU_LEVELS = new Set<string>([
  'มัธยมศึกษาตอนต้น',
  'มัธยมศึกษาตอนปลาย',
  'ประกาศนียบัตรวิชาชีพ (ปวช.)',
  'ประกาศนียบัตรวิชาชีพชั้นสูง (ปวส.)',
]);

function detectAffiliationKind(profile?: UserProfile | null): AffiliationKind {
  if (!profile || profile.userType !== 'external') return 'university';

  const level = (profile.educationLevel || '').trim();
  const inst = (profile.institutionName || profile.department || '').trim();

  if (
    SCHOOL_EDU_LEVELS.has(level) ||
    /^(โรงเรียน|รร\.|วิทยาลัยเทคนิค|วิทยาลัยอาชีว)/u.test(inst) ||
    inst.includes('โรงเรียน')
  ) {
    return 'school';
  }
  if (/มหาวิทยาลัย|สถาบัน/u.test(inst) || /^ปริญญา/u.test(level)) {
    return 'other';
  }
  return 'other';
}

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
      <Badge variant="info" className="mt-3 font-semibold">
        กำลังจะเริ่มเร็วๆ นี้
      </Badge>
    );
  }

  return (
    <Badge
      className="mt-3 rounded-xl px-4 py-2.5 text-[0.9rem] font-semibold text-white shadow-[0_4px_12px_rgba(2,132,199,0.3)]"
      style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' }}
    >
      {`เปิดให้เช็กอินในอีก ${timeLeft.d > 0 ? `${timeLeft.d} วัน ` : ''}${timeLeft.h > 0 ? `${timeLeft.h} ชม. ` : ''}${timeLeft.m} นาที ${timeLeft.s} วินาที`}
    </Badge>
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
  const affiliationKind = detectAffiliationKind(existingUserProfile);
  const isExternal = affiliationKind !== 'university';
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
          activityName: data.activityName || '',
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
              activityName: updated.activityName || prev.activityName || '',
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

  const handleSelectChange = (field: string) => (val: string) => {
    if (forceRefreshEnabled) return;
    setFormData({ ...formData, [field]: val });
    if (field === 'faculty') updateFilteredDepartments(val);
    setError('');
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validateNewStudentId = (studentId: string) => /^\d{10}$/.test(studentId);

  const isFieldReadOnly = (field: string): boolean => {
    if (!(autoFilledData as any).isAutoFilled) return false;
    if (isExternal) {
      // บุคคลภายนอก: ล็อกเฉพาะรหัสอ้างอิง + ชื่อที่มาจากโปรไฟล์
      return ['studentId', 'firstName', 'lastName'].includes(field);
    }
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

    const isExternalUser = existingUserProfile?.userType === 'external';

    if (!isExternalUser && !validateNewStudentId((formData as any).studentId)) {
      setFieldErrors({ studentId: 'รหัสนักศึกษาไม่ถูกต้อง (ต้องเป็นตัวเลข 10 หลัก)' });
      return false;
    }
    if (isExternalUser && !(formData as any).studentId?.trim()) {
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
    if (!isExternalUser && !(formData as any).faculty) {
      setFieldErrors({ faculty: 'กรุณาเลือกคณะ' });
      return false;
    }
    if (!isExternalUser && !(formData as any).department) {
      setFieldErrors({ department: 'กรุณาเลือกสาขา' });
      return false;
    }
    if (isExternalUser) {
      const institution =
        (formData as any).department || existingUserProfile?.institutionName || '';
      if (!institution.trim()) {
        setFieldErrors({ department: 'กรุณากรอกสถานศึกษาในโปรไฟล์ก่อน' });
        return false;
      }
      if (!(formData as any).degree?.trim() && !existingUserProfile?.educationLevel?.trim()) {
        setFieldErrors({ degree: 'กรุณาระบุระดับการศึกษาในโปรไฟล์ก่อน' });
        return false;
      }
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
        let clientIp = 'unknown';
        try {
          const ipRes = await fetch('https://api.ipify.org?format=json');
          const ipData = await ipRes.json();
          clientIp = String(ipData?.ip || 'unknown');
        } catch {
          /* ignore */
        }

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
          userType: existingUserProfile?.userType || profileData.userType || 'university',
          institutionName: existingUserProfile?.institutionName || profileData.institutionName || '',
          activityCode,
          activityName: activityStatus.activityName || '',
          activityDocId,
          location,
          ipAddress: clientIp,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : '',
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
      <Card className={cn(glassCardClass, 'animate-in fade-in')}>
        <CardContent className="py-12 text-center">
          <RefreshIcon className="mb-4 h-12 w-12 animate-spin text-primary" />
          <h2 className="text-xl font-extrabold" style={{ color: pageColors.textPrimary }}>
            กำลังโหลดหน้าใหม่...
          </h2>
          <p className="mt-1 text-sm" style={{ color: pageColors.textSecondary }}>
            กรุณารอสักครู่
          </p>
        </CardContent>
      </Card>
    );
  }

  if (activityStatusLoading) {
    return (
      <Card className={cn(glassCardClass, 'animate-in fade-in')}>
        <CardContent className="py-12 text-center">
          <Spinner size="lg" className="mb-4 text-primary" />
          <h2 className="text-xl font-extrabold" style={{ color: pageColors.textPrimary }}>
            กำลังตรวจสอบสถานะกิจกรรม...
          </h2>
        </CardContent>
      </Card>
    );
  }

  if (!activityStatus.exists) {
    return (
      <Card className={cn(accentCardClass, 'animate-in fade-in')} style={{ borderLeftColor: pageColors.accentError }}>
        <CardContent className="py-12 text-center">
          <ErrorIcon className="mb-4 h-16 w-16 text-destructive" />
          <h2 className="mb-2 text-xl font-extrabold" style={{ color: pageColors.textPrimary }}>ไม่พบกิจกรรมนี้</h2>
          <p style={{ color: pageColors.textSecondary }}>ไม่พบกิจกรรมที่คุณกำลังค้นหา</p>
        </CardContent>
      </Card>
    );
  }

  if (!activityStatus.isActive) {
    return (
      <Card className={cn(accentCardClass, 'animate-in fade-in')} style={{ borderLeftColor: pageColors.accentWarning }}>
        <CardContent className="py-12 text-center">
          <BlockIcon className="mb-4 h-16 w-16 text-amber-500" />
          <h2 className="mb-2 text-xl font-extrabold" style={{ color: pageColors.textPrimary }}>กิจกรรมปิดการลงทะเบียนแล้ว</h2>
          <p className="mb-3" style={{ color: pageColors.textSecondary }}>
            {activityStatus.closeReason || 'กิจกรรมได้ปิดการลงทะเบียนแล้ว'}
          </p>
          <Badge className="rounded-[10px] font-mono font-semibold">{activityStatus.activityCode}</Badge>
        </CardContent>
      </Card>
    );
  }

  if (!activityStatus.userCode) {
    return (
      <Card className={cn(accentCardClass, 'animate-in fade-in')} style={{ borderLeftColor: pageColors.accentInfo }}>
        <CardContent className="py-12 text-center">
          <PersonIcon className="mb-4 h-16 w-16 text-blue-500" />
          <h2 className="mb-2 text-xl font-extrabold" style={{ color: pageColors.textPrimary }}>ไม่มีรหัสผู้ใช้</h2>
          <p className="mb-3" style={{ color: pageColors.textSecondary }}>กิจกรรมยังไม่ได้ตั้งค่ารหัสผู้ใช้</p>
          <Badge className="rounded-[10px] font-mono font-semibold">{activityStatus.activityCode}</Badge>
        </CardContent>
      </Card>
    );
  }

  if (singleUserViolation) {
    return (
      <Card className={cn(accentCardClass, 'animate-in fade-in')} style={{ borderLeftColor: pageColors.accentError }}>
        <CardContent className="py-12 text-center">
          <LockIcon className="mb-4 h-16 w-16 text-destructive" />
          <h2 className="mb-2 text-xl font-extrabold" style={{ color: pageColors.textPrimary }}>ไม่สามารถลงทะเบียนได้</h2>
          <p className="mb-3" style={{ color: pageColors.textSecondary }}>
            กิจกรรมนี้อนุญาตให้ลงทะเบียนได้เพียงผู้ใช้เดียวเท่านั้น
          </p>
          <Badge className="mb-6 rounded-[10px] font-semibold">{currentRegisteredUser}</Badge>
          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Button size="lg" onClick={handleLogout} className="rounded-xl px-8">
              <LogoutIcon className="h-4 w-4" /> ออกจากระบบ
            </Button>
            <Button size="lg" variant="outline" onClick={() => window.close()} className="rounded-xl px-8">
              ปิดหน้าต่าง
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activityStatus.requiresUniversityLogin && !existingUserProfile && !existingAuthStatus) {
    return (
      <Card className={cn(accentCardClass, 'animate-in fade-in')} style={{ borderLeftColor: pageColors.accentWarning }}>
        <CardContent className="py-12 text-center">
          <WarningIcon className="mb-4 h-16 w-16 text-amber-500" />
          <h2 className="mb-2 text-xl font-extrabold" style={{ color: pageColors.textPrimary }}>จำเป็นต้องเข้าสู่ระบบ</h2>
          <p className="mb-4" style={{ color: pageColors.textSecondary }}>
            กิจกรรมนี้ต้องการให้เข้าสู่ระบบด้วยบัญชีมหาวิทยาลัยก่อน
          </p>
          <Button size="lg" onClick={() => window.history.back()} className="rounded-xl px-8">
            กลับไปเข้าสู่ระบบ
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className={cn(accentCardClass, 'animate-in fade-in')} style={{ borderLeftColor: pageColors.accentSuccess }}>
        <CardContent className="py-12 text-center">
          <CheckCircleIcon className="mb-4 h-[72px] w-[72px] text-emerald-500" />
          <h2 className="mb-2 text-xl font-extrabold" style={{ color: pageColors.textPrimary }}>บันทึกสำเร็จ!</h2>
          <p className="mb-4" style={{ color: pageColors.textSecondary }}>
            ข้อมูลการเข้าร่วมกิจกรรมของคุณได้รับการบันทึกเรียบร้อยแล้ว
          </p>
          <Alert variant="success" className="mb-6 rounded-xl text-left">
            <AlertDescription>บันทึก Transcript เรียบร้อยแล้ว</AlertDescription>
          </Alert>
          <Button size="lg" onClick={() => window.close()} className="rounded-xl px-8">
            ปิดหน้าต่าง
          </Button>
        </CardContent>
      </Card>
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
      <Card className={cn(accentCardClass, 'animate-in fade-in')} style={{ borderLeftColor: pageColors.accentSuccess }}>
        <CardContent className="py-12 text-center">
          <CheckCircleIcon className="mb-4 h-[72px] w-[72px] text-emerald-500" />
          <h2 className="mb-2 text-xl font-extrabold" style={{ color: pageColors.textPrimary }}>เช็คอินเรียบร้อย</h2>
          <p className="mb-6" style={{ color: pageColors.textSecondary }}>
            คุณได้เช็คอินรอบ <b>{currentActiveSessionName}</b> เรียบร้อยแล้ว
          </p>
          {nextSession && (
            <div className="mx-auto mt-6 max-w-[450px] rounded-2xl border border-sky-500/20 bg-sky-500/5 p-6 text-center shadow-sm">
              <div className="flex flex-col items-center gap-3">
                <AccessTimeIcon className="h-8 w-8 text-sky-600" />
                <p className="font-bold text-sky-700 dark:text-sky-400">รอบถัดไป: {nextSession.name}</p>
                <p className="text-sm text-muted-foreground">
                  เปิดให้เช็คอินวันที่:{' '}
                  {nextSessionStart?.toLocaleString('th-TH', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  น.
                </p>
                <NextSessionCountdown nextSession={nextSession} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const fieldClass = (ro?: boolean, err?: boolean) =>
    cn('w-full', ro && 'bg-muted/50', err && 'border-destructive');

  /** =========================
   * Main form
   * =======================*/
  return (
    <Card className={cn(glassCardClass, 'animate-in fade-in')}>
      <CardContent className="p-6 sm:p-8">
        <div className="mb-6 text-center">
          <h2
            className="mb-2 text-2xl font-extrabold tracking-tight sm:text-[1.75rem]"
            style={{ color: pageColors.textPrimary }}
          >
            ลงทะเบียนกิจกรรม
          </h2>
          {activityStatus.singleUserMode && (
            <Alert variant="warning" className="mt-2 mb-4 rounded-xl text-left">
              <AlertDescription>
                🔒 <strong>โหมดผู้ใช้เดียว</strong> — กิจกรรมนี้อนุญาตให้ลงทะเบียนได้เพียงบัญชีเดียวเท่านั้น
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="mb-8 hidden items-center gap-2 sm:flex">
          {['กรอกข้อมูล', 'ตรวจสอบตำแหน่ง', 'บันทึกสำเร็จ'].map((label, index) => (
            <React.Fragment key={label}>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                    index < activeStep
                      ? 'bg-emerald-500 text-white'
                      : index === activeStep
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                  )}
                >
                  {index < activeStep ? '✓' : index + 1}
                </span>
                <span
                  className={cn(
                    'text-sm',
                    activeStep === index ? 'font-bold text-primary' : 'text-muted-foreground'
                  )}
                >
                  {label}
                </span>
              </div>
              {index < 2 && <div className="mx-2 h-px flex-1 bg-border" />}
            </React.Fragment>
          ))}
        </div>

        <div className="mb-6 block sm:hidden">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold text-primary">
              {activeStep === 0 && 'ขั้นตอนที่ 1: กรอกข้อมูล'}
              {activeStep === 1 && 'ขั้นตอนที่ 2: ตรวจสอบตำแหน่ง'}
              {activeStep === 2 && 'ขั้นตอนที่ 3: ลงทะเบียนสำเร็จ'}
            </p>
            <span className="text-xs text-muted-foreground">{activeStep + 1} / 3</span>
          </div>
          <Progress value={((activeStep + 1) / 3) * 100} className="h-1.5" />
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6 rounded-xl">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {activeStep === 0 && (
          <div className="animate-in fade-in">
            {(autoFilledData as any).isAutoFilled && (
              <Alert variant="info" className="mb-6 rounded-xl">
                <AlertDescription className="flex items-start gap-2">
                  <VerifiedIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {affiliationKind === 'university'
                      ? 'ข้อมูลส่วนใหญ่ถูกดึงมาจากระบบของมหาวิทยาลัยและได้รับการยืนยันแล้ว'
                      : affiliationKind === 'school'
                        ? 'ลงทะเบียนในฐานะนักเรียนโรงเรียน — แสดงสถานศึกษาและระดับการศึกษาจากโปรไฟล์ของคุณ'
                        : 'ลงทะเบียนในฐานะบุคคลภายนอก — แสดงสถานศึกษาและระดับการศึกษาจากโปรไฟล์ของคุณ'}
                  </span>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
              <div className="space-y-1.5 sm:col-span-6">
                <Label>{isExternal ? 'รหัสอ้างอิง' : 'รหัสนักศึกษา'} *</Label>
                <div className="relative">
                  <BadgeIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={(formData as any).studentId}
                    onChange={handleInputChange('studentId')}
                    disabled={isFieldReadOnly('studentId') || loading || forceRefreshEnabled}
                    className={cn('pl-10 font-mono', fieldClass(isFieldReadOnly('studentId'), !!fieldErrors.studentId))}
                    required
                  />
                  {isFieldReadOnly('studentId') && (
                    <Badge variant="outline" className="absolute right-2 top-1/2 -translate-y-1/2 gap-1 border-0">
                      <VerifiedIcon className="h-3 w-3" /> ยืนยันแล้ว
                    </Badge>
                  )}
                </div>
                <p className={cn('text-xs', fieldErrors.studentId ? 'text-destructive' : 'text-muted-foreground')}>
                  {fieldErrors.studentId ||
                    (!isFieldReadOnly('studentId') && !isExternal && 'เช่น 6421021234 (10 หลัก)') ||
                    (isExternal && 'รหัสอ้างอิงจากระบบสำหรับบุคคลภายนอก')}
                </p>
              </div>

              <div className="space-y-1.5 sm:col-span-4">
                <Label>คำนำหน้าชื่อ *</Label>
                <Select
                  value={(formData as any).nameTitle || undefined}
                  onValueChange={handleSelectChange('nameTitle')}
                  disabled={loading || forceRefreshEnabled}
                >
                  <SelectTrigger className={cn(!!fieldErrors.nameTitle && 'border-destructive')}>
                    <SelectValue placeholder="เลือก" />
                  </SelectTrigger>
                  <SelectContent>
                    {NAME_TITLE_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.nameTitle && <p className="text-xs text-destructive">{fieldErrors.nameTitle}</p>}
              </div>

              <div className="space-y-1.5 sm:col-span-4">
                <Label>ชื่อ *</Label>
                <div className="relative">
                  <PersonIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    lang="th"
                    value={(formData as any).firstName}
                    onChange={handleInputChange('firstName')}
                    disabled={isFieldReadOnly('firstName') || loading || forceRefreshEnabled}
                    className={cn('pl-10', fieldClass(isFieldReadOnly('firstName'), !!fieldErrors.firstName))}
                    required
                  />
                  {isFieldReadOnly('firstName') && (
                    <Badge variant="outline" className="absolute right-2 top-1/2 -translate-y-1/2 gap-1 border-0">
                      <VerifiedIcon className="h-3 w-3" /> ยืนยันแล้ว
                    </Badge>
                  )}
                </div>
                <p className={cn('text-xs', fieldErrors.firstName ? 'text-destructive' : 'text-muted-foreground')}>
                  {fieldErrors.firstName || (!isFieldReadOnly('firstName') && 'ชื่อจริงภาษาไทยเท่านั้น')}
                </p>
              </div>

              <div className="space-y-1.5 sm:col-span-4">
                <Label>นามสกุล *</Label>
                <div className="relative">
                  <PersonIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    lang="th"
                    value={(formData as any).lastName}
                    onChange={handleInputChange('lastName')}
                    disabled={isFieldReadOnly('lastName') || loading || forceRefreshEnabled}
                    className={cn('pl-10', fieldClass(isFieldReadOnly('lastName'), !!fieldErrors.lastName))}
                    required
                  />
                  {isFieldReadOnly('lastName') && (
                    <Badge variant="outline" className="absolute right-2 top-1/2 -translate-y-1/2 gap-1 border-0">
                      <VerifiedIcon className="h-3 w-3" /> ยืนยันแล้ว
                    </Badge>
                  )}
                </div>
                <p className={cn('text-xs', fieldErrors.lastName ? 'text-destructive' : 'text-muted-foreground')}>
                  {fieldErrors.lastName || (!isFieldReadOnly('lastName') && 'นามสกุลภาษาไทยเท่านั้น')}
                </p>
              </div>

              {isExternal ? (
                <>
                  <div className="space-y-1.5 sm:col-span-6">
                    <Label>{affiliationKind === 'school' ? 'โรงเรียน / สถานศึกษา' : 'สถานศึกษา / หน่วยงาน'} *</Label>
                    <div className="relative">
                      <Input
                        value={(formData as any).department || existingUserProfile?.institutionName || ''}
                        disabled
                        className={cn('bg-muted/50 pr-24', !!fieldErrors.department && 'border-destructive')}
                        required
                      />
                      <Badge variant="outline" className="absolute right-2 top-1/2 -translate-y-1/2 gap-1 border-0">
                        <VerifiedIcon className="h-3 w-3" />
                        {affiliationKind === 'school' ? 'นักเรียน' : 'บุคคลภายนอก'}
                      </Badge>
                    </div>
                    <p className={cn('text-xs', fieldErrors.department ? 'text-destructive' : 'text-muted-foreground')}>
                      {fieldErrors.department || 'ดึงจากโปรไฟล์ — แก้ไขได้ที่เมนูโปรไฟล์'}
                    </p>
                  </div>
                  <div className="space-y-1.5 sm:col-span-6">
                    <Label>ระดับการศึกษา *</Label>
                    <Input
                      value={(formData as any).degree || existingUserProfile?.educationLevel || ''}
                      disabled
                      className={cn('bg-muted/50', !!fieldErrors.degree && 'border-destructive')}
                      required
                    />
                    <p className={cn('text-xs', fieldErrors.degree ? 'text-destructive' : 'text-muted-foreground')}>
                      {fieldErrors.degree ||
                        (EDUCATION_LEVEL_OPTIONS.includes(
                          ((formData as any).degree || existingUserProfile?.educationLevel || '') as any
                        )
                          ? 'ดึงจากโปรไฟล์'
                          : 'กรุณาระบุในโปรไฟล์ก่อนลงทะเบียน')}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5 sm:col-span-6">
                    <Label>คณะ *</Label>
                    <Select
                      value={(formData as any).faculty || undefined}
                      onValueChange={handleSelectChange('faculty')}
                      disabled={isFieldReadOnly('faculty') || loading || forceRefreshEnabled}
                    >
                      <SelectTrigger className={cn(isFieldReadOnly('faculty') && 'bg-muted/50', !!fieldErrors.faculty && 'border-destructive')}>
                        <SelectValue placeholder="เลือกคณะ" />
                      </SelectTrigger>
                      <SelectContent>
                        {PSU_FACULTIES.map((f) => (
                          <SelectItem key={f.code} value={f.name}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isFieldReadOnly('faculty') && (
                      <Badge variant="outline" className="mt-1 gap-1 border-0">
                        <VerifiedIcon className="h-3 w-3" /> ยืนยันแล้ว
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1.5 sm:col-span-6">
                    <Label>สาขาวิชา *</Label>
                    <Input
                      list="dept-options"
                      value={(formData as any).department || ''}
                      onChange={(e) => {
                        if (forceRefreshEnabled) return;
                        setFormData({ ...formData, department: e.target.value });
                        setError('');
                        setFieldErrors((prev) => ({ ...prev, department: '' }));
                      }}
                      disabled={departmentsLoading || loading || forceRefreshEnabled || !(formData as any).faculty}
                      className={cn(!!fieldErrors.department && 'border-destructive')}
                      required
                    />
                    <datalist id="dept-options">
                      {filteredDepartments.map((d) => (
                        <option key={d.id} value={d.name} />
                      ))}
                    </datalist>
                    <p className={cn('text-xs', fieldErrors.department ? 'text-destructive' : 'text-muted-foreground')}>
                      {fieldErrors.department ||
                        (departmentsLoading
                          ? 'กำลังโหลดข้อมูลสาขา...'
                          : !(formData as any).faculty
                            ? 'เลือกคณะก่อน'
                            : filteredDepartments.length === 0
                              ? 'ไม่พบสาขาสำหรับคณะนี้'
                              : `พบ ${filteredDepartments.length} สาขา`)}
                    </p>
                  </div>

                  <div className="space-y-1.5 sm:col-span-6">
                    <Label>ระดับการศึกษา *</Label>
                    <Select
                      value={(formData as any).degree || undefined}
                      onValueChange={handleSelectChange('degree')}
                      disabled={isFieldReadOnly('degree') || loading || forceRefreshEnabled}
                    >
                      <SelectTrigger className={cn(isFieldReadOnly('degree') && 'bg-muted/50')}>
                        <SelectValue placeholder="เลือกระดับ" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEGREE_LEVELS.map((d) => (
                          <SelectItem key={d.code} value={d.name}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isFieldReadOnly('degree') && (
                      <Badge variant="outline" className="mt-1 gap-1 border-0">
                        <VerifiedIcon className="h-3 w-3" /> ยืนยันแล้ว
                      </Badge>
                    )}
                  </div>
                </>
              )}
            </div>

            <Separator className="my-6 sm:my-8" />

            <div className="flex flex-col items-stretch justify-end gap-3 sm:flex-row sm:items-center">
              <Button
                size="lg"
                onClick={handleSubmit}
                disabled={
                  loading ||
                  forceRefreshEnabled ||
                  !validateNameTitle((formData as any).nameTitle || '') ||
                  !validateThaiName((formData as any).firstName || '') ||
                  !validateThaiName((formData as any).lastName || '') ||
                  (isExternal
                    ? !((formData as any).department || existingUserProfile?.institutionName)?.trim()
                    : departmentsLoading || !(formData as any).faculty || filteredDepartments.length === 0)
                }
                className="rounded-xl bg-[#007aff] px-8 py-3 shadow-[0_4px_14px_rgba(0,122,255,0.39)] hover:bg-[#005bb5]"
              >
                {loading ? (
                  <>
                    <Spinner size="sm" className="text-white" />
                    กำลังเตรียมตรวจสอบ...
                  </>
                ) : (
                  'ตรวจสอบตำแหน่ง'
                )}
              </Button>
            </div>
          </div>
        )}

        {activeStep === 1 && (
          <div className="animate-in fade-in text-center">
            <LocationIcon className="mb-4 h-20 w-20 text-primary drop-shadow-md" />
            {locStage === 'pre' ? (
              <>
                <h3 className="mb-2 text-xl font-bold text-primary">กำลังเตรียมตรวจสอบตำแหน่ง</h3>
                <p className="mb-4 text-muted-foreground">กรุณารอสักครู่...</p>
                <Spinner size="lg" />
              </>
            ) : (
              <>
                <h3 className="mb-2 text-xl font-bold text-primary">กำลังตรวจสอบตำแหน่ง</h3>
                <p className="mb-4 text-muted-foreground">
                  กรุณาอนุญาตการเข้าถึงตำแหน่งของคุณเพื่อยืนยันการเข้าร่วมกิจกรรม
                </p>
                <LocationChecker
                  allowedLocation={getActivityAllowedLocation()}
                  onLocationVerified={handleLocationVerified}
                  onLocationError={handleLocationError}
                />
              </>
            )}
          </div>
        )}

        {activeStep === 2 && surveyConfig && (
          <div className="animate-in fade-in">
            <SurveyForm
              activityCode={activityCode}
              activityDocId={activityDocId}
              surveyConfig={surveyConfig}
              userId={existingUserProfile?.id || (formData as any).userId || ''}
              onCompleted={() => {
                setSuccess(true);
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityRegistrationForm;
