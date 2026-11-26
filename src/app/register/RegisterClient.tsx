'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import {
  CalendarCheck,
  CalendarX,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Crosshair,
  FileText,
  History,
  KeyRound,
  LayoutList,
  Lock,
  LogOut,
  Map as MapIcon,
  MapPin,
  Pencil,
  PlayCircle,
  Radar,
  RefreshCw,
  ShieldAlert,
  Users,
} from 'lucide-react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import AuroraBackground from '@/components/graphics/AuroraBackground';
import ScienceOrbit from '@/components/graphics/ScienceOrbit';
import FullPageError from '@/components/common/FullPageError';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { glassCardClass, pageColors, pageLayoutClass } from '@/lib/uiTheme';
import { auth, db } from '@/lib/firebase';
import {
  useAuth,
  isProfileComplete,
  isUniversityEmail,
  updateUserProfile,
  mapAuthError,
  type UniversityUserProfile,
} from '@/lib/firebaseAuth';
import type { ServerActivityDetail } from '@/lib/activitiesServer';
import { getSurveyWindowStatus } from '@/lib/surveyWindow';
import {
  dynamicQrExpiredMessage,
  dynamicQrExpiredTitle,
  type DynamicQrExpiredContext,
} from '@/lib/dynamicQrMessages';
import {
  clearDynamicQrClaim,
  readDynamicQrClaim,
  writeDynamicQrClaim,
} from '@/lib/dynamicQrClaimStorage';

// Lazy-load หนักๆ เฉพาะเมื่อจำเป็น (ลด JS หน้า /register ลง >300 KB)
const GeofenceMap = dynamic(() => import('@/components/maps/GeofenceMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[320px] items-center justify-center rounded-2xl border border-border bg-muted/30">
      <Spinner size="lg" />
    </div>
  ),
});

const ProfileEditDialog = dynamic(() => import('@/components/profile/ProfileEditDialog'), {
  ssr: false,
  loading: () => null,
});

const SurveyForm = dynamic(() => import('@/components/activity/SurveyForm'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-8">
      <Spinner size="default" />
    </div>
  ),
});

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

