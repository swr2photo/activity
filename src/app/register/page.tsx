'use client';
import React, { useEffect, useMemo, useState, Suspense, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Grid,
  Skeleton,
  Stack,
  Typography,
  Snackbar,
  Alert as MuiAlert,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  GpsFixed as GpsFixedIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Lock as LockIcon,
  Info as InfoIcon,
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

// Components
import NavigationBar, { NavNotice } from '../../components/navigation/NavigationBar';
import MicrosoftAuthSection from '../../components/auth/MicrosoftAuthSection';
import {
  DuplicateRegistrationAlert,
  ProfileSetupAlert,
  SuccessAlert,
  ActivityStatusAlert,
} from '../../components/alerts/StatusAlerts';
import ProfileEditDialog from '../../components/profile/ProfileEditDialog';
import ActivityRegistrationForm from '../../components/ActivityRegistrationForm';
import GeofenceMap from '../../components/maps/GeofenceMap';
import Footer from '../../components/Footer';
import SurveyForm from '../../components/activity/SurveyForm';
import FullPageError, { FullPageErrorVariant } from '../../components/common/FullPageError';
import { glassCardSx, pageColors, pageLayoutSx } from '../../lib/uiTheme';
import Image from 'next/image';
import 'quill/dist/quill.snow.css';

// Firebase helpers
import { db, auth } from '../../lib/firebase';
import { useAuth, UniversityUserProfile } from '../../lib/firebaseAuth';
import { SessionManager } from '../../lib/sessionManager';
import { AdminSettings } from '../../types';

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
    const now = new Date();
    const q = query(collection(db, 'ipLoginRecords'), where('ipAddress', '==', userIP), limit(1));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const rec = snapshot.docs[0].data() as IPLoginRecord;
      const expiresAt = rec.expiresAt?.toDate?.() ?? new Date(rec.expiresAt);
      if (now < expiresAt) {
        if (rec.userEmail === userEmail) return { canLogin: true };
        const min = Math.ceil((expiresAt.getTime() - now.getTime()) / 60000);
        return {
          canLogin: false,
          message: `IP นี้เพิ่งมีการเข้าสู่ระบบด้วยบัญชีอื่น กรุณารออีก ${min} นาที`,
          remainingTime: min,
        };
      }
      await updateDoc(snapshot.docs[0].ref, {
        userEmail,
        loginTime: now,
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      });
      return { canLogin: true };
    }
    await addDoc(collection(db, 'ipLoginRecords'), {
      ipAddress: userIP,
      userEmail,
      loginTime: now,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
    });
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

