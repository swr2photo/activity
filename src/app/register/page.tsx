'use client';
import React, { useEffect, useMemo, useState, Suspense, useRef } from 'react';
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
  Paper,
  Stack,
  Typography,
  Snackbar,
  Alert as MuiAlert,
} from '@mui/material';
import { alpha, keyframes } from '@mui/material/styles';
import {
  AccessTime as TimeIcon,
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
  IPRestrictionAlert,
  DuplicateRegistrationAlert,
  ProfileSetupAlert,
  SuccessAlert,
  ActivityStatusAlert,
} from '../../components/alerts/StatusAlerts';
import ProfileEditDialog from '../../components/profile/ProfileEditDialog';
import ActivityRegistrationForm from '../../components/ActivityRegistrationForm';
import GeofenceMap from '../../components/maps/GeofenceMap';

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

const float1 = keyframes`
  0% { transform: translateY(0) translateX(0); }
  50% { transform: translateY(-12px) translateX(10px); }
  100% { transform: translateY(0) translateX(0); }
`;
const float2 = keyframes`
  0% { transform: translateY(0) translateX(0); }
  50% { transform: translateY(12px) translateX(-10px); }
  100% { transform: translateY(0) translateX(0); }
`;

/* ============================= Helpers ============================= */
const getActivityStatus = (activity: ActivityData): ActivityStatusInfo => {
  const now = new Date();
  const startTime: Date =
    activity.startDateTime?.toDate?.() || new Date(activity.startDateTime);
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
  if (
    activity.maxParticipants > 0 &&
    activity.currentParticipants >= activity.maxParticipants
  )
    return { status: 'full', message: 'กิจกรรมนี้มีผู้สมัครครบจำนวนแล้ว' };
  return { status: 'active', message: '' };
};

