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
import { glassCardSx, pageColors, pageLayoutSx } from '../../lib/uiTheme';
import Image from 'next/image';

// Firebase helpers
import { db } from '../../lib/firebase';
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

  if (activity.maxParticipants > 0 && activity.currentParticipants >= activity.maxParticipants)
    return { status: 'full', message: 'กิจกรรมนี้มีผู้สมัครครบจำนวนแล้ว' };

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

  const statusChipSx =
    status.status === 'active'
      ? { bgcolor: pageColors.appleGreenBg, color: pageColors.appleGreen, fontWeight: 700, borderRadius: '10px' }
      : undefined;

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
    if (user && activityCode && !isDuplicateRegistration && !sessionExpired && !sessionValidating) {
      checkForDuplicateRegistration();
      checkForSingleUserMode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activityCode, sessionExpired, sessionValidating]);

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
    (!user || sessionExpired) && !ipBlocked && !isDuplicateRegistration && !singleUserBlocked;

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
      setIsDuplicateRegistration(dup);
      if (dup) setError('บัญชีนี้เคยลงทะเบียนกิจกรรมนี้แล้ว');
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
          setSingleUserBlocked(true);
          const msg = `กิจกรรมนี้อนุญาตให้ลงทะเบียนได้เพียงผู้ใช้เดียว และมีผู้ใช้ ${existing.email} ลงทะเบียนไปแล้ว`;
          setSingleUserMessage(msg);
          setError(msg);
        } else if (existing.email === user.email) {
          setSingleUserBlocked(true);
          setSingleUserMessage('คุณได้ลงทะเบียนกิจกรรมนี้แล้ว');
          setError('คุณได้ลงทะเบียนกิจกรรมนี้แล้ว');
        }
      }
    } catch {}
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
        setSessionExpired(true);
        setError(result.message || 'เซสชันหมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่');
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
        setSessionExpired(true);
        setError(result.message || 'เซสชันหมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่');
        setSessionWarning('');
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
      if (activityCode)
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
    await setDoc(doc(db, 'users', user.uid), { ...updatedData, updatedAt: new Date() }, { merge: true });
    setNeedsProfileSetup(false);
    setSuccessMessage('บันทึกข้อมูลเรียบร้อยแล้ว');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // เพิ่มตัวนับผู้เข้าร่วม (อัปเดตแบบอะตอมิกจาก Transaction ในระดับเซิร์ฟเวอร์แล้ว และ sync ผ่าน real-time onSnapshot)
  const handleRegistrationSuccess = async () => {
    // ปล่อยให้ onSnapshot ในระดับ Parent อัปเดตข้อมูลจำนวนผู้เข้าร่วมจากฐานข้อมูลอัตโนมัติ
  };

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
    if (isDuplicateRegistration) {
      tmp.push({ key: 'dup', severity: 'info', message: 'คุณได้ลงทะเบียนกิจกรรมนี้แล้ว', autoHideMs: 4000 });
    }
    setNavNotices(tmp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, sessionWarning, geoError, ipBlocked, blockRemainingTime, isDuplicateRegistration]);

  /* ============================= Render ============================= */
  if (loading || authLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50vh',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <CircularProgress size={40} />
        <Typography variant="body1" color="text.secondary">
          กำลังโหลดข้อมูล...
        </Typography>
      </Box>
    );
  }

  if (
    error &&
    !ipBlocked &&
    !isDuplicateRegistration &&
    !successMessage &&
    !sessionExpired &&
    !sessionWarning &&
    !singleUserBlocked
  ) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
        <Button color="inherit" size="small" onClick={loadInitialData} sx={{ ml: 2 }} startIcon={<RefreshIcon />}>
          ลองใหม่
        </Button>
      </Alert>
    );
  }

  const statusInfo = activityData ? getActivityStatus(activityData) : null;

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

          {isDuplicateRegistration && user && !sessionExpired && !singleUserBlocked && <DuplicateRegistrationAlert />}

          {activityData && statusInfo && statusInfo.status !== 'active' && !ipBlocked && !singleUserBlocked && (
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

                {/* รายละเอียดกิจกรรม */}
                <Card elevation={0} sx={{ ...glassCardSx, mb: 2 }}>
                  <CardContent>
                    <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>
                      รายละเอียดกิจกรรม
                    </Typography>
                    <Divider sx={{ mb: 2 }} />

                    <Grid container spacing={2}>
                      {/* ✅ Grid v2 */}
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Stack spacing={0.5}>
                          <Typography variant="overline">วันที่เริ่ม</Typography>
                          <Typography variant="body2">{formatDateTime(activityData.startDateTime)}</Typography>
                        </Stack>
                      </Grid>

                      {/* ✅ Grid v2 */}
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Stack spacing={0.5}>
                          <Typography variant="overline">วันที่สิ้นสุด</Typography>
                          <Typography variant="body2">{formatDateTime(activityData.endDateTime)}</Typography>
                        </Stack>
                      </Grid>

                      {/* ✅ Grid v2 */}
                      <Grid size={{ xs: 12 }}>
                        <Stack spacing={0.5}>
                          <Typography variant="overline">คำอธิบาย</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {activityData.description || '-'}
                          </Typography>
                        </Stack>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </>
            )}

          {/* Microsoft login — แสดงเฉพาะเมื่อกิจกรรม Active */}
          {shouldShowMicrosoftLogin() && activityData && statusInfo?.status === 'active' && (
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
              existingAuthStatus={isAuthed}
              existingUserProfile={
                user
                  ? {
                      id: user.uid,
                      email: user.email || '',
                      displayName: user.displayName || '',
                      givenName: userData?.firstName || '',
                      surname: userData?.lastName || '',
                    }
                  : undefined
              }
              onSuccess={handleRegistrationSuccess}
              onLogout={handleLogout}
            />
          )}

          {/* Profile dialog */}
          <ProfileEditDialog
            open={showProfileDialog}
            onClose={() => {
              setShowProfileDialog(false);
              if (needsProfileSetup && !sessionExpired && !sessionValidating) setTimeout(() => setShowProfileDialog(true), 500);
            }}
            user={user}
            userData={userData}
            onSave={handleSaveProfile}
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

/* ============================= Page Wrapper with Suspense ============================= */
const RegisterPage: React.FC = () => {
  return (
    <Box sx={pageLayoutSx}>
      <Suspense
          fallback={
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '50vh',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <CircularProgress size={40} />
              <Typography variant="body1" color="text.secondary">
                กำลังโหลดหน้าลงทะเบียน...
              </Typography>
            </Box>
          }
        >
          <RegisterPageContent />
        </Suspense>
    </Box>
  );
};

export default RegisterPage;
