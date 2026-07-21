// src/components/MicrosoftLogin.tsx
'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
  User as PersonIcon,
  LogOut as LogoutIcon,
  BadgeCheck as VerifiedIcon,
  Ban as BlockIcon,
  Clock as TimeIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { glassCardClass } from '../lib/uiTheme';
import { cn } from '@/lib/utils';

import {
  signInWithPopup,
  signInWithRedirect,
  setPersistence,
  browserLocalPersistence,
  signOut,
  onAuthStateChanged,
  User,
  OAuthProvider,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { SessionManager } from '../lib/sessionManager';
import { mapAuthError } from '../lib/firebaseAuth';

/* =========================
   Types
========================= */
interface UniversityUserData {
  uid: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  studentId: string;
  degreeLevel: string;
  department: string;
  faculty: string;
  photoURL?: string;
  isActive: boolean;
  isVerified?: boolean;
  createdAt: any;
  updatedAt: any;
  lastLoginAt: any;
}

interface MicrosoftLoginProps {
  onLoginSuccess?: (userData: UniversityUserData) => void;
  onLoginError?: (error: string) => void;
  onLogout?: () => void;
  onPreLoginCheck?: (email: string) => Promise<boolean>;
  onSessionExpired?: () => void;
  redirectAfterLogin?: boolean;
  disabled?: boolean;
}

/* =========================
   Small inline Microsoft Logo
========================= */
const MicrosoftLogo: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 23 23"
    className="overflow-visible rounded-sm"
    aria-hidden
  >
    <rect x="0" y="0" width="10.5" height="10.5" fill="#F25022" rx="1" />
    <rect x="12.5" y="0" width="10.5" height="10.5" fill="#7FBA00" rx="1" />
    <rect x="0" y="12.5" width="10.5" height="10.5" fill="#00A4EF" rx="1" />
    <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900" rx="1" />
  </svg>
);

const isInAppBrowser = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Line|FBAN|FBAV|Instagram|Twitter|TikTok|WebView|wv/i.test(ua);
};

