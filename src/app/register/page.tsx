'use client';
import React, { useEffect, useMemo, useState, Suspense, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  RefreshCw as RefreshIcon,
  Crosshair as GpsFixedIcon,
  CircleCheck as CheckIcon,
  CircleAlert as ErrorIcon,
  Lock as LockIcon,
  Clock as AccessTimeIcon,
  MapPin as PlaceIcon,
  CalendarCheck as EventStartIcon,
  CalendarX as EventEndIcon,
  Users as GroupsIcon,
  FileText as ArticleIcon,
  LayoutList as SessionsIcon,
  LocateFixed as MyLocationIcon,
  Radar as RadarIcon,
  PlayCircle as PlayIcon,
} from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

// Components
import Navbar from '../../components/Navbar';
import MicrosoftAuthSection from '../../components/auth/MicrosoftAuthSection';
import {
  DuplicateRegistrationAlert,
  ProfileSetupAlert,
  SuccessAlert,
  ActivityStatusAlert,
} from '../../components/alerts/StatusAlerts';
import ProfileEditDialog from '../../components/profile/ProfileEditDialog';
import ActivityRegistrationForm from '../../components/ActivityRegistrationForm';
import type { ActivityUserProfile } from '../../components/ActivityRegistrationForm';
import GeofenceMap from '../../components/maps/GeofenceMap';
import Footer from '../../components/Footer';
import SurveyForm from '../../components/activity/SurveyForm';
import FullPageError, { FullPageErrorVariant } from '../../components/common/FullPageError';
import { glassCardClass, pageColors, pageLayoutClass } from '../../lib/uiTheme';
import Image from 'next/image';
import 'quill/dist/quill.snow.css';

// Firebase helpers
import { db, auth } from '../../lib/firebase';
import { useAuth, UniversityUserProfile, isProfileComplete } from '../../lib/firebaseAuth';
import { SessionManager } from '../../lib/sessionManager';
import { AdminSettings } from '../../types';
import { getSurveyWindowStatus } from '../../lib/surveyWindow';
import {
  dynamicQrExpiredMessage,
  dynamicQrExpiredTitle,
  type DynamicQrExpiredContext,
} from '../../lib/dynamicQrMessages';

/* ============================= Types ============================= */
interface ActivityData {
  id: string;
  activityCode: string;
  activityName: string;
  description: string;
  location: string;
  latitude: number;
  longitude: number;
  checkInRadius: number; // meters
  userCode: string;
  startDateTime: any;
  endDateTime: any;
  isActive: boolean;
  maxParticipants: number;
  currentParticipants: number;
  qrUrl: string;
  targetUrl: string;
  requiresUniversityLogin: boolean;
  bannerUrl?: string;
  bannerColor?: string;
  bannerTintColor?: string;
  bannerTintOpacity?: number;
  createdAt?: any;
  updatedAt?: any;
  singleUserMode?: boolean;
  closeReason?: string;
  bannerAspect?: string;
  dynamicQREnabled?: boolean;
  dynamicToken?: string;
  previousDynamicToken?: string;
  /** จุดลงทะเบียนหน้างานที่แอดมินตั้ง */
  onsiteRegistrationPoint?: string;
  sessions?: any[];
  surveyConfig?: any;
}

interface IPLoginRecord {
  ipAddress: string;
  userEmail: string;
  loginTime: any;
  expiresAt: any;
}

interface ActivityStatusInfo {
  status: 'active' | 'upcoming' | 'full' | 'ended' | 'inactive';
  message: string;
  startTime?: Date;
  endTime?: Date;
}

/* ============================= Utils ============================= */
const toRad = (deg: number) => (deg * Math.PI) / 180;
const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

const formatDateTime = (d: any) => {
  const dd: Date = d?.toDate?.() ?? (d instanceof Date ? d : new Date(d));
  return dd.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
};

// cache IP 10 นาที
let cachedIP: { ip: string; at: number } | null = null;
const getUserIP = async (): Promise<string> => {
  try {
    const now = Date.now();
    if (cachedIP && now - cachedIP.at < 10 * 60 * 1000) return cachedIP.ip;
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    cachedIP = { ip: data.ip, at: now };
    return data.ip;
  } catch (e) {
    try {
      const res = await fetch('https://ipapi.co/json/');
      const data = await res.json();
      const now = Date.now();
      cachedIP = { ip: data.ip, at: now };
      return data.ip;
    } catch {
      return 'unknown';
    }
  }
};

const checkIPRestriction = async (
  userEmail: string
): Promise<{ canLogin: boolean; message?: string; remainingTime?: number }> => {
  try {
    const userIP = await getUserIP();
    // ไม่บล็อกการล็อกอินตาม IP — เครือข่ายมหาวิทยาลัยใช้ public IP ร่วมกัน
    // เก็บประวัติไว้ติดตามเท่านั้น
    const now = new Date();
    const q = query(collection(db, 'ipLoginRecords'), where('ipAddress', '==', userIP), limit(1));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      await updateDoc(snapshot.docs[0].ref, {
        userEmail,
        loginTime: now,
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      });
    } else {
      await addDoc(collection(db, 'ipLoginRecords'), {
        ipAddress: userIP,
        userEmail,
        loginTime: now,
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      });
    }
    return { canLogin: true };
  } catch {
    return { canLogin: true };
  }
};

/* ============================= Helpers ============================= */
const getActivityStatus = (activity: ActivityData): ActivityStatusInfo => {
  const now = new Date();
  const startTime: Date = activity.startDateTime?.toDate?.() || new Date(activity.startDateTime);
  const endTime: Date = activity.endDateTime?.toDate?.() || new Date(activity.endDateTime);

  if (!activity.isActive)
    return { status: 'inactive', message: activity.closeReason || 'กิจกรรมนี้ถูกปิดใช้งานแล้ว' };

  if (activity.maxParticipants > 0 && activity.currentParticipants >= activity.maxParticipants)
    return { status: 'full', message: 'กิจกรรมนี้มีผู้สมัครครบจำนวนแล้ว' };

  if (activity.sessions && activity.sessions.length > 0) {
    // Sort sessions by start time
    const sortedSessions = [...activity.sessions].sort((a, b) => {
      const aTime = a.startDateTime?.toDate?.()?.getTime() || new Date(a.startDateTime as any).getTime();
      const bTime = b.startDateTime?.toDate?.()?.getTime() || new Date(b.startDateTime as any).getTime();
      return aTime - bTime;
    });

    const activeSession = sortedSessions.find(s => {
      const sStart = s.startDateTime?.toDate?.() || new Date(s.startDateTime as any);
      const sEnd = s.endDateTime?.toDate?.() || new Date(s.endDateTime as any);
      return now >= sStart && now <= sEnd;
    });

    if (activeSession) {
      return { status: 'active', message: `รอบ: ${activeSession.name}` };
    }

    const nextSession = sortedSessions.find(s => {
      const sStart = s.startDateTime?.toDate?.() || new Date(s.startDateTime as any);
      return now < sStart;
    });

    if (nextSession) {
      const nStart = nextSession.startDateTime?.toDate?.() || new Date(nextSession.startDateTime as any);
      return {
        status: 'upcoming',
        message: `รอบถัดไป (${nextSession.name}) จะเปิดในวันที่ ${formatDateTime(nStart)}`,
        startTime: nStart,
      };
    }

    const lastSession = sortedSessions[sortedSessions.length - 1];
    const lEnd = lastSession.endDateTime?.toDate?.() || new Date(lastSession.endDateTime as any);
    return {
      status: 'ended',
      message: `กิจกรรมสิ้นสุดแล้วเมื่อวันที่ ${formatDateTime(lEnd)}`,
      endTime: lEnd,
    };
  }

  // Fallback to main activity time
  if (now < startTime)
    return {
      status: 'upcoming',
      message: `กิจกรรมจะเปิดลงทะเบียนในวันที่ ${formatDateTime(startTime)}`,
      startTime,
    };

  if (now > endTime)
    return {
      status: 'ended',
      message: `กิจกรรมสิ้นสุดแล้วเมื่อวันที่ ${formatDateTime(endTime)}`,
      endTime,
    };

  return { status: 'active', message: '' };
};

/* ============================= UI: icon sections ============================= */
const SectionIcon: React.FC<{
  icon: React.ReactNode;
  color?: string;
  bg?: string;
}> = ({ icon, color = pageColors.accentInfo, bg }) => (
  <div
    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl [&_svg]:h-[22px] [&_svg]:w-[22px]"
    style={{ color, backgroundColor: bg || `${color}20` }}
  >
    {icon}
  </div>
);

