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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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
  HourglassEmpty as HourglassIcon,
  Block as BlockIcon,
  Warning as WarningIcon,
  AccessTime as TimeIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';

import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
  OAuthProvider,
  fetchSignInMethodsForEmail,
  AuthError,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { SessionManager } from '../lib/sessionManager';

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
  isVerified: boolean;
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
  <Box
    component="svg"
    viewBox="0 0 23 23"
    sx={{ width: size, height: size, borderRadius: 0.5, overflow: 'visible' }}
  >
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

  // dialog (account exists with different credential)
  const [showAccountExistsDialog, setShowAccountExistsDialog] = useState(false);
  const [existingMethods, setExistingMethods] = useState<string[]>([]);
  const [pendingEmail, setPendingEmail] = useState('');

  // session state
  const [sessionValid, setSessionValid] = useState(true);
  const [sessionRemainingTime, setSessionRemainingTime] = useState(0);
  const [sessionWarning, setSessionWarning] = useState(false);
  const [extendingSession, setExtendingSession] = useState(false);
  const [sessionInitialized, setSessionInitialized] = useState(false);

  // refs
  const loginInProgressRef = useRef(false);
  const sessionCheckIntervalRef = useRef<number | null>(null);
  const hasCheckedExistingSessionRef = useRef(false);

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

  const formatTimeRemaining = (minutes: number): string => {
    if (minutes <= 0) return '0 นาที';
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours} ชั่วโมง ${mins} นาที`;
    }
    return `${minutes} นาที`;
  };

  const getTimeProgressColor = (): 'error' | 'warning' | 'info' => {
    if (sessionRemainingTime <= 5) return 'error';
    if (sessionRemainingTime <= 10) return 'warning';
    return 'info';
  };

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
          // หลังล็อกอินสำเร็จ: handleSuccessfulLogin จะสร้างเซสชันแล้ว
          setSessionValid(true);
        } else if (!hasCheckedExistingSessionRef.current) {
          // รีเฟรชหน้า: ตรวจเซสชันเดิม
          hasCheckedExistingSessionRef.current = true;
          await checkExistingSession(firebaseUser.uid);
        }
      } else {
        // ออกจากระบบ
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
    setSessionWarning(false);
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

        if (sessionResult.remainingTime && sessionResult.remainingTime <= 5) {
          setSessionWarning(true);
        }
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
      await SessionManager.createSession(userId, email, userIP);
      // เว้นช่วงให้เขียนเสร็จ
      await new Promise((r) => setTimeout(r, 400));

      const sessionResult = await SessionManager.validateSession(userId);
      if (sessionResult.isValid) {
        setSessionValid(true);
        setSessionRemainingTime(sessionResult.remainingTime || 30);
        setSessionInitialized(true);
        startSessionMonitoring(userId);
        setSessionWarning((sessionResult.remainingTime || 0) <= 5);
      } else {
        // อนุญาตให้ใช้งานต่อ แต่ไม่เริ่ม monitor
        setSessionValid(true);
        setSessionInitialized(false);
      }
    } catch {
      setSessionValid(true);
      setSessionInitialized(false);
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
          setError(res.message || 'เซสชันหมดอายุแล้ว');
          handleSessionExpiredInternal();
          return;
        }
        setSessionRemainingTime(res.remainingTime || 0);
        setSessionWarning((res.remainingTime || 0) <= 5);
      } catch {
        // เงียบไว้ ไม่ทำให้หลุด
      }
    }, 60_000);
  };

  const stopSessionMonitoring = () => {
    if (sessionCheckIntervalRef.current) {
      window.clearInterval(sessionCheckIntervalRef.current);
      sessionCheckIntervalRef.current = null;
    }
    setSessionWarning(false);
    setSessionRemainingTime(0);
  };

  const handleSessionExpiredInternal = async () => {
    try {
      stopSessionMonitoring();
      await signOut(auth);
      resetSessionState();
      setUser(null);
      setUserData(null);
      if (onSessionExpired) onSessionExpired();
    } catch {
      /* noop */
    }
  };

  const handleExtendSession = async () => {
    if (!user?.uid) return;
    setExtendingSession(true);
    try {
      const result = await SessionManager.extendSession(user.uid);
      if (result.success) {
        setSessionWarning(false);
        setSessionRemainingTime(30);
        setError('');
      } else {
        setError(result.message || 'ไม่สามารถขยายเวลาเซสชันได้');
        if (result.message?.includes('หมดอายุ')) {
          handleSessionExpiredInternal();
        }
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการขยายเวลาเซสชัน');
    } finally {
      setExtendingSession(false);
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
      // เงียบไว้
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
      await handleAuthError(err, attemptedEmail);
    } finally {
      setLoginLoading(false);
      loginInProgressRef.current = false;
    }
  };

  const handleAuthError = async (err: AuthError, attemptedEmail = '') => {
    if (err.code === 'auth/account-exists-with-different-credential') {
      let email = '';
      if (err.customData?.email) email = err.customData.email as string;
      else if (attemptedEmail) email = attemptedEmail;
      else {
        const m = err.message?.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (m) email = m[1];
      }

      if (email) {
        setPendingEmail(email);
        try {
          const methods = await fetchSignInMethodsForEmail(auth, email);
          setExistingMethods(methods);
          setShowAccountExistsDialog(true);
        } catch {
          setError(`มีบัญชีที่ใช้อีเมล ${email} อยู่แล้ว กรุณาเข้าสู่ระบบด้วยวิธีเดิม`);
        }
      } else {
        setError('มีบัญชีที่ใช้อีเมลนี้อยู่แล้ว กรุณาเข้าสู่ระบบด้วยวิธีเดิม');
      }
      return;
    }

    let message = 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
    switch (err.code) {
      case 'auth/popup-closed-by-user':
        message = 'การเข้าสู่ระบบถูกยกเลิก กรุณาลองใหม่อีกครั้ง';
        break;
      case 'auth/popup-blocked':
        message = 'เบราว์เซอร์บล็อกหน้าต่างล็อกอิน กรุณาอนุญาต Popup แล้วลองใหม่';
        break;
      case 'auth/network-request-failed':
        message = 'มีปัญหาการเชื่อมต่ออินเทอร์เน็ต กรุณาลองใหม่';
        break;
      case 'auth/too-many-requests':
        message = 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่';
        break;
      default:
        if (String(err.message || '').includes('popup')) {
          message = 'ไม่สามารถเปิดหน้าต่างล็อกอินได้ กรุณาอนุญาต Popup แล้วลองใหม่';
        } else {
          message = `เกิดข้อผิดพลาด: ${err.message || err.code}`;
        }
    }
    setError(message);
    onLoginError?.(message);
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
      };
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
        isVerified: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      };
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

  const handleCloseAccountExistsDialog = () => {
    setShowAccountExistsDialog(false);
    setPendingEmail('');
    setExistingMethods([]);
  };

  const getStatusInfo = () => {
    if (!userData) return { text: 'ไม่มีข้อมูล', color: 'default' as const, icon: <PersonIcon fontSize="small" /> };
    if (!userData.isActive) return { text: 'บัญชีถูกระงับ', color: 'error' as const, icon: <BlockIcon fontSize="small" /> };
    if (!userData.isVerified) return { text: 'รอการยืนยัน', color: 'warning' as const, icon: <HourglassIcon fontSize="small" /> };
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
          {/* session warning */}
          {sessionWarning && sessionInitialized && (
            <Alert
              severity="warning"
              sx={{ mb: 2 }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={handleExtendSession}
                  disabled={extendingSession}
                  startIcon={extendingSession ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
                >
                  {extendingSession ? 'กำลังขยายเวลา...' : 'ขยายเวลา'}
                </Button>
              }
            >
              <Typography variant="body2" fontWeight="medium">
                เซสชันจะหมดอายุใน {formatTimeRemaining(sessionRemainingTime)}
              </Typography>
            </Alert>
          )}

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
                <Typography variant="body2" fontWeight="medium" color={getTimeProgressColor()}>
                  {formatTimeRemaining(sessionRemainingTime)}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={getTimeProgressValue()}
                color={getTimeProgressColor()}
                sx={{ height: 6, borderRadius: 3 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                หมดอายุอัตโนมัติหลัง 30 นาทีจากการเข้าสู่ระบบหรือการขยายเวลาล่าสุด
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
            {sessionInitialized && sessionRemainingTime <= 15 && (
              <Button
                variant="outlined"
                color="primary"
                startIcon={extendingSession ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                onClick={handleExtendSession}
                disabled={extendingSession || disabled}
                fullWidth
              >
                {extendingSession ? 'กำลังขยายเวลาเซสชัน...' : 'ขยายเวลาเซสชัน (+30 นาที)'}
              </Button>
            )}
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

          <Accordion disableGutters sx={{ mt: 2, borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.12)}` }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">คำแนะนำ & นโยบายเซสชัน</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Alert severity="info" sx={{ mb: 1.5 }}>
                กรุณาใช้อีเมล @psu.ac.th เท่านั้น
              </Alert>
              <Alert severity="warning" icon={<TimeIcon />} sx={{ mb: 1.5 }}>
                หลังเข้าสู่ระบบ คุณจะมีเวลาใช้งาน 30 นาที และสามารถ “ขยายเวลา” ได้ก่อนหมดอายุ
              </Alert>
              <Alert severity="info">
                ถ้าเบราว์เซอร์บล็อก popup ให้อนุญาต popup สำหรับเว็บนี้แล้วลองใหม่
              </Alert>
            </AccordionDetails>
          </Accordion>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
            ระบบจะบันทึกข้อมูลที่จำเป็นเพื่อใช้งานการลงทะเบียนกิจกรรม
          </Typography>
        </CardContent>
      </Card>

      {/* Dialog: account exists with different credential */}
      <Dialog open={showAccountExistsDialog} onClose={handleCloseAccountExistsDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" />
          บัญชีมีอยู่แล้ว
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            อีเมล <strong>{pendingEmail}</strong> มีบัญชีอยู่แล้วในระบบ
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            กรุณาเข้าสู่ระบบด้วยวิธีที่เคยใช้สร้างบัญชีครั้งแรก:
          </Typography>
          <Box sx={{ pl: 2, mb: 2 }}>
            {existingMethods.map((method, i) => (
              <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>
                • {method === 'google.com' ? 'Google' : method === 'microsoft.com' ? 'Microsoft' : method === 'password' ? 'อีเมล/รหัสผ่าน' : method}
              </Typography>
            ))}
          </Box>
          <Alert severity="info">
            หากต้องการใช้ Microsoft แทน กรุณาติดต่อผู้ดูแลระบบเพื่อรวมบัญชีหรือย้ายข้อมูล
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAccountExistsDialog} color="primary">
            เข้าใจแล้ว
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MicrosoftLogin;