/* ============================= Modern Activity Banner ============================= */
const ModernActivityBanner: React.FC<{
  activity: ActivityData;
  status: ActivityStatusInfo;
  adminSettings: AdminSettings | null;
}> = ({ activity, status, adminSettings }) => {
  const tintColor =
    activity.bannerTintColor || (adminSettings as any)?.branding?.primaryColor || '#1c1c1e';

  const hasImage = !!activity.bannerUrl;

  const statusColor: 'default' | 'success' | 'warning' | 'error' | 'info' =
    status.status === 'active'
      ? 'success'
      : status.status === 'upcoming'
      ? 'info'
      : status.status === 'full'
      ? 'warning'
      : status.status === 'ended' || status.status === 'inactive'
      ? 'default'
      : 'default';

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

  const statusChipSx = {
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    fontWeight: 600,
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.2)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    ...(status.status === 'active'
      ? { bgcolor: 'rgba(52, 199, 89, 0.3)', color: '#fff' }
      : status.status === 'upcoming'
      ? { bgcolor: 'rgba(0, 122, 255, 0.3)', color: '#fff' }
      : status.status === 'full'
      ? { bgcolor: 'rgba(255, 149, 0, 0.3)', color: '#fff' }
      : { bgcolor: 'rgba(0, 0, 0, 0.4)', color: '#fff' }),
  };

  return (
    <Card elevation={0} sx={{ ...glassCardSx, mb: 3, overflow: 'hidden', p: 0 }}>
      <Box
        sx={{
          position: 'relative',
          height: { xs: 180, md: 220 },
          bgcolor: activity.bannerColor || tintColor || '#1c1c1e',
          overflow: 'hidden',
        }}
      >
        {hasImage && (
          <>
            <Box
              sx={{
                position: 'absolute',
                width: '100%',
                height: '100%',
              }}
            >
              <Image
                src={activity.bannerUrl!}
                alt={activity.activityName}
                fill
                sizes="100vw"
                style={{ objectFit: activity.bannerAspect === 'contain' ? 'contain' : 'cover' }}
                priority
              />
            </Box>
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(180deg, transparent 40%, ${alpha('#000', 0.55)} 100%)`,
              }}
            />
          </>
        )}
        <Box sx={{ position: 'absolute', top: 12, left: 12 }}>
          <Chip
            label={statusLabel}
            color={statusColor}
            size="small"
            sx={statusChipSx}
          />
        </Box>
      </Box>

      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Typography
          variant="h5"
          fontWeight={800}
          sx={{ color: pageColors.textPrimary, letterSpacing: '-0.02em', mb: 0.5 }}
        >
          {activity.activityName}
        </Typography>
        <Typography variant="body2" sx={{ color: pageColors.textSecondary, mb: 2 }}>
          {activity.location}
        </Typography>
        <Divider sx={{ mb: 2, opacity: 0.5 }} />
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="overline" sx={{ color: pageColors.textSecondary, fontWeight: 600 }}>
              ช่วงเวลา
            </Typography>
            <Typography variant="body2" sx={{ color: pageColors.textPrimary, fontWeight: 500 }}>
              {formatDateTime(activity.startDateTime)} — {formatDateTime(activity.endDateTime)}
            </Typography>
          </Grid>
          {activity.maxParticipants > 0 && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="overline" sx={{ color: pageColors.textSecondary, fontWeight: 600 }}>
                ผู้สมัคร
              </Typography>
              <Typography variant="body2" sx={{ color: pageColors.textPrimary, fontWeight: 500 }}>
                {activity.currentParticipants}/{activity.maxParticipants} คน
              </Typography>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
};

const SessionCard: React.FC<{ session: any; isCheckedIn: boolean }> = ({ session, isCheckedIn }) => {
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);

  const sStart = useMemo(() => session.startDateTime?.toDate?.() || new Date(session.startDateTime), [session.startDateTime]);
  const sEnd = useMemo(() => session.endDateTime?.toDate?.() || new Date(session.endDateTime), [session.endDateTime]);
  
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

  const getStatusDisplay = () => {
    if (isCheckedIn) return { label: 'เช็คอินแล้ว', color: 'success' as const, variant: 'filled' as const, icon: <CheckIcon fontSize="small" /> };
    if (isActive) return { label: 'กำลังเปิด', color: 'primary' as const, variant: 'filled' as const };
    if (isUpcoming) return { label: '', color: 'info' as const, variant: 'outlined' as const, icon: <LockIcon fontSize="small" color="action" /> };
    return { label: 'สิ้นสุดแล้ว', color: 'default' as const, variant: 'outlined' as const, icon: <LockIcon fontSize="small" /> };
  };

  const status = getStatusDisplay();

  return (
    <Card variant="outlined" sx={{ 
      bgcolor: isCheckedIn ? 'success.50' : isActive ? 'primary.50' : 'action.hover',
      borderColor: isCheckedIn ? 'success.main' : isActive ? 'primary.main' : 'divider',
      opacity: (isActive || isCheckedIn || isUpcoming) ? 1 : 0.65,
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Loading animation for upcoming session */}
      {isUpcoming && timeLeft && (
        <Box sx={{ position: 'absolute', bottom: 0, left: 0, height: 3, bgcolor: 'info.main', width: '100%', opacity: 0.3 }}>
          <Box sx={{ 
            height: '100%', bgcolor: 'info.main', width: '30%',
            animation: 'slide 2s infinite ease-in-out',
            '@keyframes slide': {
              '0%': { transform: 'translateX(-100%)' },
              '100%': { transform: 'translateX(400%)' }
            }
          }} />
        </Box>
      )}
      
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
          <Box>
            <Typography variant="body2" fontWeight="bold" color={isCheckedIn ? 'success.main' : isActive ? 'primary.main' : 'text.primary'} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {!isActive && !isCheckedIn && <LockIcon fontSize="small" color="inherit" />}
              {session.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDateTime(sStart)} - {formatDateTime(sEnd)}
            </Typography>
            
            {isUpcoming && timeLeft && (
              <Typography variant="caption" color="info.main" sx={{ display: 'block', mt: 0.5, fontWeight: 500 }}>
                เปิดให้เช็คอินในอีก {timeLeft.d > 0 ? `${timeLeft.d} วัน ` : ''}{timeLeft.h > 0 ? `${timeLeft.h} ชม. ` : ''}{timeLeft.m} นาที {timeLeft.s} วินาที
              </Typography>
            )}
          </Box>
          {status.label ? (
            <Chip 
              size="small" 
              label={status.label}
              color={status.color}
              variant={status.variant}
              icon={status.icon}
              sx={{ fontWeight: 600 }}
            />
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 0.5 }}>
              {status.icon}
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

/* ============================= Main content ============================= */
const RegisterPageContent: React.FC = () => {
  const searchParams = useSearchParams();
  const activityCodeRaw = searchParams.get('activity') || '';
  const activityCode = useMemo(() => activityCodeRaw.trim().toUpperCase(), [activityCodeRaw]);

  const { user, userData, loading: authLoading, logout } = useAuth();

  // States
  const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(null);
  const [activityData, setActivityData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  // Notices for NavigationBar
  const [navNotices, setNavNotices] = useState<NavNotice[]>([]);
  const [urgentNotices, setUrgentNotices] = useState<NavNotice[]>([]);

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
    if (user && activityCode && activityData && !sessionExpired && !sessionValidating) {
      checkForDuplicateRegistration();
      checkForSingleUserMode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activityCode, activityData, sessionExpired, sessionValidating]);

  useEffect(() => {
    if (user && userData !== null && !sessionExpired && !sessionValidating) {
      const needsSetup = !userData?.firstName || !userData?.lastName;
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
          setNavNotices((prevNotices) => [
            ...prevNotices,
            {
              key: `live-${Date.now()}`,
              severity: nowActive ? 'success' : 'warning',
              message: nowActive
                ? 'ผู้ดูแลได้เปิดกิจกรรมแล้ว — เริ่มลงทะเบียนได้'
                : `ผู้ดูแลได้ปิดกิจกรรมแล้ว${updated.closeReason ? ' — ' + updated.closeReason : ''}`,
              autoHideMs: 4000,
            },
          ]);
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

  // countdown ≤ 5 นาที (urgent)
  useEffect(() => {
    if (!activityData?.endDateTime) return;
    let t: any;
    const tick = () => {
      const end: Date = activityData.endDateTime?.toDate?.() || new Date(activityData.endDateTime);
      const now = new Date();
      const sec = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
      if (sec <= 300 && sec > 0) {
        const m = Math.floor(sec / 60).toString().padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        setUrgentNotices([
          {
            key: 'deadline-countdown',
            severity: 'warning',
            message: (
              <>
                จะปิดการลงทะเบียนในอีก <b>{m}:{s}</b>
              </>
            ),
            autoHideMs: 1000,
          },
        ]);
      } else {
        setUrgentNotices([]);
      }
      t = setTimeout(tick, 1000);
    };
    tick();
    return () => t && clearTimeout(t);
  }, [activityData?.endDateTime]);

  /* ============================= Helpers & Actions ============================= */
  const canProceedToRegistration = () => {
    if (!activityData) return false;
    if (!user) return false;
    if (sessionExpired) return false;
    if (sessionValidating) return false;
    if (ipBlocked) return false;
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
        } as ActivityData;

        setActivityData(activity);
        
        // Dynamic QR Validation
        if (activity.dynamicQREnabled) {
          const dt = searchParams.get('dt');
          if (!dt || (dt !== activity.dynamicToken && dt !== activity.previousDynamicToken)) {
            setError('QR Code หมดอายุ หรือไม่ถูกต้อง กรุณาสแกนใหม่จากหน้าจอจุดลงทะเบียน');
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
    if (!user?.uid || !activityCode) return;
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
      }
    } catch {}
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
  const triggerGeoCheck = useCallback(() => {
    if (!activityData) return;
    if (!isAuthed) return; // ✅ สำคัญ: ซ่อน/หยุด map ก่อน login และกัน state ค้างหลัง logout

    if (!('geolocation' in navigator)) {
      setGeoSupported(false);
      setGeoAllowed(false);
      setGeoError('อุปกรณ์ของคุณไม่รองรับการระบุตำแหน่ง');
      setInRadius(false);
      setUserPos(null);
      return;
    }

    setGeoSupported(true);
    setGeoLoading(true);
    setGeoError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setUserPos({ lat: latitude, lng: longitude, accuracy });

        const d = haversineMeters(latitude, longitude, activityData.latitude, activityData.longitude);
        setDistanceM(Math.round(d));
        setGeoAllowed(true);
        setInRadius(d <= (activityData.checkInRadius || 0));
        setGeoLoading(false);
      },
      (err) => {
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
  }, [activityData, isAuthed]);

  // ✅ เมื่อ activity พร้อมและล็อกอินแล้ว ค่อยตรวจตำแหน่ง (เพื่อให้ map โผล่หลัง login)
  useEffect(() => {
    if (activityData && isAuthed) triggerGeoCheck();
  }, [activityData, isAuthed, triggerGeoCheck]);

  /* ============================= Session helpers ============================= */
  const validateInitialSession = async () => {
    if (!user?.uid) return;
    setSessionValidating(true);
    try {
      const result = await SessionManager.validateSession(user.uid);
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
      const result = await SessionManager.validateSession(user.uid);
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
      setNeedsProfileSetup(false);
      setSessionExpired(false);
      setSessionWarning('');
      setSessionValidating(false);
      setSingleUserBlocked(false);
      setSingleUserMessage('');
      setNavNotices([]);
      setUrgentNotices([]);
      setSnack({ open: false, text: '', severity: 'info' });

      resetGeoState(); // ✅ สำคัญ: logout แล้ว map + geo หายทันที
      sessionCheckStartedRef.current = false;
    } catch {
      setError('เกิดข้อผิดพลาดในการออกจากระบบ');
    }
  };

  const handleSaveProfile = async (updatedData: Partial<UniversityUserProfile>) => {
    if (!user?.uid) throw new Error('ไม่พบข้อมูลผู้ใช้');
    // Save to universityUsers (which useAuth/getUserProfile reads from)
    await setDoc(doc(db, 'universityUsers', user.uid), { ...updatedData, updatedAt: new Date() }, { merge: true });
    // Also save to users for backward compatibility
    await setDoc(doc(db, 'users', user.uid), { ...updatedData, updatedAt: new Date() }, { merge: true });
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

  /* ============================= รวม notices ไปแสดงบน NavigationBar ============================= */
  // (ย้ายไปหลัง needsSurvey)

  const statusInfo = activityData ? getActivityStatus(activityData) : null;

  // คำนวณว่าอยู่ในช่วงเวลาทำแบบประเมินหรือไม่
  const surveyWindow = useMemo(() => {
    if (!activityData?.surveyConfig?.enabled) {
      return { open: false, expired: false, notStarted: false, endTime: null as Date | null, closeTime: null as Date | null, openMinutes: 0 };
    }
    if (!activityData.surveyConfig.questions?.length) {
      return { open: false, expired: false, notStarted: false, endTime: null as Date | null, closeTime: null as Date | null, openMinutes: 0 };
    }
    const surveyConfig = activityData.surveyConfig as any;
    const openMinutes = Number(surveyConfig.surveyOpenMinutes ?? 1440) || 1440;
    let endTime: Date | null = null;
    if (activityData.sessions && activityData.sessions.length > 0) {
      const sorted = [...activityData.sessions].sort((a, b) => {
        const aT = a.endDateTime?.toDate?.()?.getTime() || new Date(a.endDateTime).getTime();
        const bT = b.endDateTime?.toDate?.()?.getTime() || new Date(b.endDateTime).getTime();
        return bT - aT;
      });
      endTime = sorted[0].endDateTime?.toDate?.() || new Date(sorted[0].endDateTime);
    } else if (activityData.endDateTime) {
      endTime = activityData.endDateTime?.toDate?.() || new Date(activityData.endDateTime);
    }
    if (!endTime || Number.isNaN(endTime.getTime())) {
      return { open: false, expired: false, notStarted: false, endTime: null, closeTime: null, openMinutes };
    }
    const now = new Date();
    const closeTime = new Date(endTime.getTime() + openMinutes * 60 * 1000);
    return {
      open: now >= endTime && now <= closeTime,
      expired: now > closeTime,
      notStarted: now < endTime,
      endTime,
      closeTime,
      openMinutes,
    };
  }, [activityData]);

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

  /* ============================= รวม notices ไปแสดงบน NavigationBar ============================= */
  useEffect(() => {
    const tmp: NavNotice[] = [];

    if (error && !sessionExpired && !singleUserBlocked && !ipBlocked && !isDuplicateRegistration) {
      tmp.push({ key: `err-${Date.now()}`, severity: 'error', message: error, autoHideMs: 5000 });
    }
    if (sessionWarning) {
      tmp.push({ key: `sess-${Date.now()}`, severity: 'warning', message: sessionWarning, autoHideMs: 5000 });
    }
    if (geoError) {
      tmp.push({
        key: `geo-${Date.now()}`,
        severity: 'warning',
        message: geoError,
        actionLabel: 'ตรวจอีกครั้ง',
        onAction: () => triggerGeoCheck(),
      });
    }
    if (ipBlocked) {
      tmp.push({
        key: 'ip-block',
        severity: 'error',
        message: `IP นี้ถูกจำกัดชั่วคราว — เหลืออีก ${blockRemainingTime} นาที`,
      });
    }
    if (isDuplicateRegistration && !needsSurvey) {
      tmp.push({ key: 'dup', severity: 'info', message: 'คุณได้ลงทะเบียนกิจกรรมนี้แล้ว', autoHideMs: 4000 });
    }
    setNavNotices(tmp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, sessionWarning, geoError, ipBlocked, blockRemainingTime, isDuplicateRegistration, needsSurvey]);

  /* ============================= Render ============================= */
  // ระหว่างโหลด แสดง skeleton โครงหน้าจริงแทนหน้าสปินเนอร์ ให้รู้สึกว่าเข้าหน้าได้ทันที
  if (loading || authLoading) {
    return <RegisterPageSkeleton />;
  }

  /* ============================= Full-page errors ============================= */

  // IP ถูกจำกัดชั่วคราว
  if (ipBlocked) {
    return (
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
    );
  }

  // บัญชีถูกระงับโดยแอดมิน — บล็อกทุกอย่าง
  if (user && userData && (userData as any).isActive === false) {
    return (
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
    );
  }

  // กิจกรรมโหมดผู้ใช้เดียว / เช็กอินครบแล้ว — บล็อกการลงทะเบียน
  // (ยกเว้นช่วงที่ต้องเปิดให้ทำแบบประเมิน จะยังใช้หน้าปกติ)
  if (
    singleUserBlocked &&
    user &&
    !sessionExpired &&
    !(canEnterSurveyFlow && (isEligibleForSurvey || !hasRegisteredRecord))
  ) {
    const isAllCheckedIn = singleUserMessage.includes('ครบ');
    return (
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
    );
  }

  // ข้อผิดพลาดทั่วไป (ระบบปิด / ไม่พบกิจกรรม / QR หมดอายุ / โหลดล้มเหลว ฯลฯ)
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
    } else if (error.includes('หมดอายุ')) {
      variant = 'expired';
      code = 'QR_EXPIRED';
      title = 'QR Code หมดอายุแล้ว';
    } else if (error.includes('ไม่พบ')) {
      variant = 'notfound';
      code = 'NOT_FOUND';
      title = 'ไม่พบกิจกรรมที่ค้นหา';
    }

    return (
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
    );
  }

  // กิจกรรมสิ้นสุดแล้ว — แสดงจอแจ้งเตือนเต็มหน้าแทนหน้าลงทะเบียนปกติ
  // ยกเว้นช่วงเปิดทำแบบประเมิน (ให้เข้าหน้าปกติเพื่อล็อกอิน/ทำแบบประเมินได้)
  if (
    activityData &&
    statusInfo?.status === 'ended' &&
    !successMessage &&
    !canEnterSurveyFlow
  ) {
    const endedAt = statusInfo.endTime ? formatDateTime(statusInfo.endTime) : null;
    const surveyExpiredForUser =
      Boolean(activityData.surveyConfig?.enabled) &&
      surveyWindow.expired &&
      hasRegisteredRecord &&
      !surveyCompleted;

    return (
      <FullPageError
        variant="expired"
        code={surveyExpiredForUser ? 'SURVEY_EXPIRED' : 'ACTIVITY_ENDED'}
        title={surveyExpiredForUser ? 'หมดเวลาทำแบบประเมินแล้ว' : 'กิจกรรมสิ้นสุดแล้ว'}
        message={
          surveyExpiredForUser
            ? `แบบประเมินของ "${activityData.activityName}" ปิดรับไปแล้ว (เปิดได้ ${surveyWindow.openMinutes} นาทีหลังกิจกรรมสิ้นสุด)`
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
    );
  }

  return (
    <>
      <NavigationBar
        user={user}
        userData={userData}
        onLogout={handleLogout}
        onEditProfile={() => setShowProfileDialog(true)}
        notices={navNotices}
        urgentNotices={urgentNotices}
      />

      <Box sx={{ ...pageLayoutSx, flex: 1 }}>
        <Container maxWidth="md" sx={{ flex: 1, pt: { xs: 2, md: 3 }, pb: 4 }}>
          {/* Banner + Status */}
          {activityData && statusInfo && !ipBlocked && !singleUserBlocked && (
            <ModernActivityBanner activity={activityData} status={statusInfo} adminSettings={adminSettings} />
          )}

          {/* Success */}
          {successMessage && <SuccessAlert message={successMessage} onClose={() => setSuccessMessage('')} />}

          {/* แบบประเมินค้าง — อยู่บนสุด ซ่อนข้อความลงทะเบียนแล้ว/สิ้นสุดกิจกรรม */}
          {needsSurvey && activityData && (
            <Box sx={{ mb: 3 }}>
              {!user && (
                <Alert severity="info" sx={{ mb: 2, borderRadius: 3 }}>
                  กรุณาเข้าสู่ระบบด้วยบัญชีมหาวิทยาลัยเพื่อทำแบบประเมินหลังกิจกรรม
                </Alert>
              )}
              {user && !hasRegisteredRecord && (
                <Alert severity="warning" sx={{ mb: 2, borderRadius: 3 }}>
                  ไม่พบประวัติการลงทะเบียนกิจกรรมนี้ในบัญชีของคุณ จึงยังไม่สามารถทำแบบประเมินได้
                </Alert>
              )}
              {user && hasRegisteredRecord && !isEligibleForSurvey && (
                <Alert severity="warning" sx={{ mb: 2, borderRadius: 3 }}>
                  คุณยังไม่ผ่านเงื่อนไขการทำแบบประเมิน (เช่น ต้องเช็กอินครบตามที่ผู้ดูแลกำหนด)
                </Alert>
              )}
              {(!user || sessionExpired) && !ipBlocked && (
                <Box sx={{ mb: 2 }}>
                  <MicrosoftAuthSection
                    activityData={activityData}
                    onLoginSuccess={handleLoginSuccess}
                    onLoginError={handleLoginError}
                    onPreLoginCheck={handlePreLoginCheck}
                    checkingIP={checkingPreLogin}
                  />
                </Box>
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
              {surveyWindow.closeTime && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  เปิดทำแบบประเมินถึง {formatDateTime(surveyWindow.closeTime)} น.
                </Typography>
              )}
            </Box>
          )}

          {isSurveyPeriodOpen && surveyCompleted && (
            <Alert severity="success" sx={{ mb: 2, borderRadius: 3 }}>
              ขอบคุณที่ทำแบบประเมิน! ข้อมูลของคุณถูกบันทึกเรียบร้อยแล้ว
            </Alert>
          )}

          {/* Single-user block */}
          {singleUserBlocked && user && !sessionExpired && (
            <Alert severity="error" sx={{ mb: 2 }} icon={<WarningIcon />}>
              <Typography variant="body1" fontWeight="medium">
                ไม่สามารถลงทะเบียนได้
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {singleUserMessage}
              </Typography>
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button color="inherit" size="small" onClick={handleLogout} variant="outlined">
                  ออกจากระบบ
                </Button>
                <Button color="inherit" size="small" onClick={() => window.close()} variant="outlined">
                  ปิดหน้าต่าง
                </Button>
              </Box>
            </Alert>
          )}

          {/* ซ่อนเมื่อยังค้างแบบประเมิน — ไม่ให้แย่งโฟกัสกับฟอร์ม */}
          {isDuplicateRegistration &&
            user &&
            !sessionExpired &&
            !singleUserBlocked &&
            !needsSurvey && <DuplicateRegistrationAlert />}

          {/* Banner สำหรับรอบถัดไป หากเช็กอินรอบปัจจุบันแล้ว แต่ยังไม่ครบทุกรอบ */}
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
                    severity="info" 
                    icon={<AccessTimeIcon />}
                    sx={{ 
                      mb: 3, 
                      background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', 
                      border: '1px solid #0284c7',
                      borderRadius: 3
                    }}
                  >
                    <Typography variant="body1" gutterBottom fontWeight="bold" color="info.dark">
                      เช็กอินรอบปัจจุบันเรียบร้อยแล้ว
                    </Typography>
                    <Typography variant="body2" color="text.primary">
                      รอบถัดไป: <b>{nextSession.name}</b> จะเปิดให้เช็กอินในวันที่ {nStart.toLocaleString('th-TH', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })} น.
                    </Typography>
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

          {/* ✅ Map + Details (แสดงหลัง login เท่านั้น) */}
          {activityData &&
            statusInfo?.status === 'active' &&
            isAuthed &&
            !ipBlocked &&
            !isDuplicateRegistration &&
            !singleUserBlocked && (
              <>
                <Box sx={{ mb: 2 }}>
                  <GeofenceMap
                    center={{ lat: activityData.latitude, lng: activityData.longitude }}
                    radius={activityData.checkInRadius}
                    userPos={userPos}
                    inRadius={inRadius}
                    onUseCurrentLocation={triggerGeoCheck}
                    title={activityData.activityName}
                  />
                </Box>

                {/* GPS Status Card */}
                <Card elevation={0} sx={{ ...glassCardSx, mb: 2 }}>
                  <CardContent>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <GpsFixedIcon />
                      <Typography variant="h6" fontWeight={800}>
                        สถานะตำแหน่งของคุณ
                      </Typography>
                    </Stack>

                    <Grid container spacing={2} alignItems="center">
                      {/* ✅ Grid v2: ใช้ size แทน item/xs/md */}
                      <Grid size={{ xs: 12, md: 8 }}>
                        {geoLoading ? (
                          <Typography variant="body2" color="text.secondary">
                            กำลังตรวจสอบตำแหน่ง...
                          </Typography>
                        ) : !geoSupported ? (
                          <Alert severity="error" icon={<ErrorIcon />} sx={{ borderRadius: 2 }}>
                            อุปกรณ์ของคุณไม่รองรับการระบุตำแหน่ง
                          </Alert>
                        ) : geoError ? (
                          <Alert severity="warning" icon={<WarningIcon />} sx={{ borderRadius: 2 }}>
                            {geoError}
                          </Alert>
                        ) : (
                          <Stack direction="row" spacing={2} alignItems="center">
                            {inRadius ? <CheckIcon color="success" /> : <ErrorIcon color="error" />}
                            <Typography variant="body2">
                              {inRadius ? 'คุณอยู่ในพื้นที่ที่กำหนด' : 'คุณอยู่นอกพื้นที่ที่กำหนด'}
                              {typeof distanceM === 'number' && (
                                <>
                                  {' '}
                                  — ระยะห่างประมาณ <b>{distanceM}</b> เมตร (กำหนดไม่เกิน <b>{activityData.checkInRadius}</b> เมตร)
                                </>
                              )}
                            </Typography>
                          </Stack>
                        )}
                      </Grid>

                      {/* ✅ Grid v2 */}
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Stack direction="row" spacing={1} justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
                          <Button variant="outlined" onClick={triggerGeoCheck}>
                            ตรวจสอบตำแหน่งอีกครั้ง
                          </Button>
                        </Stack>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </>
            )}

          {/* รายละเอียดกิจกรรม — ซ่อนชั่วคราวเมื่อค้างแบบประเมิน เพื่อโฟกัสฟอร์ม */}
          {activityData && !ipBlocked && !singleUserBlocked && !needsSurvey && (
            <Card elevation={0} sx={{ ...glassCardSx, mb: 2 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>
                  รายละเอียดกิจกรรม
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Stack spacing={0.5}>
                      <Typography variant="overline">วันที่เริ่ม</Typography>
                      <Typography variant="body2">{formatDateTime(activityData.startDateTime)}</Typography>
                    </Stack>
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <Stack spacing={0.5}>
                      <Typography variant="overline">วันที่สิ้นสุด</Typography>
                      <Typography variant="body2">{formatDateTime(activityData.endDateTime)}</Typography>
                    </Stack>
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <Stack spacing={0.5}>
                      <Typography variant="overline">คำอธิบาย</Typography>
                      {activityData.description ? (
                        <div 
                          className="ql-editor"
                          style={{ padding: 0, minHeight: 'auto', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)' }}
                          dangerouslySetInnerHTML={{ __html: activityData.description }}
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </Stack>
                  </Grid>

                  {activityData.sessions && activityData.sessions.length > 0 && (
                    <Grid size={{ xs: 12 }}>
                      <Stack spacing={1} sx={{ mt: 2 }}>
                        <Typography variant="overline" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          รอบกิจกรรมย่อย ({activityData.sessions.length} รอบ)
                        </Typography>
                        <Typography variant="caption" color="warning.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, fontWeight: 500 }}>
                          <InfoIcon fontSize="inherit" />
                          กรุณาเช็กอินให้ครบตาม section
                        </Typography>
                        {activityData.sessions.map((session: any, index: number) => {
                          const isCheckedIn = checkedInSessions.includes(session.id);
                          return <SessionCard key={session.id || index} session={session} isCheckedIn={isCheckedIn} />;
                        })}
                      </Stack>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          )}

          {/* Microsoft login — แสดงเสมอเพื่อให้เข้าสู่ระบบรอได้ (ยกเว้นช่วงค้างแบบประเมินที่แสดงด้านบนแล้ว) */}
          {shouldShowMicrosoftLogin() && activityData && !needsSurvey && (
            <MicrosoftAuthSection
              activityData={activityData}
              onLoginSuccess={handleLoginSuccess}
              onLoginError={handleLoginError}
              onPreLoginCheck={handlePreLoginCheck}
              checkingIP={checkingPreLogin}
            />
          )}

          {/* Profile setup */}
          {user &&
            needsProfileSetup &&
            !ipBlocked &&
            !isDuplicateRegistration &&
            !sessionExpired &&
            !sessionValidating &&
            !singleUserBlocked && <ProfileSetupAlert onEditProfile={() => setShowProfileDialog(true)} />}

          {/* Registration form */}
          {statusInfo?.status === 'active' && adminSettings && activityCode && canProceedToRegistration() && activityData && (
            <ActivityRegistrationForm
              activityCode={activityCode}
              activityDocId={activityData.id}
              adminSettings={adminSettings}
              checkedInSessions={checkedInSessions}
              existingAuthStatus={isAuthed}
              existingUserProfile={
                user
                  ? {
                      id: user.uid,
                      email: user.email || '',
                      displayName: user.displayName || '',
                      givenName: userData?.firstName || '',
                      surname: userData?.lastName || '',
                      department: userData?.department || '',
                      faculty: userData?.faculty || '',
                      studentId: userData?.studentId || '',
                    }
                  : undefined
              }
              onSuccess={handleRegistrationSuccess}
              onLogout={handleLogout}
              surveyConfig={(activityData as any).surveyConfig}
              sessions={activityData.sessions}
            />
          )}

          {/* Profile dialog */}
          <ProfileEditDialog
            open={showProfileDialog}
            onClose={() => {
              if (needsProfileSetup) return; // prevent close if profile is mandatory
              setShowProfileDialog(false);
            }}
            user={user}
            userData={userData}
            onSave={handleSaveProfile}
            isFirstTimeSetup={needsProfileSetup}
          />

          {/* (สำรอง) Snackbar เดิม */}
          <Snackbar
            open={snack.open}
            autoHideDuration={4000}
            onClose={() => setSnack((s) => ({ ...s, open: false }))}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          >
            <MuiAlert
              onClose={() => setSnack((s) => ({ ...s, open: false }))}
              severity={snack.severity}
              variant="filled"
              sx={{ width: '100%' }}
            >
              {snack.text}
            </MuiAlert>
          </Snackbar>
        </Container>
        <Footer />
      </Box>
    </>
  );
};

/* ============================= Loading Skeleton ============================= */
// โครงหน้าจำลองระหว่างโหลดข้อมูล — แสดงเลย์เอาต์จริงทันทีแทนหน้าสปินเนอร์
const RegisterPageSkeleton: React.FC = () => (
  <Box sx={{ ...pageLayoutSx, flex: 1 }}>
    {/* Navbar placeholder */}
    <Box
      sx={{
        height: 64,
        px: { xs: 2, md: 4 },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        bgcolor: pageColors.cardBg,
        borderBottom: `1px solid ${pageColors.border}`,
      }}
    >
      <Skeleton variant="rounded" width={150} height={26} sx={{ borderRadius: '8px' }} />
      <Skeleton variant="circular" width={36} height={36} />
    </Box>

    <Container maxWidth="md" sx={{ flex: 1, pt: { xs: 2, md: 3 }, pb: 4 }}>
      {/* Banner */}
      <Skeleton
        variant="rounded"
        width="100%"
        sx={{ height: { xs: 160, md: 220 }, borderRadius: '24px', mb: 3 }}
      />

      {/* Activity details card */}
      <Card elevation={0} sx={{ ...glassCardSx, mb: 2 }}>
        <CardContent>
          <Skeleton width="45%" height={30} sx={{ borderRadius: '8px', mb: 2 }} />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Skeleton width="35%" height={16} sx={{ borderRadius: '6px', mb: 0.5 }} />
              <Skeleton width="70%" height={22} sx={{ borderRadius: '6px' }} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Skeleton width="35%" height={16} sx={{ borderRadius: '6px', mb: 0.5 }} />
              <Skeleton width="70%" height={22} sx={{ borderRadius: '6px' }} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Skeleton width="25%" height={16} sx={{ borderRadius: '6px', mb: 0.5 }} />
              <Skeleton width="100%" height={20} sx={{ borderRadius: '6px' }} />
              <Skeleton width="85%" height={20} sx={{ borderRadius: '6px' }} />
              <Skeleton width="60%" height={20} sx={{ borderRadius: '6px' }} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Login / form card */}
      <Card elevation={0} sx={{ ...glassCardSx }}>
        <CardContent>
          <Skeleton width="35%" height={28} sx={{ borderRadius: '8px', mb: 2 }} />
          <Skeleton variant="rounded" width="100%" height={52} sx={{ borderRadius: '14px', mb: 1.5 }} />
          <Skeleton variant="rounded" width="100%" height={52} sx={{ borderRadius: '14px' }} />
        </CardContent>
      </Card>
    </Container>
  </Box>
);

/* ============================= Page Wrapper with Suspense ============================= */
const RegisterPage: React.FC = () => {
  return (
    <Box sx={pageLayoutSx}>
      <Suspense fallback={<RegisterPageSkeleton />}>
        <RegisterPageContent />
      </Suspense>
    </Box>
  );
};

export default RegisterPage;