const toDateSafe = (d: any): Date | null => {
  if (!d) return null;
  if (typeof d?.toDate === 'function') return d.toDate();
  if (d instanceof Date) return d;
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateTime = (d: any) => {
  const dd = toDateSafe(d);
  if (!dd) return '-';
  return dd.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
};

type StatusKind = 'active' | 'upcoming' | 'full' | 'ended' | 'inactive';

function computeActivityStatus(activity: ServerActivityDetail): {
  status: StatusKind;
  message: string;
  activeSession?: { id: string; name: string; endDateTime?: any };
  nextSession?: { id: string; name: string; startDateTime?: any };
} {
  const now = new Date();
  if (!activity.isActive) {
    return { status: 'inactive', message: activity.closeReason || 'กิจกรรมนี้ถูกปิดรับลงทะเบียนชั่วคราว' };
  }
  if (activity.maxParticipants > 0 && activity.currentParticipants >= activity.maxParticipants) {
    return { status: 'full', message: 'กิจกรรมนี้มีผู้สมัครครบจำนวนแล้ว' };
  }

  if (Array.isArray(activity.sessions) && activity.sessions.length > 0) {
    const sorted = [...activity.sessions].sort((a, b) => {
      const ta = toDateSafe(a.startDateTime)?.getTime() ?? 0;
      const tb = toDateSafe(b.startDateTime)?.getTime() ?? 0;
      return ta - tb;
    });
    const activeSession = sorted.find((s) => {
      const sStart = toDateSafe(s.startDateTime);
      const sEnd = toDateSafe(s.endDateTime);
      return sStart && sEnd && now >= sStart && now <= sEnd;
    });
    if (activeSession) {
      return {
        status: 'active',
        message: `กำลังเปิดเช็กอินรอบ: ${activeSession.name}`,
        activeSession,
      };
    }
    const nextSession = sorted.find((s) => {
      const sStart = toDateSafe(s.startDateTime);
      return sStart && now < sStart;
    });
    if (nextSession) {
      return {
        status: 'upcoming',
        message: `รอบถัดไป (${nextSession.name}) จะเปิดในวันที่ ${formatDateTime(nextSession.startDateTime)}`,
        nextSession,
      };
    }
    const last = sorted[sorted.length - 1];
    return {
      status: 'ended',
      message: `กิจกรรมสิ้นสุดแล้วเมื่อวันที่ ${formatDateTime(last.endDateTime)}`,
    };
  }

  const start = toDateSafe(activity.startDateTime);
  const end = toDateSafe(activity.endDateTime);
  if (start && now < start) {
    return {
      status: 'upcoming',
      message: `กิจกรรมจะเปิดลงทะเบียนในวันที่ ${formatDateTime(start)}`,
    };
  }
  if (end && now > end) {
    return {
      status: 'ended',
      message: `กิจกรรมสิ้นสุดแล้วเมื่อวันที่ ${formatDateTime(end)}`,
    };
  }
  return { status: 'active', message: '' };
}

const MicrosoftLogo = () => (
  <svg width="20" height="20" viewBox="0 0 23 23" aria-hidden>
    <path fill="#f35325" d="M1 1h10v10H1z" />
    <path fill="#81bc06" d="M12 1h10v10H12z" />
    <path fill="#05a6f0" d="M1 12h10v10H1z" />
    <path fill="#ffba08" d="M12 12h10v10H12z" />
  </svg>
);

const GoogleLogo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

/* ============================= Main Client Component ============================= */
interface RegisterClientProps {
  activityCode: string;
  initialDt: string;
  initialActivity: ServerActivityDetail | null;
}

export default function RegisterClient({
  activityCode,
  initialDt,
  initialActivity,
}: RegisterClientProps) {
  const { user, userData, loading: authLoading, login, loginWithGoogle, logout, refreshUserData } = useAuth();

  const [activity, setActivity] = useState<ServerActivityDetail | null>(initialActivity);
  const [loadingActivity, setLoadingActivity] = useState(!initialActivity && Boolean(activityCode));
  const [fatalError, setFatalError] = useState('');

  // Dynamic QR state
  const [dtToken, setDtToken] = useState(initialDt);
  const [qrClaim, setQrClaim] = useState('');
  const [qrChecking, setQrChecking] = useState(Boolean(initialActivity?.dynamicQREnabled));
  const [qrExpireMeta, setQrExpireMeta] = useState<DynamicQrExpiredContext | null>(null);

  // Registration & survey state
  const [checkingRecord, setCheckingRecord] = useState(false);
  const [hasRegistered, setHasRegistered] = useState(false);
  const [checkedInSessions, setCheckedInSessions] = useState<string[]>([]);
  const [surveyCompleted, setSurveyCompleted] = useState(false);

  // Form / Action state
  const [userCodeInput, setUserCodeInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [justRegisteredMsg, setJustRegisteredMsg] = useState('');
  const [loginBusy, setLoginBusy] = useState<'microsoft' | 'google' | null>(null);

  // Profile dialog
  const [showProfileDialog, setShowProfileDialog] = useState(false);

  // GPS state (ตรวจรอบเดียว ไม่โดน onSnapshot cascade!)
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [userPos, setUserPos] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [inRadius, setInRadius] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showFullDetails, setShowFullDetails] = useState(false);
  const geoReqRef = useRef(0);

  // Fallback load ฝั่ง client เฉพาะกรณี Server prefetch ไม่ได้ (เช่นไม่มี service account ตอน dev)
  useEffect(() => {
    if (initialActivity || !activityCode) {
      setLoadingActivity(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoadingActivity(true);
        const snap = await getDocs(
          query(collection(db, 'activityQRCodes'), where('activityCode', '==', activityCode), limit(1))
        );
        if (cancelled) return;
        if (snap.empty) {
          setActivity(null);
          setFatalError('ไม่พบรหัสกิจกรรมนี้ในระบบ กรุณาสแกน QR Code ใหม่');
        } else {
          const d = snap.docs[0];
          const data: any = d.data();
          setActivity({
            id: d.id,
            activityCode: String(data.activityCode || activityCode),
            activityName: String(data.activityName || activityCode),
            description: String(data.description || ''),
            location: String(data.location || ''),
            latitude: typeof data.latitude === 'number' ? data.latitude : 7.007373,
            longitude: typeof data.longitude === 'number' ? data.longitude : 100.4925,
            checkInRadius: typeof data.checkInRadius === 'number' ? data.checkInRadius : 100,
            userCode: String(data.userCode || ''),
            startDateTime: toDateSafe(data.startDateTime)?.getTime() ?? null,
            endDateTime: toDateSafe(data.endDateTime)?.getTime() ?? null,
            isActive: data.isActive !== false,
            maxParticipants: Number(data.maxParticipants || 0),
            currentParticipants: Number(data.currentParticipants || 0),
            requiresUniversityLogin: Boolean(data.requiresUniversityLogin),
            bannerUrl:
              typeof data.bannerUrl === 'string' &&
              (!data.bannerUrl.startsWith('data:') || data.bannerUrl.length < 450_000)
                ? data.bannerUrl
                : undefined,
            bannerColor: data.bannerColor,
            bannerTintColor: data.bannerTintColor,
            bannerTintOpacity: data.bannerTintOpacity,
            bannerAspect: data.bannerAspect || 'cover',
            singleUserMode: Boolean(data.singleUserMode),
            closeReason: data.closeReason || '',
            dynamicQREnabled: Boolean(data.dynamicQREnabled),
            onsiteRegistrationPoint: data.onsiteRegistrationPoint || '',
            sessions: data.sessions,
            surveyConfig: data.surveyConfig,
            department: data.department,
          });
        }
      } catch {
        if (!cancelled) setFatalError('ไม่สามารถโหลดข้อมูลกิจกรรมได้ กรุณาลองใหม่');
      } finally {
        if (!cancelled) setLoadingActivity(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activityCode, initialActivity]);

  // Realtime sync เฉพาะสถานะ/จำนวนผู้เข้าร่วม (ใช้ 1 listener เท่านั้น ไม่ซ้ำกับฟอร์ม)
  useEffect(() => {
    if (!activity?.id) return;
    const unsub = onSnapshot(doc(db, 'activityQRCodes', activity.id), (snap) => {
      if (!snap.exists()) return;
      const d: any = snap.data();
      setActivity((prev) => {
        if (!prev) return prev;
        const nextCur = Number(d.currentParticipants || 0);
        const nextActive = d.isActive !== false;
        const nextClose = d.closeReason || '';
        const nextMax = Number(d.maxParticipants || 0);
        if (
          prev.currentParticipants === nextCur &&
          prev.isActive === nextActive &&
          prev.closeReason === nextClose &&
          prev.maxParticipants === nextMax
        ) {
          return prev;
        }
        return {
          ...prev,
          currentParticipants: nextCur,
          isActive: nextActive,
          closeReason: nextClose,
          maxParticipants: nextMax,
          sessions: d.sessions ?? prev.sessions,
          surveyConfig: d.surveyConfig ?? prev.surveyConfig,
        };
      });
    });
    return () => unsub();
  }, [activity?.id]);

  // Dynamic QR validation (ทำงานครั้งเดียว + จำสิทธิ์ claim 15 นาทีไว้ข้ามช่วงล็อกอิน)
  useEffect(() => {
    if (!activity?.dynamicQREnabled) {
      setQrChecking(false);
      setQrExpireMeta(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setQrChecking(true);
      const expireCtx = (reason: DynamicQrExpiredContext['reason']): DynamicQrExpiredContext => ({
        dynamicQREnabled: true,
        onsiteRegistrationPoint: activity.onsiteRegistrationPoint,
        location: activity.location,
        reason,
      });

      const stored = readDynamicQrClaim(activity.activityCode);
      let dt = initialDt || '';
      if (!dt && stored?.dt) {
        dt = stored.dt;
      }
      if (!dt) {
        clearDynamicQrClaim(activity.activityCode);
        if (!cancelled) {
          setQrExpireMeta(expireCtx('missing_dt'));
          setQrChecking(false);
        }
        return;
      }
      setDtToken(dt);

      // ถ้ามี claim ที่ยังไม่หมดอายุและตรงกับ dt -> ใช้ได้เลยไม่ต้องรอเซิร์ฟเวอร์ซ้ำ
      if (stored && stored.dt === dt && stored.claim && stored.expiresAt > Date.now()) {
        if (!cancelled) {
          setQrClaim(stored.claim);
          setQrExpireMeta(null);
          setQrChecking(false);
        }
        return;
      }

      try {
        const claimParam =
          stored && stored.dt === dt && stored.claim
            ? `&claim=${encodeURIComponent(stored.claim)}`
            : '';
        const res = await fetch(
          `/api/dynamic-qr/validate?code=${encodeURIComponent(activity.activityCode)}&dt=${encodeURIComponent(dt)}${claimParam}`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        if (cancelled) return;
        if (data?.valid) {
          if (data.claim && data.claimExpiresAt) {
            writeDynamicQrClaim(activity.activityCode, {
              dt,
              claim: String(data.claim),
              expiresAt: Number(data.claimExpiresAt),
            });
            setQrClaim(String(data.claim));
          }
          setQrExpireMeta(null);
        } else {
          clearDynamicQrClaim(activity.activityCode);
          setQrExpireMeta(expireCtx(data?.reason === 'invalid' ? 'invalid' : 'expired'));
        }
      } catch {
        if (!cancelled) setQrExpireMeta(expireCtx('expired'));
      } finally {
        if (!cancelled) setQrChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activity?.activityCode, activity?.dynamicQREnabled, activity?.location, activity?.onsiteRegistrationPoint, initialDt]);

  // ตรวจสอบประวัติลงทะเบียนและแบบประเมินของผู้ใช้ (2 reads แบบขนาน)
  const checkUserRegistration = useCallback(async () => {
    if (!user?.uid || !activity?.activityCode) {
      setHasRegistered(false);
      setCheckedInSessions([]);
      setSurveyCompleted(false);
      return;
    }
    setCheckingRecord(true);
    try {
      const recRef = doc(db, 'activityRecords', `${activity.activityCode}_${user.uid}`);
      const surveyQ = query(
        collection(db, 'surveyResponses'),
        where('activityCode', '==', activity.activityCode),
        where('userId', '==', user.uid),
        limit(1)
      );
      const [recSnap, surveySnap] = await Promise.all([getDoc(recRef), getDocs(surveyQ)]);
      if (recSnap.exists()) {
        const rd: any = recSnap.data();
        setHasRegistered(true);
        setCheckedInSessions(Array.isArray(rd.checkedInSessions) ? rd.checkedInSessions : []);
      } else {
        setHasRegistered(false);
        setCheckedInSessions([]);
      }
      setSurveyCompleted(!surveySnap.empty);
    } catch {
      // ignore
    } finally {
      setCheckingRecord(false);
    }
  }, [user?.uid, activity?.activityCode]);

  useEffect(() => {
    void checkUserRegistration();
  }, [checkUserRegistration]);

  const statusInfo = useMemo(() => (activity ? computeActivityStatus(activity) : null), [activity]);

  const surveyWindow = useMemo(() => {
    const cfg = activity?.surveyConfig;
    return getSurveyWindowStatus({
      enabled: cfg?.enabled,
      questionsLength: cfg?.questions?.length ?? 0,
      openAt: cfg?.openAt,
      closeAt: cfg?.closeAt,
      surveyOpenMinutes: cfg?.surveyOpenMinutes,
      forceOpenUntil: cfg?.forceOpenUntil,
      userForceOpenUntil: cfg?.userForceOpenUntil,
      userId: user?.uid,
      endDateTime: activity?.endDateTime,
      sessions: activity?.sessions || [],
    });
  }, [activity?.surveyConfig, activity?.endDateTime, activity?.sessions, user?.uid]);

  const isCurrentSessionAlreadyCheckedIn = useMemo(() => {
    if (!hasRegistered) return false;
    if (statusInfo?.activeSession) {
      return checkedInSessions.includes(statusInfo.activeSession.id);
    }
    return !activity?.sessions?.length;
  }, [hasRegistered, statusInfo?.activeSession, checkedInSessions, activity?.sessions?.length]);

  const needsProfileSetup = useMemo(
    () => Boolean(user && userData !== null && !isProfileComplete(userData)),
    [user, userData]
  );

  // เปิด ProfileEditDialog อัตโนมัติเมื่อล็อกอินแล้วโปรไฟล์ยังไม่ครบ (Navbar ไม่เปิดซ้ำแล้ว)
  useEffect(() => {
    if (needsProfileSetup) {
      setShowProfileDialog(true);
    }
  }, [needsProfileSetup]);

  const isUniversityOnlyBlocked = useMemo(() => {
    if (!activity?.requiresUniversityLogin || !user?.email) return false;
    return !isUniversityEmail(user.email);
  }, [activity?.requiresUniversityLogin, user?.email]);

  // GPS Check — ผูกกับ primitive lat/lng/radius เท่านั้น ป้องกัน GPS Storm ตอน currentParticipants เปลี่ยน!
  const actLat = activity?.latitude ?? 0;
  const actLng = activity?.longitude ?? 0;
  const actRadius = activity?.checkInRadius ?? 0;
  const needsGps = actRadius > 0 && Number.isFinite(actLat) && Number.isFinite(actLng);

  const triggerGeoCheck = useCallback(() => {
    if (!needsGps) {
      setInRadius(true);
      setGeoLoading(false);
      setGeoError('');
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('อุปกรณ์ของคุณไม่รองรับการระบุตำแหน่ง GPS');
      setInRadius(false);
      return;
    }
    const reqId = ++geoReqRef.current;
    setGeoLoading(true);
    setGeoError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (reqId !== geoReqRef.current) return;
        const { latitude, longitude, accuracy } = pos.coords;
        const dist = Math.round(haversineMeters(latitude, longitude, actLat, actLng));
        const tolerance = Math.min(25, Math.max(0, (accuracy || 0) * 0.25));
        const ok = dist <= actRadius + tolerance;
        setUserPos({ lat: latitude, lng: longitude, accuracy });
        setDistanceM(dist);
        setInRadius(ok);
        setGeoLoading(false);
        if (!ok) setShowMap(true); // แสดงแผนที่ช่วยนำทางอัตโนมัติเมื่ออยู่นอกรัศมี
      },
      (err) => {
        if (reqId !== geoReqRef.current) return;
        setGeoLoading(false);
        setInRadius(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('กรุณาอนุญาตการเข้าถึงตำแหน่ง (Location) ในเบราว์เซอร์แล้วกดลองใหม่');
        } else if (err.code === err.TIMEOUT) {
          setGeoError('ค้นหาสัญญาณ GPS นานเกินไป กรุณาลองอีกครั้งในที่โล่ง');
        } else {
          setGeoError('ไม่สามารถระบุตำแหน่งได้ กรุณาเปิด GPS บนอุปกรณ์แล้วลองใหม่');
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }, [needsGps, actLat, actLng, actRadius]);

  const shouldRunGps = Boolean(
    user &&
      !needsProfileSetup &&
      !isUniversityOnlyBlocked &&
      !checkingRecord &&
      !isCurrentSessionAlreadyCheckedIn &&
      statusInfo?.status === 'active' &&
      !qrExpireMeta
  );

  // เรียกตรวจ GPS อัตโนมัติครั้งเดียวเมื่อพร้อมลงทะเบียน
  const gpsAutoStartedRef = useRef(false);
  useEffect(() => {
    if (!shouldRunGps) {
      gpsAutoStartedRef.current = false;
      return;
    }
    if (gpsAutoStartedRef.current) return;
    gpsAutoStartedRef.current = true;
    triggerGeoCheck();
  }, [shouldRunGps, triggerGeoCheck]);

  const handleLogin = async (provider: 'microsoft' | 'google') => {
    setActionError('');
    setLoginBusy(provider);
    try {
      if (provider === 'microsoft') await login();
      else await loginWithGoogle();
    } catch (e: any) {
      setActionError(mapAuthError(e) || e?.message || 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setLoginBusy(null);
    }
  };

  const handleSaveProfile = async (updatedData: Partial<UniversityUserProfile>) => {
    if (!user?.uid) return;
    await updateUserProfile(user.uid, updatedData);
    await refreshUserData();
    setShowProfileDialog(false);
  };

  const handleSubmitRegistration = async () => {
    if (!activity || !auth?.currentUser) return;
    setActionError('');

    if (needsGps && (!userPos || !inRadius)) {
      setActionError('กรุณาอยู่ในรัศมีพื้นที่กิจกรรมและตรวจพิกัดให้ผ่านก่อนกดยืนยัน');
      return;
    }

    setSubmitting(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          activityCode: activity.activityCode,
          activityDocId: activity.id,
          location: userPos
            ? { latitude: userPos.lat, longitude: userPos.lng, accuracy: userPos.accuracy }
            : null,
          userCode: userCodeInput.trim(),
          dt: dtToken || undefined,
          claim: qrClaim || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        if (json.code === 'ALREADY_REGISTERED') {
          setHasRegistered(true);
          if (statusInfo?.activeSession) {
            setCheckedInSessions((prev) =>
              prev.includes(statusInfo.activeSession!.id)
                ? prev
                : [...prev, statusInfo.activeSession!.id]
            );
          }
          setJustRegisteredMsg('คุณได้ลงทะเบียนกิจกรรมนี้เรียบร้อยแล้ว');
          return;
        }
        setActionError(json.error || 'ไม่สามารถลงทะเบียนได้ กรุณาลองใหม่');
        return;
      }

      setHasRegistered(true);
      if (Array.isArray(json.checkedInSessions)) {
        setCheckedInSessions(json.checkedInSessions);
      }
      setJustRegisteredMsg(
        json.sessionName
          ? `เช็กอินรอบ "${json.sessionName}" สำเร็จเรียบร้อยแล้ว!`
          : 'ลงทะเบียนเข้าร่วมกิจกรรมสำเร็จเรียบร้อยแล้ว!'
      );
    } catch (e: any) {
      setActionError(e?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  };

  /* ============================= Error / Loading Screens ============================= */
  if (!activityCode) {
    return (
      <FullPageError
        variant="warning"
        code="NO_ACTIVITY"
        title="ไม่พบรหัสกิจกรรม"
        message="กรุณาสแกน QR Code จากหน้างาน หรือเลือกกิจกรรมจากหน้ารวมกิจกรรม"
        actions={[{ label: 'ดูกิจกรรมทั้งหมด', href: '/' }]}
      />
    );
  }

  if (loadingActivity) {
    return (
      <div className={cn(pageLayoutClass, 'flex min-h-screen flex-col')}>
        <Navbar />
        <div className="relative isolate mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-3 overflow-hidden px-4 py-16">
          <AuroraBackground grid={false} />
          <ScienceOrbit className="h-28 w-28 animate-float" />
          <p className="animate-blink text-sm font-semibold text-muted-foreground">กำลังโหลดข้อมูลกิจกรรม...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (!activity || fatalError) {
    return (
      <FullPageError
        variant="notfound"
        code="ACTIVITY_NOT_FOUND"
        title="ไม่พบกิจกรรมนี้ในระบบ"
        message={fatalError || 'ลิงก์หรือ QR Code อาจไม่ถูกต้อง หรือกิจกรรมถูกลบออกแล้ว'}
        actions={[{ label: 'กลับหน้าหลัก', href: '/' }]}
      />
    );
  }

  if (qrExpireMeta) {
    return (
      <FullPageError
        variant="expired"
        code="DYNAMIC_QR_EXPIRED"
        title={dynamicQrExpiredTitle(qrExpireMeta)}
        message={dynamicQrExpiredMessage(qrExpireMeta)}
        actions={[{ label: 'กลับหน้าหลัก', href: '/' }]}
      />
    );
  }

  /* ============================= Computed UX Helpers ============================= */
  const stepAuthDone = Boolean(user && !needsProfileSetup && !isUniversityOnlyBlocked);
  const stepGpsDone = stepAuthDone && (!needsGps || inRadius);
  const stepDone = isCurrentSessionAlreadyCheckedIn;

  const seatsLeft =
    activity.maxParticipants > 0
      ? Math.max(0, activity.maxParticipants - activity.currentParticipants)
      : null;

  const canDoSurvey =
    Boolean(user && hasRegistered && !surveyCompleted) &&
    (surveyWindow.label === 'open' || surveyWindow.label === 'forced_open');

  const displayName =
    [userData?.nameTitle, userData?.firstName, userData?.lastName].filter(Boolean).join(' ').trim() ||
    userData?.displayName ||
    user?.displayName ||
    user?.email ||
    '';

  const statusBadgeTone =
    statusInfo?.status === 'active'
      ? 'bg-emerald-500/90 text-white'
      : statusInfo?.status === 'upcoming'
        ? 'bg-sky-500/90 text-white'
        : statusInfo?.status === 'full'
          ? 'bg-amber-500/90 text-white'
          : 'bg-slate-800/80 text-white';

  const statusLabel =
    statusInfo?.status === 'active'
      ? 'เปิดรับลงทะเบียน'
      : statusInfo?.status === 'upcoming'
        ? 'ยังไม่เปิดรับ'
        : statusInfo?.status === 'full'
          ? 'เต็มแล้ว'
          : statusInfo?.status === 'ended'
            ? 'สิ้นสุดแล้ว'
            : 'ปิดรับชั่วคราว';

  return (
    <div className={cn(pageLayoutClass, 'relative flex min-h-screen flex-col')}>
      <Navbar />

      {/* แสงออโรราด้านบนหน้า */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[420px] overflow-hidden">
        <AuroraBackground className="mask-fade-b" />
      </div>

      <main className="relative mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-4 md:pt-6 lg:pb-12">
        {/* 1. Compact Banner + Essential Summary */}
        <Card className={cn(glassCardClass, 'mb-4 animate-fade-up overflow-hidden border-0 p-0 shadow-[var(--page-shadow-lg)]')}>
          <div
            className="relative h-[160px] overflow-hidden sm:h-[200px]"
            style={{
              background: activity.bannerColor
                ? `linear-gradient(135deg, ${activity.bannerColor}, color-mix(in srgb, ${activity.bannerColor} 50%, #050914))`
                : 'linear-gradient(120deg, #0a6bcf, #06b6d4 60%, #10b981)',
            }}
          >
            {activity.bannerUrl ? (
              <>
                <Image
                  src={activity.bannerUrl}
                  alt={activity.activityName}
                  fill
                  priority
                  fetchPriority="high"
                  unoptimized={activity.bannerUrl.startsWith('data:')}
                  sizes="(max-width: 768px) 100vw, 672px"
                  className="animate-[scale-in_1.2s_cubic-bezier(0.16,1,0.3,1)_both]"
                  style={{ objectFit: activity.bannerAspect === 'contain' ? 'contain' : 'cover' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
              </>
            ) : (
              <>
                <div aria-hidden className="absolute inset-0 bg-dots text-white opacity-40" />
                <ScienceOrbit
                  tone="light"
                  className="absolute -right-6 -top-8 h-44 w-44 animate-float opacity-80 sm:h-52 sm:w-52"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              </>
            )}

            <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
              <Badge className={cn('gap-1 border-0 px-2.5 py-1 text-xs font-bold shadow', statusBadgeTone)}>
                {statusInfo?.status === 'active' ? (
                  <PlayCircle className="h-3.5 w-3.5" />
                ) : statusInfo?.status === 'upcoming' ? (
                  <Clock className="h-3.5 w-3.5" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
                {statusLabel}
              </Badge>
              {activity.requiresUniversityLogin && (
                <Badge className="border-0 bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                  เฉพาะบัญชี ม.อ. (@psu.ac.th)
                </Badge>
              )}
            </div>

            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
              <h1 className="line-clamp-2 text-lg font-extrabold leading-snug drop-shadow sm:text-2xl">
                {activity.activityName}
              </h1>
            </div>
          </div>

          <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3.5 text-xs font-semibold text-muted-foreground sm:px-5">
            {activity.location && (
              <span className="inline-flex items-center gap-1.5 text-foreground">
                <MapPin className="h-3.5 w-3.5 text-amber-500" />
                {activity.location}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <CalendarCheck className="h-3.5 w-3.5 text-emerald-500" />
              {formatDateTime(activity.startDateTime)}
            </span>
            {seatsLeft !== null && (
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-sky-500" />
                {activity.currentParticipants}/{activity.maxParticipants} คน
                {seatsLeft > 0 ? ` (เหลือ ${seatsLeft})` : ' (เต็ม)'}
              </span>
            )}
          </CardContent>
        </Card>

        {/* 2. PRIMARY ACTION CARD — อยู่บนสุดทันที (Action-First 1–2 แตะ) */}
        <Card className={cn(glassCardClass, 'mb-5 animate-fade-up border border-primary/15 shadow-md [animation-delay:120ms]')}>
          <CardContent className="space-y-4 p-4 sm:p-6">
            {/* Step Progress Strip */}
            {statusInfo?.status === 'active' && !stepDone && (
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/50 p-2 text-center text-xs font-bold">
                <div
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-lg py-1.5',
                    stepAuthDone ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-primary/10 text-primary'
                  )}
                >
                  {stepAuthDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span>1.</span>}
                  เข้าสู่ระบบ
                </div>
                <div
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-lg py-1.5',
                    stepGpsDone
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                      : stepAuthDone
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground'
                  )}
                >
                  {stepGpsDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span>2.</span>}
                  พิกัด GPS
                </div>
                <div
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-lg py-1.5',
                    stepGpsDone ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                  )}
                >
                  <span>3.</span>
                  ยืนยัน
                </div>
              </div>
            )}

            {actionError && (
              <Alert variant="destructive" className="rounded-xl">
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            )}

            {qrChecking || authLoading || checkingRecord ? (
              <div className="flex items-center justify-center gap-3 py-6 text-sm text-muted-foreground">
                <Spinner size="default" />
                กำลังตรวจสอบสิทธิ์และสถานะการลงทะเบียน...
              </div>
            ) : stepDone ? (
              /* State D: ลงทะเบียน / เช็กอินรอบปัจจุบันสำเร็จแล้ว */
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-extrabold text-emerald-800 dark:text-emerald-300">
                      {justRegisteredMsg || 'ลงทะเบียนเข้าร่วมเรียบร้อยแล้ว'}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      บันทึกข้อมูลของ {displayName} ({userData?.studentId || '-'}) เข้าระบบเรียบร้อยแล้ว
                    </p>
                  </div>
                </div>

                {canDoSurvey && activity.surveyConfig && user && (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3">
                    <SurveyForm
                      activityCode={activity.activityCode}
                      activityDocId={activity.id}
                      surveyConfig={activity.surveyConfig}
                      userId={user.uid}
                      userProfile={{
                        studentId: userData?.studentId,
                        firstName: userData?.firstName,
                        lastName: userData?.lastName,
                        department: userData?.department || userData?.institutionName,
                        email: userData?.email || user.email || '',
                      }}
                      onCompleted={() => {
                        setSurveyCompleted(true);
                        setJustRegisteredMsg('ขอบคุณที่ทำแบบประเมิน! บันทึกเรียบร้อยแล้ว');
                      }}
                    />
                  </div>
                )}

                {surveyCompleted && (
                  <Alert variant="success" className="rounded-xl">
                    <AlertDescription>คุณทำแบบประเมินของกิจกรรมนี้เรียบร้อยแล้ว ขอบคุณครับ</AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button asChild className="h-11 rounded-xl font-bold">
                    <Link href="/my-history">
                      <History className="h-4 w-4" />
                      ดูประวัติและเอกสารของฉัน
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-11 rounded-xl font-bold">
                    <Link href="/">ดูกิจกรรมอื่น</Link>
                  </Button>
                </div>
              </div>
            ) : !user ? (
              /* State A: ยังไม่ได้เข้าสู่ระบบ (แสดงทันทีด้านบนสุด!) */
              <div className="space-y-3">
                <div>
                  <h2 className="text-base font-extrabold">
                    {statusInfo?.status === 'active'
                      ? 'เข้าสู่ระบบเพื่อลงทะเบียน'
                      : 'เข้าสู่ระบบเพื่อตรวจสอบสิทธิ์ / ทำแบบประเมิน'}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {activity.requiresUniversityLogin
                      ? 'กิจกรรมนี้สำหรับนักศึกษาและบุคลากร ม.อ. (@psu.ac.th) เท่านั้น'
                      : 'นักศึกษา/บุคลากร ม.อ. ใช้ Microsoft · บุคคลภายนอกใช้ Google'}
                  </p>
                </div>
                <div className="flex flex-col gap-2.5">
                  <Button
                    size="lg"
                    disabled={loginBusy !== null}
                    onClick={() => handleLogin('microsoft')}
                    className="h-12 w-full justify-center gap-2.5 rounded-xl bg-[#0071e3] text-sm font-bold text-white shadow-sm hover:bg-[#0063c7]"
                  >
                    {loginBusy === 'microsoft' ? <Spinner size="sm" className="text-white" /> : <MicrosoftLogo />}
                    เข้าสู่ระบบด้วย PSU Microsoft (@psu.ac.th)
                  </Button>
                  {!activity.requiresUniversityLogin && (
                    <Button
                      size="lg"
                      variant="outline"
                      disabled={loginBusy !== null}
                      onClick={() => handleLogin('google')}
                      className="h-12 w-full justify-center gap-2.5 rounded-xl border-border text-sm font-bold"
                    >
                      {loginBusy === 'google' ? <Spinner size="sm" /> : <GoogleLogo />}
                      เข้าสู่ระบบด้วย Google (นักเรียน / บุคคลภายนอก)
                    </Button>
                  )}
                </div>
              </div>
            ) : isUniversityOnlyBlocked ? (
              /* State B: ใช้บัญชีนอก ม.อ. กับกิจกรรมเฉพาะ ม.อ. */
              <div className="space-y-3">
                <Alert variant="destructive" className="rounded-xl">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle>ต้องใช้บัญชีมหาวิทยาลัย (@psu.ac.th)</AlertTitle>
                  <AlertDescription>
                    บัญชีปัจจุบัน ({user.email}) ไม่ใช่บัญชี @psu.ac.th กรุณาสลับไปใช้บัญชี PSU Microsoft
                  </AlertDescription>
                </Alert>
                <Button variant="outline" className="w-full rounded-xl font-bold" onClick={logout}>
                  <LogOut className="h-4 w-4" />
                  ออกจากระบบเพื่อสลับบัญชี
                </Button>
              </div>
            ) : needsProfileSetup ? (
              /* State C: โปรไฟล์ยังไม่ครบ */
              <div className="space-y-3">
                <Alert variant="warning" className="rounded-xl">
                  <AlertTitle>กรุณากรอกข้อมูลโปรไฟล์ให้ครบก่อนลงทะเบียน</AlertTitle>
                  <AlertDescription>
                    กรอกเพียงครั้งเดียว ระบบจะจำข้อมูลไว้ใช้ลงทะเบียนกิจกรรมถัดไปอัตโนมัติใน 1 แตะ
                  </AlertDescription>
                </Alert>
                <Button
                  size="lg"
                  className="h-12 w-full rounded-xl font-bold"
                  onClick={() => setShowProfileDialog(true)}
                >
                  <Pencil className="h-4 w-4" />
                  กรอกข้อมูลโปรไฟล์
                </Button>
              </div>
            ) : statusInfo?.status !== 'active' ? (
              /* กิจกรรมยังไม่เปิด / เต็ม / ปิดแล้ว — แต่ถ้าเปิดแบบประเมินให้ทำได้เลย */
              <div className="space-y-4">
                <Alert
                  variant={statusInfo?.status === 'upcoming' ? 'info' : 'warning'}
                  className="rounded-xl"
                >
                  <AlertTitle>{statusLabel}</AlertTitle>
                  <AlertDescription>{statusInfo?.message}</AlertDescription>
                </Alert>
                {canDoSurvey && activity.surveyConfig && (
                  <SurveyForm
                    activityCode={activity.activityCode}
                    activityDocId={activity.id}
                    surveyConfig={activity.surveyConfig}
                    userId={user.uid}
                    userProfile={{
                      studentId: userData?.studentId,
                      firstName: userData?.firstName,
                      lastName: userData?.lastName,
                      department: userData?.department || userData?.institutionName,
                      email: userData?.email || user.email || '',
                    }}
                    onCompleted={() => {
                      setSurveyCompleted(true);
                      setJustRegisteredMsg('ขอบคุณที่ทำแบบประเมิน! บันทึกเรียบร้อยแล้ว');
                    }}
                  />
                )}
              </div>
            ) : (
              /* State E: พร้อมลงทะเบียน 1-Tap Check-In! */
              <div className="space-y-4">
                {/* 1) Profile Summary Strip (กระชับ 1 กล่อง แทนฟอร์ม 8 ช่องซ้ำซ้อน) */}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/35 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-foreground">{displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {userData?.studentId || '-'} ·{' '}
                      {userData?.userType === 'external'
                        ? userData?.institutionName || 'บุคคลภายนอก'
                        : [userData?.faculty, userData?.department]
                            .filter((v): v is string => Boolean(v && v !== 'ไม่ระบุ'))
                            .join(' / ') || 'ม.อ.'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 rounded-lg text-xs font-bold"
                    onClick={() => setShowProfileDialog(true)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    แก้ไข
                  </Button>
                </div>

                {/* 2) GPS Verification Strip (ตรวจครั้งเดียว + เปิดแผนที่เฉพาะเมื่อกดหรืออยู่นอกรัศมี) */}
                {needsGps && (
                  <div
                    className={cn(
                      'rounded-xl border p-3',
                      geoLoading
                        ? 'border-sky-500/30 bg-sky-500/5'
                        : inRadius
                          ? 'border-emerald-500/30 bg-emerald-500/10'
                          : 'border-amber-500/40 bg-amber-500/10'
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        {geoLoading ? (
                          <Spinner size="sm" />
                        ) : inRadius ? (
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                        ) : (
                          <Crosshair className="h-5 w-5 shrink-0 text-amber-600" />
                        )}
                        <div>
                          <p className="text-sm font-bold">
                            {geoLoading
                              ? 'กำลังตรวจสอบพิกัด GPS...'
                              : geoError
                                ? 'ยังไม่ได้รับพิกัด GPS'
                                : inRadius
                                  ? 'อยู่ในพื้นที่กิจกรรม — พร้อมลงทะเบียน'
                                  : 'อยู่นอกพื้นที่ที่กำหนด'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {geoError
                              ? geoError
                              : typeof distanceM === 'number'
                                ? `ห่างจากจุดเช็กอินประมาณ ${distanceM} ม. (รัศมี ${actRadius} ม.)`
                                : `ต้องอยู่ในรัศมี ${actRadius} เมตร`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={geoLoading}
                          onClick={triggerGeoCheck}
                          className="h-8 rounded-lg px-2.5 text-xs font-bold"
                        >
                          <RefreshCw className={cn('h-3.5 w-3.5', geoLoading && 'animate-spin')} />
                          ตรวจใหม่
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowMap((v) => !v)}
                          className="h-8 rounded-lg px-2.5 text-xs font-bold"
                        >
                          <MapIcon className="h-3.5 w-3.5" />
                          {showMap ? 'ซ่อนแผนที่' : 'ดูแผนที่'}
                        </Button>
                      </div>
                    </div>

                    {showMap && (
                      <div className="mt-3">
                        <GeofenceMap
                          center={{ lat: actLat, lng: actLng }}
                          radius={actRadius}
                          userPos={userPos}
                          inRadius={inRadius}
                          onUseCurrentLocation={triggerGeoCheck}
                          title={activity.activityName}
                          height={280}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* 3) 1-Tap Submit CTA */}
                <Button
                  type="button"
                  size="lg"
                  disabled={submitting || (needsGps && (!inRadius || geoLoading))}
                  onClick={handleSubmitRegistration}
                  className="h-13 w-full rounded-xl bg-[#0071e3] text-base font-extrabold text-white shadow-[0_6px_20px_rgba(0,113,227,0.32)] transition-all hover:bg-[#0063c7] disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Spinner size="sm" className="text-white" />
                      กำลังบันทึกการลงทะเบียน...
                    </>
                  ) : statusInfo?.activeSession ? (
                    `ยืนยันเช็กอินรอบ: ${statusInfo.activeSession.name}`
                  ) : (
                    'ยืนยันลงทะเบียนเข้าร่วมกิจกรรม'
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. Multi-session timeline (ถ้ามีหลายรอบ) */}
        {Array.isArray(activity.sessions) && activity.sessions.length > 0 && (
          <Card className={cn(glassCardClass, 'mb-4 border-0 shadow-sm')}>
            <CardContent className="space-y-2.5 p-4 sm:p-5">
              <div className="flex items-center gap-2 text-sm font-extrabold">
                <LayoutList className="h-4 w-4 text-primary" />
                รอบกิจกรรมย่อย ({activity.sessions.length} รอบ)
              </div>
              <div className="space-y-2">
                {activity.sessions.map((s: any, idx: number) => {
                  const done = checkedInSessions.includes(s.id);
                  return (
                    <div
                      key={s.id || idx}
                      className={cn(
                        'flex items-center justify-between gap-3 rounded-xl border p-3 text-sm',
                        done ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-border bg-background/60'
                      )}
                    >
                      <div className="min-w-0">
                        <p className="font-bold">{s.name || `รอบที่ ${idx + 1}`}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(s.startDateTime)} – {formatDateTime(s.endDateTime)}
                        </p>
                      </div>
                      <Badge variant={done ? 'success' : 'secondary'} className="shrink-0">
                        {done ? 'เช็กอินแล้ว' : 'ยังไม่เช็กอิน'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 4. รายละเอียดกิจกรรม (อยู่ด้านล่าง Action Card เพื่อไม่ขวางการเช็กอิน) */}
        <Card className={cn(glassCardClass, 'border-0 shadow-sm')}>
          <CardContent className="p-4 sm:p-5">
            <button
              type="button"
              onClick={() => setShowFullDetails((v) => !v)}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-extrabold">
                <FileText className="h-4 w-4 text-primary" />
                รายละเอียดและกำหนดการกิจกรรม
              </span>
              {showFullDetails ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            <div className={cn('mt-3 space-y-3', !showFullDetails && 'hidden sm:block')}>
              <div className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
                <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-2.5">
                  <CalendarCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                  <div>
                    <p className="text-muted-foreground">เริ่มกิจกรรม</p>
                    <p className="font-bold text-foreground">{formatDateTime(activity.startDateTime)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-2.5">
                  <CalendarX className="h-4 w-4 shrink-0 text-rose-500" />
                  <div>
                    <p className="text-muted-foreground">สิ้นสุดกิจกรรม</p>
                    <p className="font-bold text-foreground">{formatDateTime(activity.endDateTime)}</p>
                  </div>
                </div>
              </div>

              {needsGps && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Radar className="h-3.5 w-3.5" />
                  จุดเช็กอิน: {activity.location || 'ตามพิกัดที่กำหนด'} (รัศมี {actRadius} เมตร)
                </div>
              )}

              {activity.description ? (
                <div
                  className="prose prose-sm max-w-none border-t border-border pt-3 text-sm leading-relaxed text-muted-foreground dark:prose-invert [&_a]:text-primary [&_a]:underline [&_img]:max-w-full [&_img]:rounded-xl [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
                  dangerouslySetInnerHTML={{ __html: activity.description }}
                />
              ) : (
                <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                  ไม่มีคำอธิบายเพิ่มเติม
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </main>

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

      <Footer />
    </div>
  );
}
