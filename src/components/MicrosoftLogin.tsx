// src/components/MicrosoftLogin.tsx
'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  CircularProgress,
  Avatar,
  Divider,
  Stack,
  Chip,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Person as PersonIcon,
  Logout as LogoutIcon,
  Verified as VerifiedIcon,
  Block as BlockIcon,
  AccessTime as TimeIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';

import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
  OAuthProvider,
  AuthError,
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
  <Box component="svg" viewBox="0 0 23 23" sx={{ width: size, height: size, borderRadius: 0.5, overflow: 'visible' }}>
    <rect x="0" y="0" width="10.5" height="10.5" fill="#F25022" rx="1" />
    <rect x="12.5" y="0" width="10.5" height="10.5" fill="#7FBA00" rx="1" />
    <rect x="0" y="12.5" width="10.5" height="10.5" fill="#00A4EF" rx="1" />
    <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900" rx="1" />
  </Box>
);

/* =========================
   Component
========================= */
const MicrosoftLogin: React.FC<MicrosoftLoginProps> = ({
  onLoginSuccess,
  onLoginError,
  onLogout,
  onPreLoginCheck,
  onSessionExpired,
  disabled = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UniversityUserData | null>(null);

  // loading & errors
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState('');

  // session state
  const [sessionValid, setSessionValid] = useState(true);
  const [sessionRemainingTime, setSessionRemainingTime] = useState(0);
  const [sessionInitialized, setSessionInitialized] = useState(false);

  // refs
  const loginInProgressRef = useRef(false);
  const sessionCheckIntervalRef = useRef<number | null>(null);
  const hasCheckedExistingSessionRef = useRef(false);
  const activityThrottleRef = useRef<number>(0);
  const currentIpRef = useRef<string>('');

  /* =========================
     Utils
  ========================= */
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

  /* =========================
     Effects - auth state
  ========================= */
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

  const resetSessionState = () => {
    setSessionInitialized(false);
    setSessionValid(true);
    setSessionRemainingTime(0);
    hasCheckedExistingSessionRef.current = false;
    loginInProgressRef.current = false;
  };

  /* =========================
     Session helpers
  ========================= */
  const checkExistingSession = async (userId: string) => {
    try {
      const sessionResult = await SessionManager.validateSession(userId);

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
    // periodic validity check
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

    // real activity listeners → slide expiry via touch()
    const activityHandler = () => {
      const now = Date.now();
      if (now - activityThrottleRef.current < 60_000) return; // throttle 1/min
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

  /* =========================
     Firestore helpers
  ========================= */
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

  /* =========================
     Auth flows
  ========================= */
  const handleMicrosoftLogin = async () => {
    let attemptedEmail = '';
    try {
      setLoginLoading(true);
      setError('');
      loginInProgressRef.current = true;

      const provider = new OAuthProvider('microsoft.com');
      provider.addScope('openid');
      provider.addScope('email');
      provider.addScope('profile');
      provider.setCustomParameters({ prompt: 'select_account', response_mode: 'fragment' });

      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;

      attemptedEmail = firebaseUser.email || '';

      if (!firebaseUser.email?.endsWith('@psu.ac.th')) {
        await signOut(auth);
        setError('กรุณาใช้บัญชี Microsoft ของมหาวิทยาลัยเท่านั้น (@psu.ac.th)');
        return;
      }

      if (onPreLoginCheck) {
        const canProceed = await onPreLoginCheck(firebaseUser.email);
        if (!canProceed) {
          await signOut(auth);
          return;
        }
      }

      await handleSuccessfulLogin(firebaseUser);
    } catch (err: any) {
      // แปลงเป็นข้อความกลาง (ไม่มี “บัญชีมีอยู่แล้ว…”)
      const msg = mapAuthError(err);
      setError(msg);
      onLoginError?.(msg);
    } finally {
      setLoginLoading(false);
      loginInProgressRef.current = false;
    }
  };

  const handleSuccessfulLogin = async (firebaseUser: User) => {
    const { studentId, degreeLevel, department, faculty } = extractStudentInfoFromEmail(
      firebaseUser.email!
    );
    const nameParts = (firebaseUser.displayName || '').split(' ');
    const firstName = nameParts[0] || 'ไม่ระบุ';
    const lastName = nameParts.slice(1).join(' ') || 'ไม่ระบุ';

    const userDocRef = doc(db, 'universityUsers', firebaseUser.uid);
    const existingUser = await getDoc(userDocRef);

    let finalUserData: UniversityUserData;
    if (existingUser.exists()) {
      const existing = existingUser.data() as UniversityUserData;
      finalUserData = {
        ...existing,
        displayName: firebaseUser.displayName || existing.displayName,
        photoURL: firebaseUser.photoURL || existing.photoURL,
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        isActive: true,
        isVerified: true,
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
      return { text: 'ไม่มีข้อมูล', color: 'default' as const, icon: <PersonIcon fontSize="small" /> };
    if (!userData.isActive)
      return { text: 'บัญชีถูกระงับ', color: 'error' as const, icon: <BlockIcon fontSize="small" /> };
    return { text: 'บัญชีใช้งานได้', color: 'success' as const, icon: <VerifiedIcon fontSize="small" /> };
  };

  /* =========================
     Renders
  ========================= */
  if (loading) {
    return (
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 3 }}>
          <CircularProgress size={22} />
          <Typography>กำลังตรวจสอบสถานะการเข้าสู่ระบบ...</Typography>
        </CardContent>
      </Card>
    );
  }

  // Logged-in + valid session
  if (user && userData && sessionValid) {
    const statusInfo = getStatusInfo();

    return (
      <Card
        sx={{
          mb: 3,
          overflow: 'hidden',
          borderRadius: 3,
          boxShadow: `0 12px 40px ${alpha('#000', 0.08)}`,
          border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 2.5,
            py: 2,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.14)}, ${alpha(
              theme.palette.primary.light,
              0.06
            )})`,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Avatar src={userData.photoURL} sx={{ width: 56, height: 56 }}>
            {userData.firstName?.charAt(0)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              {userData.displayName}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {userData.email}
            </Typography>
          </Box>
          <Chip
            size="small"
            color={statusInfo.color}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {statusInfo.icon}
                <span>{statusInfo.text}</span>
              </Box>
            }
            sx={{ fontWeight: 600 }}
          />
        </Box>

        <CardContent sx={{ pt: 2.5 }}>
          {/* session progress */}
          {sessionInitialized && (
            <Box
              sx={{
                mb: 2.5,
                p: 2,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.04),
                border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TimeIcon fontSize="small" color="action" />
                  <Typography variant="subtitle2">เวลาเซสชันที่เหลือ</Typography>
                </Box>
                <Typography variant="body2" fontWeight="medium">
                  {formatTimeRemaining(sessionRemainingTime)}
                </Typography>
              </Box>
              <LinearProgress variant="determinate" value={getTimeProgressValue()} sx={{ height: 6, borderRadius: 3 }} />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                จะออกจากระบบอัตโนมัติหากไม่มีการใช้งาน 30 นาที
              </Typography>
            </Box>
          )}

          {/* user info */}
          <Stack spacing={1.25} sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <PersonIcon color="action" fontSize="small" />
              <Typography variant="body2">
                ระดับ: <b>{userData.degreeLevel}</b>
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              คณะ: {userData.faculty}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              สาขา: {userData.department}
            </Typography>
          </Stack>

          <Divider sx={{ my: 2 }} />

          {/* actions */}
          <Stack spacing={1}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
              fullWidth
              disabled={disabled}
            >
              ออกจากระบบ
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  // Logged-in but session invalid
  if (user && userData && !sessionValid) {
    return (
      <Card sx={{ mb: 3, borderRadius: 3 }}>
        <CardContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body1" fontWeight="medium">
              เซสชันหมดอายุแล้ว
            </Typography>
            <Typography variant="body2" color="text.secondary">
              กรุณาเข้าสู่ระบบใหม่เพื่อดำเนินการต่อ
            </Typography>
          </Alert>

          <Button
            variant="contained"
            size="large"
            fullWidth
            startIcon={<MicrosoftLogo />}
            onClick={handleMicrosoftLogin}
            disabled={disabled || loginLoading}
            sx={{
              bgcolor: '#0078d4',
              '&:hover': { bgcolor: '#106ebe' },
              py: 1.25,
              borderRadius: 2,
            }}
          >
            {loginLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบใหม่ด้วย Microsoft'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Logged-out
  return (
    <>
      <Card
        sx={{
          mb: 3,
          overflow: 'hidden',
          borderRadius: 3,
          border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
          boxShadow: `0 12px 40px ${alpha('#000', 0.08)}`,
        }}
      >
        {/* Hero */}
        <Box
          sx={{
            px: 3,
            py: isMobile ? 3 : 4,
            background: `radial-gradient(1200px 400px at -10% -30%, ${alpha(
              theme.palette.primary.main,
              0.15
            )}, transparent), linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.1)}, ${alpha(
              theme.palette.background.paper,
              0.6
            )})`,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
            textAlign: 'center',
          }}
        >
          <Box
            sx={{
              mx: 'auto',
              width: 64,
              height: 64,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha('#fff', 0.9),
              border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
              boxShadow: `0 8px 24px ${alpha('#000', 0.08)}`,
              mb: 1.5,
            }}
          >
            <MicrosoftLogo size={28} />
          </Box>
          <Typography variant="h6" fontWeight={800}>
            เข้าสู่ระบบด้วยบัญชีมหาวิทยาลัย
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ใช้บัญชี Microsoft ของมหาวิทยาลัย (@psu.ac.th)
          </Typography>
        </Box>

        <CardContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Button
            variant="contained"
            size="large"
            fullWidth
            startIcon={loginLoading ? <CircularProgress size={20} color="inherit" /> : <MicrosoftLogo />}
            onClick={handleMicrosoftLogin}
            disabled={loginLoading || disabled}
            sx={{
              bgcolor: '#0078d4',
              '&:hover': { bgcolor: '#106ebe' },
              '&:disabled': { bgcolor: 'grey.400' },
              py: 1.5,
              borderRadius: 2,
            }}
          >
            {loginLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย Microsoft'}
          </Button>

          <Accordion
            disableGutters
            sx={{ mt: 2, borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.12)}` }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">คำแนะนำ & นโยบายเซสชัน</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Alert severity="info" sx={{ mb: 1.5 }}>
                กรุณาใช้อีเมล @psu.ac.th เท่านั้น
              </Alert>
              <Alert severity="warning" icon={<TimeIcon />} sx={{ mb: 1.5 }}>
                ระบบจะออกจากระบบอัตโนมัติเมื่อไม่มีการใช้งาน 30 นาที (ไม่มีปุ่มขยายเวลา)
              </Alert>
              <Alert severity="info">ถ้าเบราว์เซอร์บล็อก popup ให้อนุญาต popup สำหรับเว็บนี้แล้วลองใหม่</Alert>
            </AccordionDetails>
          </Accordion>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
            ระบบจะบันทึกข้อมูลที่จำเป็นเพื่อใช้งานการลงทะเบียนกิจกรรม และล็อกการใช้งาน 1 บัญชีต่อ 1 IP ชั่วคราว 30 นาที
          </Typography>
        </CardContent>
      </Card>
    </>
  );
};

export default MicrosoftLogin;