/* ============================= Modern Activity Banner ============================= */
const ModernActivityBanner: React.FC<{
  activity: ActivityData;
  status: ActivityStatusInfo;
  adminSettings: AdminSettings | null;
}> = ({ activity, status, adminSettings }) => {

  // ถ้าไม่มีรูป → ใช้สีแทน
  const tintColor = activity.bannerTintColor || (adminSettings as any)?.branding?.primaryColor || '#0ea5e9';
  const tintOpacity = typeof activity.bannerTintOpacity === 'number'
    ? Math.max(0, Math.min(1, activity.bannerTintOpacity))
    : 0.42;

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

  return (
    <Box sx={{ position: 'relative', borderRadius: { xs: 0, md: 4 }, overflow: 'hidden', mb: 3 }}>
      {hasImage ? (
        <>
          <Box
            component="img"
            src={activity.bannerUrl!}
            alt={activity.activityName}
            loading="lazy"
            sx={{
              width: '100%',
              height: { xs: 220, md: 320 },
              objectFit: activity.bannerAspect === 'contain' ? 'contain' : 'cover',
              display: 'block',
              backgroundColor: '#000',
            }}
          />
          {/* overlay สีทับ */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(180deg,
                ${alpha(tintColor as any, tintOpacity)},
                ${alpha(tintColor as any, Math.max(0, tintOpacity - 0.17))} 40%,
                ${alpha(tintColor as any, Math.min(0.85, tintOpacity + 0.18))}
              )`,
            }}
          />
        </>
      ) : (
        <Box sx={{ width: '100%', height: { xs: 160, md: 220 }, background: activity.bannerColor || tintColor }} />
      )}

      <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ mt: { xs: -6, md: -8 } }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, md: 3 },
              borderRadius: 3,
              backdropFilter: 'blur(14px)',
              background: 'linear-gradient(145deg, rgba(255,255,255,0.65), rgba(255,255,255,0.35))',
              border: '1px solid rgba(255,255,255,0.3)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
            }}
          >
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  {/* หมายเหตุ: ไม่โชว์รหัสกิจกรรมตาม requirement ล่าสุด */}
                  <Chip label={statusLabel} color={statusColor} size="small" sx={{ borderRadius: 2 }} />
                </Stack>
                <Typography variant="h5" fontWeight={800}>{activity.activityName}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{activity.location}</Typography>
              </Box>
              <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />
              <Box>
                <Stack spacing={0.5}>
                  <Typography variant="overline">ช่วงเวลา</Typography>
                  <Typography variant="body2">
                    {formatDateTime(activity.startDateTime)} — {formatDateTime(activity.endDateTime)}
                  </Typography>
                  {activity.maxParticipants > 0 && (
                    <Typography variant="body2" color="text.secondary">
                      ผู้สมัคร {activity.currentParticipants}/{activity.maxParticipants}
                    </Typography>
                  )}
                </Stack>
              </Box>
            </Stack>
          </Paper>
        </Box>
      </Container>
    </Box>
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
  const [geoAllowed, setGeoAllowed] = useState(false); // ✅ เพิ่ม state ที่หาย
  const [geoError, setGeoError] = useState('');
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [inRadius, setInRadius] = useState(false);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);

  // Realtime toggle feedback
  const [snack, setSnack] = useState<{ open: boolean; text: string; severity: 'success' | 'warning' | 'info'; }>
  ({ open: false, text: '', severity: 'info' });
  const lastActiveRef = useRef<boolean | null>(null);

  /* ------ สำหรับ NavigationBar: notices ปกติ + notices เร่งด่วน (≤ 5 นาที) ------ */
  const [navNotices, setNavNotices] = useState<NavNotice[]>([]);
  const [urgentNotices, setUrgentNotices] = useState<NavNotice[]>([]);

  /* ============================= Effects — initial ============================= */
  useEffect(() => { loadInitialData(); /* eslint-disable-next-line */ }, [activityCode]);

  useEffect(() => {
    if (user && !sessionExpired && !sessionValidating) {
      validateInitialSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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

  // ▶️ Realtime: ฟังเอกสาร activityQRCodes/{id} แล้วอัปเดตสถานะ/แจ้งเตือน
  useEffect(() => {
    if (!activityData?.id) return;
    const unsubscribe = onSnapshot(doc(db, 'activityQRCodes', activityData.id), (docSnap) => {
      if (!docSnap.exists()) return;

      const data: any = docSnap.data();
      setActivityData((prev) => {
        if (!prev) return prev;
        const updated: ActivityData = {
          ...prev,
          currentParticipants: data.currentParticipants || 0,
          isActive: data.isActive !== undefined ? data.isActive : true,
          singleUserMode: data.singleUserMode || false,
          closeReason: data.closeReason || '',
          bannerAspect: data.bannerAspect || prev.bannerAspect,
          bannerUrl: data.bannerUrl || prev.bannerUrl,
          bannerColor: data.bannerColor || prev.bannerColor,
          bannerTintColor: data.bannerTintColor || prev.bannerTintColor,
          bannerTintOpacity: typeof data.bannerTintOpacity === 'number' ? data.bannerTintOpacity : prev.bannerTintOpacity,
        };

        const s = getActivityStatus(updated);
        setValidActivity(s.status === 'active');

        const prevActive = lastActiveRef.current;
        const nowActive = updated.isActive;
        if (prevActive !== null && prevActive !== nowActive) {
          // เด้งขึ้นเป็น notice (ไปโชว์ที่ NavigationBar)
          setNavNotices(prev => [
            ...prev,
            {
              key: `live-${Date.now()}`,
              severity: nowActive ? 'success' : 'warning',
              message: nowActive ? 'ผู้ดูแลได้เปิดกิจกรรมแล้ว — เริ่มลงทะเบียนได้' :
                `ผู้ดูแลได้ปิดกิจกรรมแล้ว${updated.closeReason ? ' — ' + updated.closeReason : ''}`,
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

  // เมื่อ activity พร้อมให้ตรวจตำแหน่งทันที
  useEffect(() => { if (activityData) triggerGeoCheck(); /* eslint-disable-next-line */ }, [activityData]);

  // แสดง countdown ≤ 5 นาที (urgent)
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
            message: <>จะปิดการลงทะเบียนในอีก <b>{m}:{s}</b></>,
            autoHideMs: 1000, // ขยับทุกวินาที (Snackbar จะรีเฟรช)
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
  const getExistingAuthStatus = (): boolean =>
    !!(user && userData && !sessionExpired && !sessionValidating);

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
      const qAct = query(
        collection(db, 'activityQRCodes'),
        where('activityCode', '==', activityCode),
        limit(1)
      );
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
        } as ActivityData;
        setActivityData(activity);
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
  const triggerGeoCheck = () => {
    if (!activityData) return;
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
  };

  /* ============================= Session helpers ============================= */
  const validateInitialSession = async () => {
    if (!user?.uid) return;
    setSessionValidating(true);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      const result = await SessionManager.validateSession(user.uid);
      if (!result.isValid) {
        setSessionExpired(true);
        setError(result.message || 'เซสชันหมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่');
        return;
      }
      if (result.remainingTime && result.remainingTime <= 5)
        setSessionWarning(`เซสชันจะหมดอายุในอีก ${result.remainingTime} นาที กรุณาเตรียมตัวเข้าสู่ระบบใหม่`);
      else setSessionWarning('');
    } catch {} finally {
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

  // เพิ่มตัวนับผู้เข้าร่วม
  const handleRegistrationSuccess = async () => {
    if (!activityData) return;
    try {
      const docRef = doc(db, 'activityQRCodes', activityData.id);
      await updateDoc(docRef, { currentParticipants: increment(1) });
      setActivityData(prev => (prev ? { ...prev, currentParticipants: prev.currentParticipants + 1 } : prev));
    } catch {}
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
  if (loading || authLoading || sessionValidating) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', flexDirection: 'column', gap: 2 }}>
        <CircularProgress size={40} />
        <Typography variant="body1" color="text.secondary">
          {sessionValidating ? 'กำลังตรวจสอบเซสชัน...' : 'กำลังโหลดข้อมูล...'}
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
    // ยังแสดง error card ได้ (พร้อมปุ่มลองใหม่) — แต่ก็มี toast บน Nav แล้ว
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

      <Box sx={{ position: 'relative', background: 'linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%)', minHeight: '100vh', pb: 6 }}>
        <Box sx={{ position: 'absolute', top: -60, left: -80, width: 260, height: 260, borderRadius: '50%', background: alpha('#7c3aed', 0.12), filter: 'blur(24px)', animation: `${float1} 12s ease-in-out infinite` }} />
        <Box sx={{ position: 'absolute', bottom: -70, right: -60, width: 320, height: 320, borderRadius: '50%', background: alpha('#2563eb', 0.12), filter: 'blur(28px)', animation: `${float2} 14s ease-in-out infinite` }} />

        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1, pt: 2 }}>
          {/* Banner + Status */}
          {activityData && statusInfo && !ipBlocked && !singleUserBlocked && (
            <ModernActivityBanner activity={activityData} status={statusInfo} adminSettings={adminSettings} />
          )}

          {/* Success */}
          {successMessage && <SuccessAlert message={successMessage} onClose={() => setSuccessMessage('')} />}

          {/* Duplicate / Single-user / Status card — ยังแสดงปกติ (เสริมจาก toast) */}
          {singleUserBlocked && user && !sessionExpired && (
            <Alert severity="error" sx={{ mb: 2 }} icon={<WarningIcon />}>
              <Typography variant="body1" fontWeight="medium">ไม่สามารถลงทะเบียนได้</Typography>
              <Typography variant="body2" color="text.secondary">{singleUserMessage}</Typography>
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button color="inherit" size="small" onClick={handleLogout} variant="outlined">ออกจากระบบ</Button>
                <Button color="inherit" size="small" onClick={() => window.close()} variant="outlined">ปิดหน้าต่าง</Button>
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

          {/* Map + Details */}
          {activityData && !ipBlocked && !isDuplicateRegistration && !sessionExpired && !singleUserBlocked && (
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
              <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2 }}>
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <GpsFixedIcon />
                    <Typography variant="h6" fontWeight={800}>สถานะตำแหน่งของคุณ</Typography>
                  </Stack>

                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={8}>
                      {geoLoading ? (
                        <Typography variant="body2" color="text.secondary">กำลังตรวจสอบตำแหน่ง...</Typography>
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
                              <> — ระยะห่างประมาณ <b>{distanceM}</b> เมตร (กำหนดไม่เกิน <b>{activityData.checkInRadius}</b> เมตร)</>
                            )}
                          </Typography>
                        </Stack>
                      )}
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Stack direction="row" spacing={1} justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
                        <Button variant="outlined" onClick={triggerGeoCheck}>ตรวจสอบตำแหน่งอีกครั้ง</Button>
                      </Stack>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* รายละเอียดกิจกรรม */}
              <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>รายละเอียดกิจกรรม</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Stack spacing={0.5}>
                        <Typography variant="overline">วันที่เริ่ม</Typography>
                        <Typography variant="body2">{formatDateTime(activityData.startDateTime)}</Typography>
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Stack spacing={0.5}>
                        <Typography variant="overline">วันที่สิ้นสุด</Typography>
                        <Typography variant="body2">{formatDateTime(activityData.endDateTime)}</Typography>
                      </Stack>
                    </Grid>
                    <Grid item xs={12}>
                      <Stack spacing={0.5}>
                        <Typography variant="overline">คำอธิบาย</Typography>
                        <Typography variant="body2" color="text.secondary">{activityData.description || '-'}</Typography>
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
          {user && needsProfileSetup && !ipBlocked && !isDuplicateRegistration && !sessionExpired && !sessionValidating && !singleUserBlocked && (
            <ProfileSetupAlert onEditProfile={() => setShowProfileDialog(true)} />
          )}

          {/* Registration form */}
          {statusInfo?.status === 'active' && adminSettings && activityCode && canProceedToRegistration() && activityData && (
            <ActivityRegistrationForm
              activityCode={activityCode}
              activityDocId={activityData.id}
              adminSettings={adminSettings}
              existingAuthStatus={!!(user && userData && !sessionExpired && !sessionValidating)}
              existingUserProfile={
                user
                  ? { id: user.uid, email: user.email || '', displayName: user.displayName || '', givenName: userData?.firstName || '', surname: userData?.lastName || '' }
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

          {/* (สำรอง) Snackbar เดิมกรณี realtime toggle */}
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
      </Box>
    </>
  );
};

/* ============================= Page Wrapper with Suspense ============================= */
const RegisterPage: React.FC = () => {
  return (
    <Box sx={{ minHeight: '100vh', background: 'transparent' }}>
      <Container maxWidth="md" sx={{ py: 0 }}>
        <Suspense
          fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', flexDirection: 'column', gap: 2 }}>
              <CircularProgress size={40} />
              <Typography variant="body1" color="text.secondary">กำลังโหลดหน้าลงทะเบียน...</Typography>
            </Box>
          }
        >
          <RegisterPageContent />
        </Suspense>
      </Container>
    </Box>
  );
};

export default RegisterPage;