const DetailSection: React.FC<{
  icon: React.ReactNode;
  title: string;
  hint?: string;
  color?: string;
  children: React.ReactNode;
}> = ({ icon, title, hint, color = pageColors.accentInfo, children }) => (
  <div className="rounded-2xl border bg-accent/30 p-4" style={{ borderColor: pageColors.border }}>
    <div className={cn('flex items-start gap-3', children ? 'mb-3' : '')}>
      <SectionIcon icon={icon} color={color} />
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-extrabold leading-tight" style={{ color: pageColors.textPrimary }}>
          {title}
        </p>
        {hint && (
          <p className="mt-0.5 block text-xs" style={{ color: pageColors.textSecondary }}>
            {hint}
          </p>
        )}
      </div>
    </div>
    {children}
  </div>
);

const MetaRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  color?: string;
}> = ({ icon, label, value, color = pageColors.accentInfo }) => (
  <div className="flex items-start gap-3">
    <SectionIcon icon={icon} color={color} />
    <div className="min-w-0">
      <p className="text-[0.7rem] font-bold uppercase tracking-wide" style={{ color: pageColors.textSecondary }}>
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold leading-snug" style={{ color: pageColors.textPrimary }}>
        {value}
      </p>
    </div>
  </div>
);

/* ============================= Modern Activity Banner ============================= */
const ModernActivityBanner: React.FC<{
  activity: ActivityData;
  status: ActivityStatusInfo;
  adminSettings: AdminSettings | null;
}> = ({ activity, status, adminSettings }) => {
  const tintColor =
    activity.bannerTintColor || (adminSettings as any)?.branding?.primaryColor || '#1c1c1e';
  const hasImage = !!activity.bannerUrl;

  const statusLabel =
    status.status === 'active'
      ? 'เปิดลงทะเบียน'
      : status.status === 'upcoming'
      ? 'ยังไม่เปิด'
      : status.status === 'full'
      ? 'เต็มแล้ว'
      : status.status === 'ended'
      ? 'สิ้นสุดแล้ว'
      : 'ปิดใช้งาน';

  const statusIcon =
    status.status === 'active' ? (
      <PlayIcon className="h-3.5 w-3.5" />
    ) : status.status === 'upcoming' ? (
      <AccessTimeIcon className="h-3.5 w-3.5" />
    ) : status.status === 'full' ? (
      <GroupsIcon className="h-3.5 w-3.5" />
    ) : (
      <LockIcon className="h-3.5 w-3.5" />
    );

  const statusBadgeClass =
    status.status === 'active'
      ? 'bg-[rgba(52,199,89,0.35)] text-white'
      : status.status === 'upcoming'
      ? 'bg-[rgba(0,122,255,0.35)] text-white'
      : status.status === 'full'
      ? 'bg-[rgba(255,149,0,0.35)] text-white'
      : 'bg-black/45 text-white';

  return (
    <Card className={cn(glassCardClass, 'mb-6 overflow-hidden border-0 p-0 shadow-none')}>
      <div
        className="relative h-[180px] overflow-hidden md:h-[220px]"
        style={{ backgroundColor: activity.bannerColor || tintColor || '#1c1c1e' }}
      >
        {hasImage && (
          <>
            <div className="absolute inset-0">
              <Image
                src={activity.bannerUrl!}
                alt={activity.activityName}
                fill
                sizes="100vw"
                style={{ objectFit: activity.bannerAspect === 'contain' ? 'contain' : 'cover' }}
                priority
              />
            </div>
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.55) 100%)' }}
            />
          </>
        )}
        <div className="absolute left-3 top-3">
          <Badge
            className={cn(
              'gap-1 rounded-xl border border-white/20 font-bold shadow-md backdrop-blur-md',
              statusBadgeClass
            )}
          >
            {statusIcon}
            {statusLabel}
          </Badge>
        </div>
      </div>

      <CardContent className="p-6 md:p-6">
        <h2
          className="mb-4 text-xl font-extrabold tracking-tight"
          style={{ color: pageColors.textPrimary }}
        >
          {activity.activityName}
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {activity.location && (
            <MetaRow
              icon={<PlaceIcon />}
              label="สถานที่"
              value={activity.location}
              color={pageColors.accentError}
            />
          )}
          <MetaRow
            icon={<AccessTimeIcon />}
            label="ช่วงเวลา"
            value={
              <>
                {formatDateTime(activity.startDateTime)}
                <span className="mx-2" style={{ color: pageColors.textSecondary }}>
                  →
                </span>
                {formatDateTime(activity.endDateTime)}
              </>
            }
            color={pageColors.accentInfo}
          />
          {activity.maxParticipants > 0 && (
            <MetaRow
              icon={<GroupsIcon />}
              label="ผู้สมัคร"
              value={`${activity.currentParticipants}/${activity.maxParticipants} คน`}
              color={pageColors.appleGreen}
            />
          )}
          {activity.sessions && activity.sessions.length > 0 && (
            <MetaRow
              icon={<SessionsIcon />}
              label="รอบย่อย"
              value={`${activity.sessions.length} รอบ`}
              color={pageColors.accentWarning}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const SessionCard: React.FC<{ session: any; isCheckedIn: boolean }> = ({ session, isCheckedIn }) => {
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);

  const sStart = useMemo(
    () => session.startDateTime?.toDate?.() || new Date(session.startDateTime),
    [session.startDateTime]
  );
  const sEnd = useMemo(
    () => session.endDateTime?.toDate?.() || new Date(session.endDateTime),
    [session.endDateTime]
  );

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

  const now = new Date();
  const isActive = now >= sStart && now <= sEnd;
  const isUpcoming = now < sStart;

  const statusLabel = isCheckedIn
    ? 'เช็คอินแล้ว'
    : isActive
      ? 'กำลังเปิด'
      : isUpcoming
        ? ''
        : 'สิ้นสุดแล้ว';

  return (
    <Card
      className={cn(
        'relative overflow-hidden border',
        isCheckedIn
          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
          : isActive
            ? 'border-primary bg-primary/5'
            : 'border-border bg-accent/40',
        !(isActive || isCheckedIn || isUpcoming) && 'opacity-65'
      )}
    >
      {isUpcoming && timeLeft && (
        <div className="absolute bottom-0 left-0 h-0.5 w-full bg-sky-500/30">
          <div className="h-full w-[30%] animate-[slide_2s_infinite_ease-in-out] bg-sky-500" />
        </div>
      )}

      <CardContent className="py-3 last:pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div
              className={cn(
                'grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px]',
                isCheckedIn
                  ? 'bg-emerald-500/15 text-emerald-600'
                  : isActive
                    ? 'bg-primary/15 text-primary'
                    : 'bg-accent text-muted-foreground'
              )}
            >
              {isCheckedIn ? (
                <CheckIcon className="h-4 w-4" />
              ) : isActive ? (
                <PlayIcon className="h-4 w-4" />
              ) : (
                <LockIcon className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0">
              <p
                className={cn(
                  'text-sm font-bold',
                  isCheckedIn ? 'text-emerald-600' : isActive ? 'text-primary' : ''
                )}
              >
                {session.name}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <AccessTimeIcon className="h-3.5 w-3.5" />
                {formatDateTime(sStart)} – {formatDateTime(sEnd)}
              </p>
              {isUpcoming && timeLeft && (
                <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-sky-600">
                  <AccessTimeIcon className="h-3.5 w-3.5" />
                  เปิดในอีก {timeLeft.d > 0 ? `${timeLeft.d} วัน ` : ''}
                  {timeLeft.h > 0 ? `${timeLeft.h} ชม. ` : ''}
                  {timeLeft.m} นาที {timeLeft.s} วินาที
                </p>
              )}
            </div>
          </div>
          {statusLabel ? (
            <Badge
              variant={isCheckedIn ? 'success' : isActive ? 'default' : 'outline'}
              className="gap-1 font-semibold"
            >
              {isCheckedIn && <CheckIcon className="h-3.5 w-3.5" />}
              {statusLabel}
            </Badge>
          ) : (
            <div className="flex items-center p-1">
              <LockIcon className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

/* ============================= Main content ============================= */
const RegisterPageContent: React.FC = () => {
  const searchParams = useSearchParams();
  const activityCodeRaw = searchParams.get('activity') || '';
  const activityCode = useMemo(() => activityCodeRaw.trim().toUpperCase(), [activityCodeRaw]);

  const { user, userData, loading: authLoading, logout, refreshUserData } = useAuth();

  // States
  const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(null);
  const [activityData, setActivityData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qrExpireMeta, setQrExpireMeta] = useState<DynamicQrExpiredContext | null>(null);
  const [validActivity, setValidActivity] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Session
  const [sessionExpired, setSessionExpired] = useState(false);
  const [sessionWarning, setSessionWarning] = useState('');
  const [sessionValidating, setSessionValidating] = useState(false);

  // IP restriction
  const [ipBlocked, setIpBlocked] = useState(false);
  const [blockRemainingTime, setBlockRemainingTime] = useState(0);

  // Duplicate
  const [isDuplicateRegistration, setIsDuplicateRegistration] = useState(false);
  const [checkedInSessions, setCheckedInSessions] = useState<string[]>([]);
  const [hasRegisteredRecord, setHasRegisteredRecord] = useState(false);
  /** รอเช็กประวัติลงทะเบียนเสร็จก่อนค่อยขอ GPS — กัน prompt โผล่ทั้งที่ลงทะเบียนแล้ว */
  const [registrationCheckDone, setRegistrationCheckDone] = useState(false);

  // Survey
  const [surveyCompleted, setSurveyCompleted] = useState(false);

  // Profile
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);

  // Single user mode
  const [singleUserBlocked, setSingleUserBlocked] = useState(false);
  const [singleUserMessage, setSingleUserMessage] = useState('');

  // GPS / Geofence
  const [geoSupported, setGeoSupported] = useState(true);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoAllowed, setGeoAllowed] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [inRadius, setInRadius] = useState(false);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);

  // Realtime toggle feedback (สำรอง)
  const [snack, setSnack] = useState<{ open: boolean; text: string; severity: 'success' | 'warning' | 'info' }>(
    { open: false, text: '', severity: 'info' }
  );
  const lastActiveRef = useRef<boolean | null>(null);
  const sessionCheckStartedRef = useRef(false);
  const geoRequestIdRef = useRef(0);

  /** นับถอยหลังก่อนปิดลงทะเบียน (≤ 5 นาที) */
  const [deadlineCountdown, setDeadlineCountdown] = useState<string | null>(null);

  const isAuthed = useMemo(
    () => !!(user && userData && !sessionExpired && !sessionValidating),
    [user, userData, sessionExpired, sessionValidating]
  );

  const resetGeoState = useCallback(() => {
    setGeoSupported(true);
    setGeoLoading(false);
    setGeoAllowed(false);
    setGeoError('');
    setDistanceM(null);
    setInRadius(false);
    setUserPos(null);
  }, []);

  /* ============================= Effects — initial ============================= */
  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityCode]);

  useEffect(() => {
    if (!user?.uid || sessionExpired) {
      sessionCheckStartedRef.current = false;
      return;
    }
    if (sessionCheckStartedRef.current) return;
    sessionCheckStartedRef.current = true;
    validateInitialSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, sessionExpired]);

  useEffect(() => {
    let sessionCheck: any;
    if (user && !sessionExpired) {
      sessionCheck = setInterval(() => validateUserSession(false), 120000);
    }
    return () => sessionCheck && clearInterval(sessionCheck);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, sessionExpired]);

  useEffect(() => {
    // รีเซ็ตเฉพาะเมื่อ user/กิจกรรม/เซสชันเปลี่ยน — ไม่รีเซ็ตทุกครั้งที่ activityData อัปเดต realtime
    setRegistrationCheckDone(false);
    if (user && activityCode && activityData?.id && !sessionExpired && !sessionValidating) {
      checkForDuplicateRegistration();
      checkForSingleUserMode();
    } else if (!user) {
      setRegistrationCheckDone(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, activityCode, activityData?.id, sessionExpired, sessionValidating]);

  useEffect(() => {
    if (user && userData !== null && !sessionExpired && !sessionValidating) {
      const needsSetup = !isProfileComplete(userData);
      setNeedsProfileSetup(needsSetup);
      if (needsSetup && !showProfileDialog) setShowProfileDialog(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userData, showProfileDialog, sessionExpired, sessionValidating]);

  // ✅ รีเซ็ต GEO ทุกครั้งที่ “ไม่ผ่าน auth” (logout / session expired / user null)
  useEffect(() => {
    if (!isAuthed) resetGeoState();
  }, [isAuthed, resetGeoState]);

  // Realtime: ฟังเอกสาร activityQRCodes/{id}
  useEffect(() => {
    if (!activityData?.id) return;
    const unsubscribe = onSnapshot(doc(db, 'activityQRCodes', activityData.id), (docSnap) => {
      if (!docSnap.exists()) return;

      const data: any = docSnap.data();
      setActivityData((prev) => {
        if (!prev) return prev;
        const updated: ActivityData = {
          ...prev,
          // ข้อมูลหลัก (sync ทั้งหมดแบบ real-time)
          activityName: data.activityName || prev.activityName,
          description: data.description ?? prev.description,
          location: data.location ?? prev.location,
          latitude: data.latitude ?? prev.latitude,
          longitude: data.longitude ?? prev.longitude,
          checkInRadius: data.checkInRadius ?? prev.checkInRadius,
          startDateTime: data.startDateTime ?? prev.startDateTime,
          endDateTime: data.endDateTime ?? prev.endDateTime,
          maxParticipants: data.maxParticipants ?? prev.maxParticipants,
          currentParticipants: data.currentParticipants || 0,
          isActive: data.isActive !== undefined ? data.isActive : true,
          requiresUniversityLogin: data.requiresUniversityLogin ?? prev.requiresUniversityLogin,
          singleUserMode: data.singleUserMode || false,
          closeReason: data.closeReason || '',
          userCode: data.userCode ?? prev.userCode,
          // แบนเนอร์
          bannerAspect: data.bannerAspect || prev.bannerAspect,
          bannerUrl: data.bannerUrl ?? prev.bannerUrl,
          bannerColor: data.bannerColor ?? prev.bannerColor,
          bannerTintColor: data.bannerTintColor ?? prev.bannerTintColor,
          bannerTintOpacity: typeof data.bannerTintOpacity === 'number' ? data.bannerTintOpacity : prev.bannerTintOpacity,
          // ฟีเจอร์ใหม่
          sessions: data.sessions ?? prev.sessions,
          surveyConfig: data.surveyConfig ?? (prev as any).surveyConfig,
        };

        const s = getActivityStatus(updated);
        setValidActivity(s.status === 'active');

        const prevActive = lastActiveRef.current;
        const nowActive = updated.isActive;
        if (prevActive !== null && prevActive !== nowActive) {
          setSnack({
            open: true,
            severity: nowActive ? 'success' : 'warning',
            text: nowActive
              ? 'ผู้ดูแลได้เปิดกิจกรรมแล้ว — เริ่มลงทะเบียนได้'
              : `ผู้ดูแลได้ปิดกิจกรรมแล้ว${updated.closeReason ? ' — ' + updated.closeReason : ''}`,
          });
        }
        lastActiveRef.current = nowActive;

        return updated;
      });
    });
    return () => unsubscribe();
  }, [activityData?.id]);

  useEffect(() => {
    if (hasRegisteredRecord && activityData) {
      if (!activityData.sessions || activityData.sessions.length === 0) {
        setIsDuplicateRegistration(true);
        setError('บัญชีนี้เคยลงทะเบียนกิจกรรมนี้แล้ว');
      }
    }
  }, [hasRegisteredRecord, activityData]);

  // countdown ≤ 5 นาที
  useEffect(() => {
    if (!activityData?.endDateTime) {
      setDeadlineCountdown(null);
      return;
    }
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const end: Date = activityData.endDateTime?.toDate?.() || new Date(activityData.endDateTime);
      const now = new Date();
      const sec = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
      if (sec <= 300 && sec > 0) {
        const m = Math.floor(sec / 60).toString().padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        setDeadlineCountdown(`${m}:${s}`);
      } else {
        setDeadlineCountdown(null);
      }
      t = setTimeout(tick, 1000);
    };
    tick();
    return () => clearTimeout(t);
  }, [activityData?.endDateTime]);

  /* ============================= Helpers & Actions ============================= */
  const canProceedToRegistration = () => {
    if (!activityData) return false;
    if (!user) return false;
    if (sessionExpired) return false;
    if (sessionValidating) return false;
    if (ipBlocked) return false;
    if (!registrationCheckDone) return false; // รอเช็กประวัติก่อน — กันแผนที่/ฟอร์มแว็บโผล่
    if (isDuplicateRegistration) return false;
    if (needsProfileSetup) return false;
    if (singleUserBlocked) return false;
    return true;
  };

  const shouldShowMicrosoftLogin = () =>
    (!user || sessionExpired) &&
    !ipBlocked &&
    (!isDuplicateRegistration || canEnterSurveyFlow) &&
    !singleUserBlocked;

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError('');

      const { getAdminSettings } = await import('../../lib/firebaseUtils');
      const settings = await getAdminSettings();
      if (!settings?.isActive) {
        setAdminSettings(null);
        setError('ระบบลงทะเบียนถูกปิดใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ');
        setLoading(false);
        return;
      }
      setAdminSettings(settings);

      if (!activityCode) {
        setError('ไม่พบรหัสกิจกรรม กรุณาสแกน QR Code ใหม่');
        setLoading(false);
        return;
      }

      const qAct = query(collection(db, 'activityQRCodes'), where('activityCode', '==', activityCode), limit(1));
      const querySnapshot = await getDocs(qAct);

      if (querySnapshot.empty) {
        setError('ไม่พบรหัสกิจกรรมนี้ในระบบ กรุณาติดต่อผู้ดูแล');
        setValidActivity(false);
      } else {
        const docRef = querySnapshot.docs[0];
        const docData: any = docRef.data();
        const activity: ActivityData = {
          id: docRef.id,
          ...docData,
          currentParticipants: docData.currentParticipants || 0,
          latitude: docData.latitude || 13.7563,
          longitude: docData.longitude || 100.5018,
          checkInRadius: docData.checkInRadius || 100,
          userCode: docData.userCode || '',
          requiresUniversityLogin: docData.requiresUniversityLogin || false,
          singleUserMode: docData.singleUserMode || false,
          closeReason: docData.closeReason || '',
          bannerAspect: docData.bannerAspect || 'cover',
          bannerColor: docData.bannerColor,
          bannerTintColor: docData.bannerTintColor,
          bannerTintOpacity: typeof docData.bannerTintOpacity === 'number' ? docData.bannerTintOpacity : undefined,
          dynamicQREnabled: docData.dynamicQREnabled || false,
          dynamicToken: docData.dynamicToken,
          previousDynamicToken: docData.previousDynamicToken,
          onsiteRegistrationPoint: docData.onsiteRegistrationPoint || '',
        } as ActivityData;

        setActivityData(activity);
        
        // Dynamic QR Validation (HMAC ตามเวลา + fallback token เก่า)
        if (activity.dynamicQREnabled) {
          const expireCtx = (reason: DynamicQrExpiredContext['reason']): DynamicQrExpiredContext => ({
            dynamicQREnabled: true,
            onsiteRegistrationPoint: activity.onsiteRegistrationPoint,
            location: activity.location,
            reason,
          });

          const dt = searchParams.get('dt');
          if (!dt) {
            const ctx = expireCtx('missing_dt');
            setQrExpireMeta(ctx);
            setError(dynamicQrExpiredMessage(ctx));
            setValidActivity(false);
            setLoading(false);
            return;
          }

          let valid = false;
          let apiReason: string | null = null;
          try {
            const res = await fetch(
              `/api/dynamic-qr/validate?code=${encodeURIComponent(activity.activityCode)}&dt=${encodeURIComponent(dt)}`,
              { cache: 'no-store' }
            );
            const data = await res.json();
            valid = Boolean(data?.valid);
            apiReason = data?.reason || null;
          } catch {
            // ถ้า API ล้ม ใช้เทียบ token เก่าในเอกสารชั่วคราว
            valid = dt === activity.dynamicToken || dt === activity.previousDynamicToken;
          }

          if (!valid) {
            const ctx = expireCtx(apiReason === 'invalid' ? 'invalid' : 'expired');
            setQrExpireMeta(ctx);
            setError(dynamicQrExpiredMessage(ctx));
            setValidActivity(false);
            setLoading(false);
            return;
          }
        }

        const statusInfo = getActivityStatus(activity);
        setValidActivity(statusInfo.status === 'active');
        lastActiveRef.current = activity.isActive;
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  // เช็คซ้ำจาก activityRecords (id = `${activityCode}_${uid}`)
  const checkForDuplicateRegistration = async () => {
    if (!user?.uid || !activityCode) {
      setRegistrationCheckDone(true);
      return;
    }
    try {
      const recId = `${activityCode}_${user.uid}`;
      const snap = await getDoc(doc(db, 'activityRecords', recId));
      const dup = snap.exists();

      if (dup) {
        setHasRegisteredRecord(true);
        const data = snap.data();
        if (data.checkedInSessions) {
          setCheckedInSessions(data.checkedInSessions);
        }

        // ถ้ามี sessions → ตรวจว่าเช็กอินครบทุก session หรือยัง
        const hasSessions = activityData?.sessions && activityData.sessions.length > 0;
        if (hasSessions) {
          const allCheckedIn = activityData?.sessions?.every(
            (s: any) => (data.checkedInSessions || []).includes(s.id)
          );
          // ถ้ายังเช็กอินไม่ครบ → ไม่บล็อก ให้เข้าฟอร์มเช็กอินรอบที่เหลือได้
          setIsDuplicateRegistration(allCheckedIn ?? false);
        } else {
          // ไม่มี sessions → บล็อกซ้ำเหมือนเดิม
          setIsDuplicateRegistration(true);
        }

        // ตรวจสอบว่าเคยส่งแบบประเมินหรือยัง
        const surveyQ = query(
          collection(db, 'surveyResponses'),
          where('activityCode', '==', activityCode),
          where('userId', '==', user.uid),
          limit(1)
        );
        const surveySnap = await getDocs(surveyQ);
        if (!surveySnap.empty) {
          setSurveyCompleted(true);
        }
      } else {
        setHasRegisteredRecord(false);
        setIsDuplicateRegistration(false);
      }
    } catch {
      /* ignore */
    } finally {
      setRegistrationCheckDone(true);
    }
  };

  const checkForSingleUserMode = async () => {
    if (!user?.email || !activityCode) return;
    try {
      const actQ = query(collection(db, 'activityQRCodes'), where('activityCode', '==', activityCode), limit(1));
      const actSnap = await getDocs(actQ);
      if (actSnap.empty) return;
      const act = actSnap.docs[0].data() as any;
      if (!act.singleUserMode) return;

      const regQ = query(collection(db, 'activityRecords'), where('activityCode', '==', activityCode), limit(1));
      const regSnap = await getDocs(regQ);
      if (!regSnap.empty) {
        const existing = regSnap.docs[0].data() as any;
        if (existing.email && existing.email !== user.email) {
          // คนอื่นลงทะเบียนไปแล้ว → บล็อกเสมอ
          setSingleUserBlocked(true);
          const msg = `กิจกรรมนี้อนุญาตให้ลงทะเบียนได้เพียงผู้ใช้เดียว และมีผู้ใช้ ${existing.email} ลงทะเบียนไปแล้ว`;
          setSingleUserMessage(msg);
          setError(msg);
        } else if (existing.email === user.email) {
          // เป็นคนเดียวกัน → ถ้ามี sessions ให้เช็กว่าครบหรือยัง
          const hasSessions = activityData?.sessions && activityData.sessions.length > 0;
          if (hasSessions) {
            const allCheckedIn = activityData?.sessions?.every(
              (s: any) => (existing.checkedInSessions || []).includes(s.id)
            ) ?? false;
            if (allCheckedIn) {
              setSingleUserBlocked(true);
              setSingleUserMessage('คุณได้เช็กอินครบทุกรอบกิจกรรมแล้ว');
              setError('คุณได้เช็กอินครบทุกรอบกิจกรรมแล้ว');
            }
            // ถ้ายังไม่ครบ → ไม่บล็อก
          } else {
            setSingleUserBlocked(true);
            setSingleUserMessage('คุณได้ลงทะเบียนกิจกรรมนี้แล้ว');
            setError('คุณได้ลงทะเบียนกิจกรรมนี้แล้ว');
          }
        }
      }
    } catch {};
  };

  /* ============================= GEOLOCATION ============================= */
  const needsGeoCheck =
    Boolean(activityData) &&
    isAuthed &&
    registrationCheckDone &&
    !isDuplicateRegistration &&
    !singleUserBlocked &&
    !ipBlocked;

  const triggerGeoCheck = useCallback(() => {
    if (!activityData) return;
    if (!isAuthed) return; // ✅ สำคัญ: ซ่อน/หยุด map ก่อน login และกัน state ค้างหลัง logout
    if (isDuplicateRegistration || singleUserBlocked) return; // ลงทะเบียนแล้ว ไม่ขอตำแหน่ง

    if (!('geolocation' in navigator)) {
      setGeoSupported(false);
      setGeoAllowed(false);
      setGeoError('อุปกรณ์ของคุณไม่รองรับการระบุตำแหน่ง');
      setInRadius(false);
      setUserPos(null);
      return;
    }

    const requestId = ++geoRequestIdRef.current;
    setGeoSupported(true);
    setGeoLoading(true);
    setGeoError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (requestId !== geoRequestIdRef.current) return;
        const { latitude, longitude, accuracy } = pos.coords;
        setUserPos({ lat: latitude, lng: longitude, accuracy });

        const d = haversineMeters(latitude, longitude, activityData.latitude, activityData.longitude);
        setDistanceM(Math.round(d));
        setGeoAllowed(true);
        setInRadius(d <= (activityData.checkInRadius || 0));
        setGeoLoading(false);
      },
      (err) => {
        if (requestId !== geoRequestIdRef.current) return;
        setUserPos(null);
        setGeoAllowed(false);
        setGeoLoading(false);
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'กรุณาอนุญาตการเข้าถึงตำแหน่ง (Location) เพื่อยืนยันการอยู่ในพื้นที่กิจกรรม'
            : 'ไม่สามารถตรวจสอบตำแหน่งได้ โปรดลองใหม่';
        setGeoError(msg);
        setInRadius(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [activityData, isAuthed, isDuplicateRegistration, singleUserBlocked]);

  // ขอตำแหน่งเฉพาะเมื่อยังต้องลงทะเบียน/เช็กอิน (ไม่ขอถ้ารายการนี้ลงทะเบียนแล้ว)
  useEffect(() => {
    if (needsGeoCheck) {
      triggerGeoCheck();
    } else {
      geoRequestIdRef.current += 1; // ยกเลิกผล callback ค้าง
      if (isDuplicateRegistration || singleUserBlocked || !isAuthed) {
        resetGeoState();
      }
    }
  }, [
    needsGeoCheck,
    triggerGeoCheck,
    isDuplicateRegistration,
    singleUserBlocked,
    isAuthed,
    resetGeoState,
  ]);

  /* ============================= Session helpers ============================= */
  const validateInitialSession = async () => {
    if (!user?.uid) return;
    setSessionValidating(true);
    try {
      const result = await SessionManager.ensureSession(user.uid, user.email || '');
      if (!result.isValid) {
        await auth.signOut();
        return;
      }
      if (result.remainingTime && result.remainingTime <= 5)
        setSessionWarning(`เซสชันจะหมดอายุในอีก ${result.remainingTime} นาที กรุณาเตรียมตัวเข้าสู่ระบบใหม่`);
      else setSessionWarning('');
    } catch {
    } finally {
      setSessionValidating(false);
    }
  };

  const validateUserSession = async (isInitial = false) => {
    if (!user?.uid) return;
    try {
      const result = await SessionManager.ensureSession(user.uid, user.email || '');
      if (!result.isValid) {
        await auth.signOut();
        return;
      }
      if (result.remainingTime && result.remainingTime <= 5)
        setSessionWarning(`เซสชันจะหมดอายุในอีก ${result.remainingTime} นาที กรุณาเตรียมตัวเข้าสู่ระบบใหม่`);
      else setSessionWarning('');
      if (isInitial && error && !sessionExpired) setError('');
    } catch {}
  };

  /* ============================= Login hooks for MicrosoftAuthSection ============================= */
  const [checkingPreLogin, setCheckingPreLogin] = useState(false);

  const handlePreLoginCheck = async (userEmail: string): Promise<boolean> => {
    setCheckingPreLogin(true);
    try {
      const res = await checkIPRestriction(userEmail);
      if (!res.canLogin) {
        setIpBlocked(true);
        setBlockRemainingTime(res.remainingTime || 60);
        setError(res.message || 'ไม่สามารถเข้าสู่ระบบได้');
        return false;
      }
      setIpBlocked(false);
      setError('');
      return true;
    } finally {
      setCheckingPreLogin(false);
    }
  };

  const handleLoginSuccess = async (userProfile: any) => {
    try {
      const userIP = await getUserIP();
      const now = new Date();
      const q = query(collection(db, 'ipLoginRecords'), where('ipAddress', '==', userIP), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(snap.docs[0].ref, {
          userEmail: userProfile.email,
          loginTime: now,
          expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
        });
      }
      setSessionExpired(false);
      setSessionWarning('');
      setError('');
      if (activityCode && activityData)
        setTimeout(() => {
          checkForDuplicateRegistration();
          checkForSingleUserMode();
        }, 800);
    } catch {}
  };

  const handleLoginError = (msg: string) => setError(msg);

  const handleLogout = async () => {
    try {
      if (user?.uid) await SessionManager.destroySession(user.uid);
      await logout();

      setError('');
      setSuccessMessage('');
      setIpBlocked(false);
      setBlockRemainingTime(0);
      setIsDuplicateRegistration(false);
      setHasRegisteredRecord(false);
      setRegistrationCheckDone(false);
      setNeedsProfileSetup(false);
      setSessionExpired(false);
      setSessionWarning('');
      setSessionValidating(false);
      setSingleUserBlocked(false);
      setSingleUserMessage('');
      setDeadlineCountdown(null);
      setSnack({ open: false, text: '', severity: 'info' });

      geoRequestIdRef.current += 1;
      resetGeoState(); // ✅ สำคัญ: logout แล้ว map + geo หายทันที
      sessionCheckStartedRef.current = false;
    } catch {
      setError('เกิดข้อผิดพลาดในการออกจากระบบ');
    }
  };

  const handleSaveProfile = async (updatedData: Partial<UniversityUserProfile>) => {
    if (!user?.uid) throw new Error('ไม่พบข้อมูลผู้ใช้');
    // อย่าส่ง isActive/isVerified จากฟอร์ม — กัน rules ปฏิเสธตอนอัปเดต
    const { isActive: _a, isVerified: _v, updatedAt: _u, ...safeData } = updatedData as any;
    const payload = {
      ...safeData,
      updatedAt: new Date(),
    };
    await setDoc(doc(db, 'universityUsers', user.uid), payload, { merge: true });
    await setDoc(doc(db, 'users', user.uid), payload, { merge: true });
    // ต้อง refresh ไม่งั้น isProfileComplete ยังอ่านค่าเก่า → ฟอร์มเด้งกลับ
    await refreshUserData();
    setNeedsProfileSetup(false);
    setShowProfileDialog(false);
    setSuccessMessage('บันทึกข้อมูลเรียบร้อยแล้ว');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // เพิ่มตัวนับผู้เข้าร่วม (อัปเดตแบบอะตอมิกจาก Transaction ในระดับเซิร์ฟเวอร์แล้ว และ sync ผ่าน real-time onSnapshot)
  const handleRegistrationSuccess = async () => {
    setHasRegisteredRecord(true);
    const hasSessions = activityData?.sessions && activityData.sessions.length > 0;
    if (!hasSessions) {
      setIsDuplicateRegistration(true);
    } else {
      await checkForDuplicateRegistration();
    }
    setSuccessMessage('ลงทะเบียนกิจกรรมเรียบร้อยแล้ว');
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const statusInfo = activityData ? getActivityStatus(activityData) : null;

  // คำนวณว่าอยู่ในช่วงเวลาทำแบบประเมินหรือไม่
  const surveyWindow = useMemo(() => {
    const cfg = activityData?.surveyConfig as any;
    return getSurveyWindowStatus({
      enabled: cfg?.enabled,
      questionsLength: cfg?.questions?.length ?? 0,
      openAt: cfg?.openAt,
      closeAt: cfg?.closeAt,
      surveyOpenMinutes: cfg?.surveyOpenMinutes,
      forceOpenUntil: cfg?.forceOpenUntil,
      userForceOpenUntil: cfg?.userForceOpenUntil,
      userId: user?.uid,
      endDateTime: activityData?.endDateTime,
      sessions: activityData?.sessions,
    });
  }, [activityData, user?.uid]);

  const isSurveyWindowOpen = surveyWindow.open;

  // ตรวจว่า user มีสิทธิ์ทำแบบประเมินตามเงื่อนไข session eligibility
  const isEligibleForSurvey = useMemo(() => {
    if (!hasRegisteredRecord) return false;
    if (!activityData?.sessions || activityData.sessions.length === 0) {
      return true;
    }
    const cfg = activityData.surveyConfig as any;
    const mode: 'any' | 'all' | 'specific' = cfg?.sessionEligibility ?? 'any';

    if (mode === 'all') {
      return activityData.sessions.every((s: any) => checkedInSessions.includes(s.id));
    }
    if (mode === 'specific') {
      const required: string[] = cfg?.requiredSessionIds ?? [];
      if (required.length === 0) return hasRegisteredRecord;
      return required.every((id: string) => checkedInSessions.includes(id));
    }
    // mode = 'any' → ลงทะเบียนแล้วถือว่ามีสิทธิ์ (แม้ record เก่าไม่มี checkedInSessions)
    return hasRegisteredRecord;
  }, [hasRegisteredRecord, activityData, checkedInSessions]);

  const isSurveyPeriodOpen =
    Boolean(activityData?.surveyConfig?.enabled) &&
    Boolean(activityData?.surveyConfig?.questions?.length) &&
    isSurveyWindowOpen;

  // ช่วงเปิดแบบประเมิน (รวมหลังทำเสร็จแล้ว) — ใช้กันจอ ACTIVITY_ENDED
  const canEnterSurveyFlow = isSurveyPeriodOpen;
  // ยังต้องทำแบบประเมิน
  const needsSurvey = isSurveyPeriodOpen && !surveyCompleted;

    /* ============================= Render ============================= */
  if (loading || authLoading) {
    return <RegisterPageSkeleton />;
  }

  if (ipBlocked) {
    return (
      <>
        <Navbar />
        <FullPageError
          variant="blocked"
          code="IP_RESTRICTED"
          title="การเข้าถึงถูกจำกัดชั่วคราว"
          message={`IP ของคุณถูกจำกัดการใช้งานชั่วคราวเนื่องจากตรวจพบการใช้งานที่ผิดปกติ ระบบจะปลดล็อกโดยอัตโนมัติในอีก ${blockRemainingTime} นาที`}
          actions={[
            { label: 'ตรวจสอบอีกครั้ง', onClick: () => window.location.reload() },
            { label: 'กลับหน้าหลัก', href: '/' },
          ]}
        />
      </>
    );
  }

  if (user && userData && (userData as any).isActive === false) {
    return (
      <>
        <Navbar />
        <FullPageError
          variant="blocked"
          code="ACCOUNT_SUSPENDED"
          title="บัญชีถูกระงับการใช้งาน"
          message="บัญชีของคุณถูกระงับโดยผู้ดูแลระบบ จึงไม่สามารถใช้งานระบบลงทะเบียนได้ หากคิดว่าเป็นความผิดพลาด กรุณาติดต่อผู้ดูแลระบบ"
          actions={[
            { label: 'ออกจากระบบ', onClick: handleLogout },
            { label: 'กลับหน้าหลัก', href: '/', kind: 'ghost' },
          ]}
        />
      </>
    );
  }

  if (
    singleUserBlocked &&
    user &&
    !sessionExpired &&
    !(canEnterSurveyFlow && (isEligibleForSurvey || !hasRegisteredRecord))
  ) {
    const isAllCheckedIn = singleUserMessage.includes('ครบ');
    return (
      <>
        <Navbar />
        <FullPageError
          variant="locked"
          code={isAllCheckedIn ? 'ALL_CHECKED_IN' : 'SINGLE_USER_MODE'}
          title={isAllCheckedIn ? 'คุณเช็กอินครบทุกรอบแล้ว' : 'ไม่สามารถลงทะเบียนได้'}
          message={singleUserMessage}
          actions={[
            { label: 'ออกจากระบบ', onClick: handleLogout },
            { label: 'ปิดหน้าต่าง', onClick: () => window.close(), kind: 'ghost' },
          ]}
        />
      </>
    );
  }

  if (
    error &&
    !isDuplicateRegistration &&
    !successMessage &&
    !sessionExpired &&
    !sessionWarning &&
    !singleUserBlocked
  ) {
    let variant: FullPageErrorVariant = 'warning';
    let code = 'UNEXPECTED_ERROR';
    let title = 'เกิดข้อผิดพลาด';

    if (error.includes('ปิดใช้งานชั่วคราว')) {
      variant = 'maintenance';
      code = 'SYSTEM_DISABLED';
      title = 'ระบบปิดปรับปรุงชั่วคราว';
    } else if (error.includes('ปิด') || error.includes('สิทธิ์')) {
      variant = 'locked';
      code = 'ACCESS_DENIED';
      title = 'ไม่สามารถเข้าใช้งานได้';
    } else if (error.includes('หมดอายุ') || error.includes('จุดลงทะเบียน') || qrExpireMeta) {
      variant = 'expired';
      code = 'QR_EXPIRED';
      title = qrExpireMeta
        ? dynamicQrExpiredTitle(qrExpireMeta)
        : 'QR Code หมดอายุแล้ว';
    } else if (error.includes('ไม่พบ')) {
      variant = 'notfound';
      code = 'NOT_FOUND';
      title = 'ไม่พบกิจกรรมที่ค้นหา';
    }

    return (
      <>
        <Navbar />
        <FullPageError
          variant={variant}
          code={code}
          title={title}
          message={error}
          actions={[
            { label: 'ลองใหม่อีกครั้ง', onClick: loadInitialData },
            { label: 'กลับหน้าหลัก', href: '/', kind: 'ghost' },
          ]}
        />
      </>
    );
  }

  if (activityData && statusInfo?.status === 'ended' && !successMessage && !canEnterSurveyFlow) {
    const endedAt = statusInfo.endTime ? formatDateTime(statusInfo.endTime) : null;
    const surveyExpiredForUser =
      Boolean(activityData.surveyConfig?.enabled) &&
      surveyWindow.expired &&
      hasRegisteredRecord &&
      !surveyCompleted;

    return (
      <>
        <Navbar />
        <FullPageError
          variant="expired"
          code={surveyExpiredForUser ? 'SURVEY_EXPIRED' : 'ACTIVITY_ENDED'}
          title={surveyExpiredForUser ? 'หมดเวลาทำแบบประเมินแล้ว' : 'กิจกรรมสิ้นสุดแล้ว'}
          message={
            surveyExpiredForUser
              ? `แบบประเมินของ "${activityData.activityName}" ปิดรับไปแล้ว${
                  surveyWindow.closeTime
                    ? ` (ปิดเมื่อ ${formatDateTime(surveyWindow.closeTime)})`
                    : ''
                } — หากต้องการทำต่อ กรุณาติดต่อผู้ดูแลเพื่อเปิดสิทธิ์รายบุคคล`
              : endedAt
                ? `"${activityData.activityName}" สิ้นสุดไปแล้วเมื่อวันที่ ${endedAt} น. ขอบคุณที่ให้ความสนใจ`
                : `"${activityData.activityName}" สิ้นสุดไปแล้ว ขอบคุณที่ให้ความสนใจ`
          }
          actions={[
            { label: 'ดูกิจกรรมอื่น', href: '/' },
            ...(user
              ? [{ label: 'ประวัติของฉัน', href: '/my-history', kind: 'ghost' as const }]
              : []),
          ]}
        />
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div className={cn(pageLayoutClass, 'flex-1')}>
        <div className="mx-auto w-full max-w-3xl flex-1 px-4 pb-8 pt-4 md:pt-6">
          {deadlineCountdown && (
            <Alert variant="warning" className="mb-4 rounded-xl">
              <AlertDescription>
                จะปิดการลงทะเบียนในอีก <b>{deadlineCountdown}</b>
              </AlertDescription>
            </Alert>
          )}

          {activityData && statusInfo && !ipBlocked && !singleUserBlocked && (
            <ModernActivityBanner activity={activityData} status={statusInfo} adminSettings={adminSettings} />
          )}

          {successMessage && <SuccessAlert message={successMessage} onClose={() => setSuccessMessage('')} />}

          {needsSurvey && activityData && (
            <div className="mb-6">
              {!user && (
                <Alert variant="info" className="mb-4 rounded-xl">
                  <AlertDescription>
                    กรุณาเข้าสู่ระบบด้วยบัญชีมหาวิทยาลัยเพื่อทำแบบประเมินหลังกิจกรรม
                  </AlertDescription>
                </Alert>
              )}
              {user && !hasRegisteredRecord && (
                <Alert variant="warning" className="mb-4 rounded-xl">
                  <AlertDescription>
                    ไม่พบประวัติการลงทะเบียนกิจกรรมนี้ในบัญชีของคุณ จึงยังไม่สามารถทำแบบประเมินได้
                  </AlertDescription>
                </Alert>
              )}
              {user && hasRegisteredRecord && !isEligibleForSurvey && (
                <Alert variant="warning" className="mb-4 rounded-xl">
                  <AlertDescription>
                    คุณยังไม่ผ่านเงื่อนไขการทำแบบประเมิน (เช่น ต้องเช็กอินครบตามที่ผู้ดูแลกำหนด)
                  </AlertDescription>
                </Alert>
              )}
              {(!user || sessionExpired) && !ipBlocked && (
                <div className="mb-4">
                  <MicrosoftAuthSection
                    activityData={activityData}
                    onLoginSuccess={handleLoginSuccess}
                    onLoginError={handleLoginError}
                    onPreLoginCheck={handlePreLoginCheck}
                    checkingIP={checkingPreLogin}
                  />
                </div>
              )}
              {user && isEligibleForSurvey && (
                <SurveyForm
                  activityCode={activityCode}
                  activityDocId={activityData.id}
                  surveyConfig={(activityData as any).surveyConfig}
                  userId={user.uid}
                  onCompleted={() => {
                    setSurveyCompleted(true);
                    setSuccessMessage('ขอบคุณที่ทำแบบประเมิน!');
                  }}
                />
              )}
              {(surveyWindow.openTime || surveyWindow.closeTime) && (
                <p className="mt-2 block text-xs text-muted-foreground">
                  {surveyWindow.openTime && surveyWindow.closeTime
                    ? `ช่วงทำแบบประเมิน: ${formatDateTime(surveyWindow.openTime)} – ${formatDateTime(surveyWindow.closeTime)} น.`
                    : surveyWindow.closeTime
                      ? `เปิดทำแบบประเมินถึง ${formatDateTime(surveyWindow.closeTime)} น.`
                      : `เปิดทำแบบประเมินตั้งแต่ ${formatDateTime(surveyWindow.openTime)} น.`}
                </p>
              )}
            </div>
          )}

          {isSurveyPeriodOpen && surveyCompleted && (
            <Alert variant="success" className="mb-4 rounded-xl">
              <AlertDescription>ขอบคุณที่ทำแบบประเมิน! ข้อมูลของคุณถูกบันทึกเรียบร้อยแล้ว</AlertDescription>
            </Alert>
          )}

          {singleUserBlocked && user && !sessionExpired && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>ไม่สามารถลงทะเบียนได้</AlertTitle>
              <AlertDescription>
                <p className="text-muted-foreground">{singleUserMessage}</p>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleLogout}>
                    ออกจากระบบ
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.close()}>
                    ปิดหน้าต่าง
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {isDuplicateRegistration &&
            user &&
            !sessionExpired &&
            !singleUserBlocked &&
            !needsSurvey && <DuplicateRegistrationAlert />}

          {activityData && !isDuplicateRegistration && hasRegisteredRecord && !singleUserBlocked && !sessionExpired && (() => {
            const now = new Date();
            const activeSession = activityData.sessions?.find((s: any) => {
              const sStart = s.startDateTime?.toDate?.() || new Date(s.startDateTime);
              const sEnd = s.endDateTime?.toDate?.() || new Date(s.endDateTime);
              return now >= sStart && now <= sEnd;
            });
            const isActiveCheckedIn = activeSession && checkedInSessions.includes(activeSession.id);

            if (isActiveCheckedIn) {
              const sorted = [...(activityData.sessions ?? [])].sort((a, b) => {
                const aTime = a.startDateTime?.toDate?.()?.getTime() || new Date(a.startDateTime).getTime();
                const bTime = b.startDateTime?.toDate?.()?.getTime() || new Date(b.startDateTime).getTime();
                return aTime - bTime;
              });
              const nextSession = sorted.find((s: any) => {
                const sStart = s.startDateTime?.toDate?.() || new Date(s.startDateTime);
                return now < sStart;
              });

              if (nextSession) {
                const nStart = nextSession.startDateTime?.toDate?.() || new Date(nextSession.startDateTime);
                return (
                  <Alert
                    variant="info"
                    className="mb-6 rounded-xl border border-sky-600"
                    style={{ background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)' }}
                  >
                    <AlertTitle className="font-bold text-sky-900">เช็กอินรอบปัจจุบันเรียบร้อยแล้ว</AlertTitle>
                    <AlertDescription className="text-foreground">
                      รอบถัดไป: <b>{nextSession.name}</b> จะเปิดให้เช็กอินในวันที่{' '}
                      {nStart.toLocaleString('th-TH', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      น.
                    </AlertDescription>
                  </Alert>
                );
              }
            }
            return null;
          })()}

          {activityData &&
            statusInfo &&
            statusInfo.status !== 'active' &&
            !ipBlocked &&
            !singleUserBlocked &&
            !needsSurvey && (
            <ActivityStatusAlert
              status={statusInfo.status}
              message={statusInfo.message}
              startTime={statusInfo.startTime}
              endTime={statusInfo.endTime}
            />
          )}

          {activityData &&
            statusInfo?.status === 'active' &&
            isAuthed &&
            registrationCheckDone &&
            !ipBlocked &&
            !isDuplicateRegistration &&
            !singleUserBlocked && (
              <>
                <div className="mb-4">
                  <GeofenceMap
                    center={{ lat: activityData.latitude, lng: activityData.longitude }}
                    radius={activityData.checkInRadius}
                    userPos={userPos}
                    inRadius={inRadius}
                    onUseCurrentLocation={triggerGeoCheck}
                    title={activityData.activityName}
                  />
                </div>

                <Card className={cn(glassCardClass, 'mb-4 border-0 shadow-none')}>
                  <CardContent className="p-4 sm:p-6">
                    <div className="mb-4 flex items-center gap-3">
                      <SectionIcon icon={<GpsFixedIcon />} color={pageColors.accentInfo} />
                      <div>
                        <h3 className="text-lg font-extrabold leading-tight">สถานะตำแหน่ง</h3>
                        <p className="text-xs text-muted-foreground">ต้องอยู่ในรัศมีที่กำหนดจึงลงทะเบียนได้</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                      <div className="md:col-span-7">
                        <DetailSection
                          icon={<MyLocationIcon />}
                          title={
                            geoLoading
                              ? 'กำลังตรวจสอบ...'
                              : !geoSupported
                                ? 'ไม่รองรับ GPS'
                                : geoError
                                  ? 'ตรวจสอบตำแหน่งไม่สำเร็จ'
                                  : inRadius
                                    ? 'อยู่ในพื้นที่'
                                    : 'อยู่นอกพื้นที่'
                          }
                          hint={
                            typeof distanceM === 'number' && !geoLoading && !geoError
                              ? `ห่างจากจุดเช็กอินประมาณ ${distanceM} เมตร`
                              : undefined
                          }
                          color={
                            geoLoading
                              ? pageColors.accentInfo
                              : !geoSupported || geoError
                                ? pageColors.accentWarning
                                : inRadius
                                  ? pageColors.appleGreen
                                  : pageColors.accentError
                          }
                        >
                          {!geoLoading && !geoSupported && (
                            <Alert variant="destructive" className="rounded-lg">
                              <AlertDescription>อุปกรณ์ของคุณไม่รองรับการระบุตำแหน่ง</AlertDescription>
                            </Alert>
                          )}
                          {!geoLoading && geoSupported && geoError && (
                            <Alert variant="warning" className="rounded-lg">
                              <AlertDescription>{geoError}</AlertDescription>
                            </Alert>
                          )}
                          {!geoLoading && geoSupported && !geoError && (
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={inRadius ? 'success' : 'destructive'} className="gap-1 font-bold">
                                {inRadius ? <CheckIcon className="h-3.5 w-3.5" /> : <ErrorIcon className="h-3.5 w-3.5" />}
                                {inRadius ? 'พร้อมลงทะเบียน' : 'ยังไม่พร้อม'}
                              </Badge>
                              <Badge variant="outline" className="gap-1 font-semibold">
                                <RadarIcon className="h-3.5 w-3.5" />
                                รัศมี {activityData.checkInRadius} ม.
                              </Badge>
                            </div>
                          )}
                        </DetailSection>
                      </div>
                      <div className="flex flex-col justify-center gap-3 md:col-span-5">
                        <Button
                          className="rounded-xl py-3 font-bold"
                          onClick={triggerGeoCheck}
                          disabled={geoLoading}
                        >
                          {geoLoading ? <Spinner size="sm" className="text-primary-foreground" /> : <RefreshIcon className="h-4 w-4" />}
                          {geoLoading ? 'กำลังตรวจ...' : 'ตรวจตำแหน่งอีกครั้ง'}
                        </Button>
                        <p className="text-xs text-muted-foreground md:text-center">
                          เปิด GPS และอนุญาตสิทธิ์ตำแหน่งบนอุปกรณ์
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

          {activityData && !ipBlocked && !singleUserBlocked && !needsSurvey && (
            <Card className={cn(glassCardClass, 'mb-4 border-0 shadow-none')}>
              <CardContent className="p-4 sm:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <SectionIcon icon={<ArticleIcon />} color={pageColors.accentInfo} />
                  <div>
                    <h3 className="text-lg font-extrabold leading-tight">รายละเอียดกิจกรรม</h3>
                    <p className="text-xs text-muted-foreground">ข้อมูลสำคัญก่อนลงทะเบียน</p>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <DetailSection icon={<EventStartIcon />} title="วันเวลาเริ่ม" color={pageColors.appleGreen}>
                      <p className="text-sm font-semibold">{formatDateTime(activityData.startDateTime)}</p>
                    </DetailSection>
                    <DetailSection icon={<EventEndIcon />} title="วันเวลาสิ้นสุด" color={pageColors.accentError}>
                      <p className="text-sm font-semibold">{formatDateTime(activityData.endDateTime)}</p>
                    </DetailSection>
                  </div>

                  {activityData.location && (
                    <DetailSection icon={<PlaceIcon />} title="สถานที่" color={pageColors.accentWarning}>
                      <p className="text-sm font-semibold">{activityData.location}</p>
                      {typeof activityData.checkInRadius === 'number' && activityData.checkInRadius > 0 && (
                        <Badge variant="outline" className="mt-2 gap-1 font-semibold">
                          <RadarIcon className="h-3.5 w-3.5" />
                          รัศมีเช็กอิน {activityData.checkInRadius} เมตร
                        </Badge>
                      )}
                    </DetailSection>
                  )}

                  {activityData.maxParticipants > 0 && (
                    <DetailSection icon={<GroupsIcon />} title="จำนวนผู้สมัคร" color={pageColors.accentInfo}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold">
                          {activityData.currentParticipants}/{activityData.maxParticipants} คน
                        </p>
                        <Badge
                          variant={
                            activityData.currentParticipants >= activityData.maxParticipants
                              ? 'warning'
                              : 'success'
                          }
                          className="font-bold"
                        >
                          {activityData.currentParticipants >= activityData.maxParticipants
                            ? 'เต็มแล้ว'
                            : `เหลืออีก ${Math.max(0, activityData.maxParticipants - activityData.currentParticipants)} ที่นั่ง`}
                        </Badge>
                      </div>
                    </DetailSection>
                  )}

                  <DetailSection icon={<ArticleIcon />} title="คำอธิบาย" color="#636366">
                    {activityData.description ? (
                      <div
                        className="ql-editor min-h-0 p-0 text-sm text-muted-foreground [&_img]:max-w-full [&_img]:rounded-lg"
                        dangerouslySetInnerHTML={{ __html: activityData.description }}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">ไม่มีคำอธิบายเพิ่มเติม</p>
                    )}
                  </DetailSection>

                  {activityData.sessions && activityData.sessions.length > 0 && (
                    <DetailSection
                      icon={<SessionsIcon />}
                      title={`รอบกิจกรรมย่อย (${activityData.sessions.length} รอบ)`}
                      hint="กรุณาเช็กอินให้ครบตามรอบที่กำหนด"
                      color={pageColors.accentWarning}
                    >
                      <Alert variant="info" className="mb-3 rounded-lg py-2">
                        <AlertDescription>
                          แต่ละรอบมีช่วงเวลาของตัวเอง — เปิดหน้านี้ใหม่เมื่อถึงเวลารอบถัดไป
                        </AlertDescription>
                      </Alert>
                      <div className="flex flex-col gap-2">
                        {activityData.sessions.map((session: any, index: number) => {
                          const isCheckedIn = checkedInSessions.includes(session.id);
                          return (
                            <SessionCard
                              key={session.id || index}
                              session={session}
                              isCheckedIn={isCheckedIn}
                            />
                          );
                        })}
                      </div>
                    </DetailSection>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {shouldShowMicrosoftLogin() && activityData && !needsSurvey && (
            <MicrosoftAuthSection
              activityData={activityData}
              onLoginSuccess={handleLoginSuccess}
              onLoginError={handleLoginError}
              onPreLoginCheck={handlePreLoginCheck}
              checkingIP={checkingPreLogin}
            />
          )}

          {user &&
            needsProfileSetup &&
            !ipBlocked &&
            !isDuplicateRegistration &&
            !sessionExpired &&
            !sessionValidating &&
            !singleUserBlocked && <ProfileSetupAlert onEditProfile={() => setShowProfileDialog(true)} />}

          {statusInfo?.status === 'active' && adminSettings && activityCode && canProceedToRegistration() && activityData && (
            <ActivityRegistrationForm
              activityCode={activityCode}
              activityDocId={activityData.id}
              adminSettings={adminSettings}
              checkedInSessions={checkedInSessions}
              existingAuthStatus={isAuthed}
              existingUserProfile={
                user
                  ? ({
                      id: user.uid,
                      email: user.email || '',
                      displayName: user.displayName || '',
                      givenName: userData?.firstName || '',
                      surname: userData?.lastName || '',
                      nameTitle: userData?.nameTitle || '',
                      department: userData?.department || '',
                      faculty: userData?.faculty || '',
                      studentId: userData?.studentId || '',
                      userType: userData?.userType,
                      institutionName: userData?.institutionName,
                      educationLevel: userData?.educationLevel || userData?.degreeLevel,
                    } satisfies ActivityUserProfile)
                  : undefined
              }
              onSuccess={handleRegistrationSuccess}
              onLogout={handleLogout}
              surveyConfig={(activityData as any).surveyConfig}
              sessions={activityData.sessions}
            />
          )}

          <ProfileEditDialog
            open={showProfileDialog}
            onClose={() => {
              if (needsProfileSetup) return;
              setShowProfileDialog(false);
            }}
            user={user}
            userData={userData}
            onSave={handleSaveProfile}
            isFirstTimeSetup={needsProfileSetup}
          />

          {snack.open && (
            <div className="fixed left-1/2 top-4 z-50 w-[min(100%-2rem,28rem)] -translate-x-1/2">
              <Alert
                variant={
                  snack.severity === 'success'
                    ? 'success'
                    : snack.severity === 'warning'
                      ? 'warning'
                      : 'info'
                }
                className="shadow-lg"
              >
                <AlertDescription className="flex items-center justify-between gap-2">
                  <span>{snack.text}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 px-2"
                    onClick={() => setSnack((s) => ({ ...s, open: false }))}
                  >
                    ปิด
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
        <Footer />
      </div>
    </>
  );
};

/* ============================= Loading Skeleton ============================= */
const RegisterPageSkeleton: React.FC = () => (
  <>
    <Navbar />
    <div className={cn(pageLayoutClass, 'flex-1')}>
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 pb-8 pt-4 md:pt-6">
        <Skeleton className="mb-6 h-40 w-full rounded-3xl md:h-[220px]" />
        <Card className={cn(glassCardClass, 'mb-4 border-0 shadow-none')}>
          <CardContent className="pt-6">
            <Skeleton className="mb-4 h-7 w-[45%] rounded-lg" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Skeleton className="mb-1 h-4 w-[35%] rounded-md" />
                <Skeleton className="h-5 w-[70%] rounded-md" />
              </div>
              <div>
                <Skeleton className="mb-1 h-4 w-[35%] rounded-md" />
                <Skeleton className="h-5 w-[70%] rounded-md" />
              </div>
              <div className="md:col-span-2">
                <Skeleton className="mb-1 h-4 w-[25%] rounded-md" />
                <Skeleton className="mb-1 h-5 w-full rounded-md" />
                <Skeleton className="mb-1 h-5 w-[85%] rounded-md" />
                <Skeleton className="h-5 w-[60%] rounded-md" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn(glassCardClass, 'border-0 shadow-none')}>
          <CardContent className="pt-6">
            <Skeleton className="mb-4 h-7 w-[35%] rounded-lg" />
            <Skeleton className="mb-3 h-13 w-full rounded-[14px]" />
            <Skeleton className="h-13 w-full rounded-[14px]" />
          </CardContent>
        </Card>
      </div>
    </div>
  </>
);

/* ============================= Page Wrapper with Suspense ============================= */
const RegisterPage: React.FC = () => {
  return (
    <div className={pageLayoutClass}>
      <Suspense fallback={<RegisterPageSkeleton />}>
        <RegisterPageContent />
      </Suspense>
    </div>
  );
};

export default RegisterPage;