const MicrosoftLogin: React.FC<MicrosoftLoginProps> = ({
  onLoginSuccess,
  onLoginError,
  onLogout,
  onPreLoginCheck,
  onSessionExpired,
  disabled = false,
}) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UniversityUserData | null>(null);

  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState('');

  const [sessionValid, setSessionValid] = useState(true);
  const [sessionRemainingTime, setSessionRemainingTime] = useState(0);
  const [sessionInitialized, setSessionInitialized] = useState(false);

  const loginInProgressRef = useRef(false);
  const sessionCheckIntervalRef = useRef<number | null>(null);
  const hasCheckedExistingSessionRef = useRef(false);
  const activityThrottleRef = useRef<number>(0);
  const currentIpRef = useRef<string>('');

  const getUserIP = async (): Promise<string> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  };

  const formatTimeRemaining = (minutes: number): string =>
    minutes <= 0
      ? '0 นาที'
      : minutes >= 60
      ? `${Math.floor(minutes / 60)} ชั่วโมง ${minutes % 60} นาที`
      : `${minutes} นาที`;

  const getTimeProgressValue = (): number => (sessionRemainingTime / 30) * 100;

  const loadUserData = async (uid: string) => {
    try {
      const userDocRef = doc(db, 'universityUsers', uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const data = userDoc.data() as UniversityUserData;
        setUserData(data);
        onLoginSuccess?.(data);
      }
    } catch {
      // ignore
    }
  };

  const extractStudentInfoFromEmail = (email: string) => {
    const studentId = email.split('@')[0];

    let degreeLevel = 'ไม่ระบุ';
    let department = 'ไม่ระบุ';
    let faculty = 'ไม่ระบุ';

    if (studentId.length >= 8) {
      const facultyCode = studentId.substring(2, 4);
      const deptCode = studentId.substring(4, 6);

      const facultyMap: Record<string, string> = {
        '01': 'คณะวิศวกรรมศาสตร์',
        '02': 'คณะวิทยาศาสตร์',
        '03': 'คณะมนุษยศาสตร์',
        '04': 'คณะสังคมศาสตร์',
        '05': 'คณะแพทยศาสตร์',
        '06': 'คณะพยาบาลศาสตร์',
        '07': 'คณะเทคโนโลยีสารสนเทศ',
        '08': 'คณะบริหารธุรกิจ',
      };

      const departmentMap: Record<string, string> = {
        '01': 'วิศวกรรมคอมพิวเตอร์',
        '02': 'วิศวกรรมไฟฟ้า',
        '03': 'วิศวกรรมเครื่องกล',
        '04': 'คณิตศาสตร์',
        '05': 'ฟิสิกส์',
        '06': 'เคมี',
        '07': 'ภาษาอังกฤษ',
        '08': 'ภาษาไทย',
      };

      faculty = facultyMap[facultyCode] || 'ไม่ระบุ';
      department = departmentMap[deptCode] || 'ไม่ระบุ';

      if (/^(64|65|66|67)/.test(studentId)) degreeLevel = 'ปริญญาตรี';
      else if (studentId.startsWith('M')) degreeLevel = 'ปริญญาโท';
      else if (studentId.startsWith('D')) degreeLevel = 'ปริญญาเอก';
    }

    return { studentId, degreeLevel, department, faculty };
  };

  const resetSessionState = () => {
    setSessionInitialized(false);
    setSessionValid(true);
    setSessionRemainingTime(0);
    hasCheckedExistingSessionRef.current = false;
    loginInProgressRef.current = false;
  };

  const checkExistingSession = async (userId: string) => {
    try {
      const email = auth.currentUser?.email || '';
      const sessionResult = await SessionManager.ensureSession(userId, email);

      if (sessionResult.isValid) {
        setSessionValid(true);
        setSessionRemainingTime(sessionResult.remainingTime || 0);
        setSessionInitialized(true);
        startSessionMonitoring(userId);
      } else {
        setSessionValid(false);
        setSessionInitialized(false);
      }
    } catch {
      setSessionValid(false);
      setSessionInitialized(false);
    }
  };

  const createSessionAndInitialize = async (userId: string, email: string) => {
    try {
      const userIP = await getUserIP();
      currentIpRef.current = userIP;

      const res = await SessionManager.createSession(userId, email, userIP);
      if (!('success' in res) || !res.success) {
        if ((res as any).blocked) {
          const wait = (res as any).waitMinutes ?? 30;
          const msg = `IP นี้เพิ่งมีการเข้าสู่ระบบด้วยบัญชีอื่นแล้ว กรุณารออีก ${wait} นาที`;
          setError(msg);
          await signOut(auth);
          onLoginError?.(msg);
          return;
        }
        const msg = (res as any).message || 'ไม่สามารถสร้างเซสชันได้';
        setError(msg);
        await signOut(auth);
        onLoginError?.(msg);
        return;
      }

      const sessionResult = await SessionManager.validateSession(userId);
      if (sessionResult.isValid) {
        setSessionValid(true);
        setSessionRemainingTime(sessionResult.remainingTime || 30);
        setSessionInitialized(true);
        startSessionMonitoring(userId);
      } else {
        setSessionValid(false);
        setSessionInitialized(false);
      }
    } catch {
      setError('เข้าสู่ระบบสำเร็จ แต่เกิดข้อผิดพลาดในการสร้างเซสชัน');
    }
  };

  const startSessionMonitoring = (userId: string) => {
    if (sessionCheckIntervalRef.current) {
      window.clearInterval(sessionCheckIntervalRef.current);
    }
    sessionCheckIntervalRef.current = window.setInterval(async () => {
      try {
        const res = await SessionManager.validateSession(userId);
        if (!res.isValid) {
          setSessionValid(false);
          handleSessionExpiredInternal(res.message);
          return;
        }
        setSessionRemainingTime(res.remainingTime || 0);
      } catch {
        /* noop */
      }
    }, 60_000);

    const activityHandler = () => {
      const now = Date.now();
      if (now - activityThrottleRef.current < 60_000) return;
      activityThrottleRef.current = now;
      SessionManager.touch(userId, currentIpRef.current).catch(() => {});
    };

    const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, activityHandler, { passive: true }));

    (window as any).__msAuthActivityCleanup = () => {
      events.forEach((ev) => window.removeEventListener(ev, activityHandler));
    };
  };

  const stopSessionMonitoring = () => {
    if (sessionCheckIntervalRef.current) {
      window.clearInterval(sessionCheckIntervalRef.current);
      sessionCheckIntervalRef.current = null;
    }
    if ((window as any).__msAuthActivityCleanup) {
      try {
        (window as any).__msAuthActivityCleanup();
      } catch {}
      (window as any).__msAuthActivityCleanup = undefined;
    }
  };

  const handleSessionExpiredInternal = async (message?: string) => {
    try {
      stopSessionMonitoring();
      await signOut(auth);
      resetSessionState();
      setUser(null);
      setUserData(null);
      if (message) setError(message);
      onSessionExpired?.();
    } catch {
      /* noop */
    }
  };

  const handleSuccessfulLogin = async (firebaseUser: User) => {
    const { studentId, degreeLevel, department, faculty } = extractStudentInfoFromEmail(firebaseUser.email!);
    const nameParts = (firebaseUser.displayName || '').split(' ');
    const firstName = nameParts[0] || 'ไม่ระบุ';
    const lastName = nameParts.slice(1).join(' ') || 'ไม่ระบุ';

    const userDocRef = doc(db, 'universityUsers', firebaseUser.uid);
    const existingUser = await getDoc(userDocRef);

    let finalUserData: UniversityUserData;

    if (existingUser.exists()) {
      const existing = existingUser.data() as UniversityUserData;

      if (existing.isActive === false) {
        await signOut(auth);
        const msg = 'บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ';
        setError(msg);
        onLoginError?.(msg);
        return;
      }

      finalUserData = {
        ...existing,
        displayName: firebaseUser.displayName || existing.displayName,
        photoURL: firebaseUser.photoURL || existing.photoURL,
        userType: (existing as any).userType || 'university',
        authProvider: 'microsoft',
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      } as UniversityUserData;
      await setDoc(userDocRef, finalUserData, { merge: true });
    } else {
      finalUserData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email!,
        displayName: firebaseUser.displayName || '',
        firstName,
        lastName,
        studentId,
        degreeLevel,
        department,
        faculty,
        userType: 'university',
        authProvider: 'microsoft',
        photoURL: firebaseUser.photoURL || '',
        isActive: true,
        isVerified: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      } as UniversityUserData;
      await setDoc(userDocRef, finalUserData);
    }

    await createSessionAndInitialize(firebaseUser.uid, firebaseUser.email!);

    setUserData(finalUserData);
    onLoginSuccess?.(finalUserData);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);

      if (firebaseUser) {
        setUser(firebaseUser);
        await loadUserData(firebaseUser.uid);

        if (loginInProgressRef.current) {
          setSessionValid(true);
        } else if (!hasCheckedExistingSessionRef.current) {
          hasCheckedExistingSessionRef.current = true;
          await checkExistingSession(firebaseUser.uid);
        }
      } else {
        setUser(null);
        setUserData(null);
        stopSessionMonitoring();
        resetSessionState();
      }

      setLoading(false);
    });

    return () => {
      unsub();
      stopSessionMonitoring();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch {
        // ignore
      }
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleMicrosoftLogin = async () => {
    try {
      setLoginLoading(true);
      setError('');
      loginInProgressRef.current = true;

      if (isInAppBrowser()) {
        const msg =
          'เบราว์เซอร์ในแอป (LINE/FB/IG) อาจทำให้เข้าสู่ระบบล้มเหลว กรุณาเปิดลิงก์นี้ใน Chrome/Safari แล้วลองใหม่';
        setError(msg);
        onLoginError?.(msg);
        return;
      }

      await setPersistence(auth, browserLocalPersistence);

      const provider = new OAuthProvider('microsoft.com');
      provider.addScope('openid');
      provider.addScope('email');
      provider.addScope('profile');
      provider.setCustomParameters({ prompt: 'select_account' });

      let firebaseUser: User | null = null;

      try {
        const result = await signInWithPopup(auth, provider);
        firebaseUser = result.user;
      } catch (err: any) {
        const code = err?.code as string | undefined;

        const shouldFallbackToRedirect =
          code === 'auth/popup-blocked' ||
          code === 'auth/popup-closed-by-user' ||
          code === 'auth/cancelled-popup-request' ||
          code === 'auth/operation-not-supported-in-this-environment' ||
          code === 'auth/web-storage-unsupported';

        if (!shouldFallbackToRedirect) throw err;

        await signInWithRedirect(auth, provider);
        return;
      }

      if (!firebaseUser) return;

      if (!firebaseUser.email?.endsWith('@psu.ac.th')) {
        await signOut(auth);
        const msg = 'กรุณาใช้บัญชี Microsoft ของมหาวิทยาลัยเท่านั้น (@psu.ac.th)';
        setError(msg);
        onLoginError?.(msg);
        return;
      }

      if (onPreLoginCheck) {
        const canProceed = await onPreLoginCheck(firebaseUser.email || '');
        if (!canProceed) {
          await signOut(auth);
          return;
        }
      }

      await handleSuccessfulLogin(firebaseUser);
    } catch (err: any) {
      const msg = mapAuthError(err);
      if (msg) {
        setError(msg);
        onLoginError?.(msg);
      }
    } finally {
      setLoginLoading(false);
      loginInProgressRef.current = false;
    }
  };

  const handleLogout = async () => {
    try {
      if (user?.uid) await SessionManager.destroySession(user.uid);
      stopSessionMonitoring();
      await signOut(auth);
      resetSessionState();
      setUser(null);
      setUserData(null);
      setError('');
      onLogout?.();
    } catch {
      setError('เกิดข้อผิดพลาดในการออกจากระบบ');
    }
  };

  const getStatusInfo = () => {
    if (!userData)
      return { text: 'ไม่มีข้อมูล', variant: 'secondary' as const, icon: <PersonIcon className="h-3.5 w-3.5" /> };
    if (!userData.isActive)
      return { text: 'บัญชีถูกระงับ', variant: 'destructive' as const, icon: <BlockIcon className="h-3.5 w-3.5" /> };
    return { text: 'บัญชีใช้งานได้', variant: 'success' as const, icon: <VerifiedIcon className="h-3.5 w-3.5" /> };
  };

  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="flex items-center gap-3 py-6">
          <Spinner />
          <p>กำลังตรวจสอบสถานะการเข้าสู่ระบบ...</p>
        </CardContent>
      </Card>
    );
  }

  if (user && userData && sessionValid) {
    const statusInfo = getStatusInfo();

    return (
      <Card className={cn(glassCardClass, 'mb-6 overflow-hidden border-0 shadow-none')}>
        <div className="flex items-center gap-4 border-b border-border/50 bg-primary/5 px-5 py-4">
          <Avatar className="h-14 w-14">
            <AvatarImage src={userData.photoURL} alt="" />
            <AvatarFallback>{userData.firstName?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{userData.displayName}</p>
            <p className="truncate text-sm text-muted-foreground">{userData.email}</p>
          </div>
          <Badge variant={statusInfo.variant} className="gap-1 font-semibold shrink-0">
            {statusInfo.icon}
            {statusInfo.text}
          </Badge>
        </div>

        <CardContent className="pt-5">
          {sessionInitialized && (
            <div className="mb-5 rounded-xl border border-border/60 bg-primary/[0.04] p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TimeIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">เวลาเซสชันที่เหลือ</span>
                </div>
                <span className="text-sm font-medium">{formatTimeRemaining(sessionRemainingTime)}</span>
              </div>
              <Progress value={getTimeProgressValue()} className="h-1.5" />
              <p className="mt-2 text-xs text-muted-foreground">
                จะออกจากระบบอัตโนมัติหากไม่มีการใช้งาน 30 นาที
              </p>
            </div>
          )}

          <div className="mb-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <PersonIcon className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm">
                ระดับ: <b>{userData.degreeLevel}</b>
              </p>
            </div>
            <p className="text-sm text-muted-foreground">คณะ: {userData.faculty}</p>
            <p className="text-sm text-muted-foreground">สาขา: {userData.department}</p>
          </div>

          <Separator className="my-4" />

          <Button
            variant="outline"
            className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
            disabled={disabled}
          >
            <LogoutIcon className="h-4 w-4" />
            ออกจากระบบ
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (user && userData && !sessionValid) {
    return (
      <Card className="mb-6 rounded-xl">
        <CardContent className="pt-6">
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>เซสชันหมดอายุแล้ว</AlertTitle>
            <AlertDescription>กรุณาเข้าสู่ระบบใหม่เพื่อดำเนินการต่อ</AlertDescription>
          </Alert>

          <Button
            size="lg"
            className="w-full rounded-xl bg-[#0078d4] py-3 hover:bg-[#106ebe]"
            onClick={handleMicrosoftLogin}
            disabled={disabled || loginLoading}
          >
            <MicrosoftLogo />
            {loginLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบใหม่ด้วย Microsoft'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(glassCardClass, 'mb-6 overflow-hidden border-0 shadow-none')}>
      <div
        className={cn(
          'border-b border-border/50 bg-primary/[0.04] px-6 text-center',
          isMobile ? 'py-6' : 'py-8'
        )}
      >
        <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-xl border border-border/40 bg-white/90 shadow-md dark:bg-background">
          <MicrosoftLogo size={28} />
        </div>
        <h3 className="text-lg font-extrabold">เข้าสู่ระบบด้วยบัญชีมหาวิทยาลัย</h3>
        <p className="text-sm text-muted-foreground">
          ใช้บัญชี Microsoft ของมหาวิทยาลัย (@psu.ac.th)
        </p>
      </div>

      <CardContent className="pt-6">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              {error}
              {String(error).toLowerCase().includes('missing initial state') && (
                <span className="mt-1 block text-xs">
                  แนะนำ: อย่าเปิดผ่าน LINE/FB/IG ให้เปิดด้วย Chrome/Safari แล้วลองใหม่
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        <Button
          size="lg"
          className="w-full rounded-xl bg-[#0078d4] py-3.5 hover:bg-[#106ebe] disabled:bg-muted"
          onClick={handleMicrosoftLogin}
          disabled={loginLoading || disabled}
        >
          {loginLoading ? <Spinner size="sm" className="text-white" /> : <MicrosoftLogo />}
          {loginLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย Microsoft'}
        </Button>

        <Accordion type="single" collapsible className="mt-4 rounded-xl border border-border/50 px-3">
          <AccordionItem value="tips" className="border-0">
            <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
              คำแนะนำ & นโยบายเซสชัน
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              <Alert variant="info">
                <AlertDescription>กรุณาใช้อีเมล @psu.ac.th เท่านั้น</AlertDescription>
              </Alert>
              <Alert variant="warning">
                <AlertDescription>
                  ระบบจะออกจากระบบอัตโนมัติเมื่อไม่มีการใช้งาน 30 นาที (ไม่มีปุ่มขยายเวลา)
                </AlertDescription>
              </Alert>
              <Alert variant="info">
                <AlertDescription>
                  ถ้าระบบแจ้งว่า “เปิด popup ไม่ได้” หรือเปิดผ่าน LINE/FB/IG ให้เปิดลิงก์นี้ใน Chrome/Safari แล้วลองใหม่
                </AlertDescription>
              </Alert>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <p className="mt-4 block text-center text-xs text-muted-foreground">
          ระบบจะบันทึกข้อมูลที่จำเป็นเพื่อใช้งานการลงทะเบียนกิจกรรม และล็อกการใช้งาน 1 บัญชีต่อ 1 IP ชั่วคราว 30 นาที
        </p>
      </CardContent>
    </Card>
  );
};

export default MicrosoftLogin;
