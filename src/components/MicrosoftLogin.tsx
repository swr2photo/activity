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
  LinearProgress
} from '@mui/material';
import {
  Microsoft as MicrosoftIcon,
  Person as PersonIcon,
  School as SchoolIcon,
  Badge as BadgeIcon,
  Logout as LogoutIcon,
  Verified as VerifiedIcon,
  HourglassEmpty as HourglassIcon,
  Block as BlockIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  AccessTime as TimeIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User,
  OAuthProvider,
  linkWithCredential,
  fetchSignInMethodsForEmail,
  AuthError
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { SessionManager } from '../lib/sessionManager';

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

const MicrosoftLogin: React.FC<MicrosoftLoginProps> = ({
  onLoginSuccess,
  onLoginError,
  onLogout,
  onPreLoginCheck,
  onSessionExpired,
  redirectAfterLogin = false,
  disabled = false
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UniversityUserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAccountExistsDialog, setShowAccountExistsDialog] = useState(false);
  const [existingMethods, setExistingMethods] = useState<string[]>([]);
  const [pendingEmail, setPendingEmail] = useState('');
  
  // Session management states
  const [sessionValid, setSessionValid] = useState(true);
  const [sessionRemainingTime, setSessionRemainingTime] = useState(0);
  const [sessionWarning, setSessionWarning] = useState(false);
  const [extendingSession, setExtendingSession] = useState(false);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  
  // References to track state
  const loginInProgressRef = useRef(false);
  const sessionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionCreationPromiseRef = useRef<Promise<void> | null>(null);
  const hasCheckedExistingSessionRef = useRef(false);
  const isInitializingRef = useRef(false);

  // Utility functions
  const getUserIP = async (): Promise<string> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.error('Error getting IP:', error);
      return 'unknown';
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser?.uid, 'loginInProgress:', loginInProgressRef.current);
      
      setLoading(true);
      
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Load user data first
        await loadUserData(firebaseUser.uid);
        
        // Handle session logic based on context
        if (loginInProgressRef.current) {
          // User just logged in - session creation should be handled in handleSuccessfulLogin
          console.log('Login in progress, waiting for session creation...');
          setSessionValid(true); // Assume valid initially
        } else if (!hasCheckedExistingSessionRef.current) {
          // Check for existing session only on page refresh/reload
          hasCheckedExistingSessionRef.current = true;
          console.log('Checking for existing session on page load...');
          await checkExistingSession(firebaseUser.uid);
        }
      } else {
        // User logged out
        setUser(null);
        setUserData(null);
        stopSessionMonitoring();
        resetSessionState();
      }
      
      setLoading(false);
    });

    return () => {
      unsubscribe();
      stopSessionMonitoring();
    };
  }, []);

  const resetSessionState = () => {
    setSessionInitialized(false);
    setSessionValid(true);
    setSessionWarning(false);
    setSessionRemainingTime(0);
    hasCheckedExistingSessionRef.current = false;
    loginInProgressRef.current = false;
  };

  // Check for existing session (for page refresh scenarios)
  const checkExistingSession = async (userId: string) => {
    console.log('Checking existing session for user:', userId);
    
    try {
      const sessionResult = await SessionManager.validateSession(userId);
      console.log('Existing session check result:', sessionResult);
      
      if (sessionResult.isValid) {
        setSessionValid(true);
        setSessionRemainingTime(sessionResult.remainingTime || 0);
        setSessionInitialized(true);
        startSessionMonitoring(userId);
        
        if (sessionResult.remainingTime && sessionResult.remainingTime <= 5) {
          setSessionWarning(true);
        }
      } else {
        console.log('No existing session found, user needs to login');
        setSessionValid(false);
        setSessionInitialized(false);
        // Don't automatically logout here - let user login again
      }
    } catch (error) {
      console.error('Error checking existing session:', error);
      setSessionValid(false);
      setSessionInitialized(false);
    }
  };

  // Create session and initialize monitoring
  const createSessionAndInitialize = async (userId: string, email: string) => {
    console.log('Creating session for user:', userId);
    
    try {
      const userIP = await getUserIP();
      
      // Create session
      await SessionManager.createSession(userId, email, userIP);
      console.log('Session created successfully');
      
      // Wait a moment for session to be fully written
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Validate the created session
      const sessionResult = await SessionManager.validateSession(userId);
      console.log('Session validation after creation:', sessionResult);
      
      if (sessionResult.isValid) {
        setSessionValid(true);
        setSessionRemainingTime(sessionResult.remainingTime || 30);
        setSessionInitialized(true);
        startSessionMonitoring(userId);
        
        if (sessionResult.remainingTime && sessionResult.remainingTime <= 5) {
          setSessionWarning(true);
        }
      } else {
        console.warn('Session validation failed after creation');
        setSessionValid(true); // Allow user to continue but without full session monitoring
        setSessionInitialized(false);
      }
      
    } catch (error) {
      console.error('Error creating session:', error);
      setSessionValid(true); // Allow user to continue
      setSessionInitialized(false);
      setError('เข้าสู่ระบบสำเร็จ แต่เกิดข้อผิดพลาดในการสร้างเซสชัน');
    }
  };

  // Session monitoring
  const startSessionMonitoring = (userId: string) => {
    console.log('Starting session monitoring for user:', userId);
    
    // Clear any existing interval
    if (sessionCheckIntervalRef.current) {
      clearInterval(sessionCheckIntervalRef.current);
    }
    
    // Check session every minute
    sessionCheckIntervalRef.current = setInterval(async () => {
      try {
        const sessionResult = await SessionManager.validateSession(userId);
        
        if (!sessionResult.isValid) {
          console.log('Session expired during monitoring:', sessionResult.message);
          setSessionValid(false);
          setError(sessionResult.message || 'เซสชันหมดอายุแล้ว');
          handleSessionExpiredInternal();
          return;
        }

        setSessionRemainingTime(sessionResult.remainingTime || 0);
        
        // Show warning when 5 minutes remain
        if (sessionResult.remainingTime && sessionResult.remainingTime <= 5) {
          setSessionWarning(true);
        } else {
          setSessionWarning(false);
        }
      } catch (error) {
        console.error('Error in session monitoring:', error);
        // Continue without taking action on monitoring errors
      }
    }, 60000); // Check every minute
  };

  const stopSessionMonitoring = () => {
    if (sessionCheckIntervalRef.current) {
      clearInterval(sessionCheckIntervalRef.current);
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
      
      if (onSessionExpired) {
        onSessionExpired();
      }
    } catch (error) {
      console.error('Error handling session expiry:', error);
    }
  };

  const handleExtendSession = async () => {
    if (!user?.uid) return;
    
    setExtendingSession(true);
    try {
      const result = await SessionManager.extendSession(user.uid);
      
      if (result.success && result.newExpiryTime) {
        setSessionWarning(false);
        setSessionRemainingTime(30);
        setError('');
        
        console.log('Session extended successfully until', result.newExpiryTime?.toLocaleString('th-TH'));
      } else {
        setError(result.message || 'ไม่สามารถขยายเวลาเซสชันได้');
        if (result.message?.includes('หมดอายุ')) {
          handleSessionExpiredInternal();
        }
      }
    } catch (error) {
      console.error('Error extending session:', error);
      setError('เกิดข้อผิดพลาดในการขยายเวลาเซสชัน');
    } finally {
      setExtendingSession(false);
    }
  };

  const loadUserData = async (uid: string) => {
    try {
      const userDocRef = doc(db, 'universityUsers', uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const data = userDoc.data() as UniversityUserData;
        setUserData(data);
        if (onLoginSuccess) {
          onLoginSuccess(data);
        }
      }
    } catch (err) {
      console.error('Error loading user data:', err);
    }
  };

  const extractStudentInfoFromEmail = (email: string) => {
    const studentId = email.split('@')[0];
    
    let degreeLevel = 'ไม่ระบุ';
    let department = 'ไม่ระบุ';
    let faculty = 'ไม่ระบุ';

    if (studentId.length >= 8) {
      const year = studentId.substring(0, 2);
      const facultyCode = studentId.substring(2, 4);
      const deptCode = studentId.substring(4, 6);
      
      const facultyMap: { [key: string]: string } = {
        '01': 'คณะวิศวกรรมศาสตร์',
        '02': 'คณะวิทยาศาสตร์',
        '03': 'คณะมนุษยศาสตร์',
        '04': 'คณะสังคมศาสตร์',
        '05': 'คณะแพทยศาสตร์',
        '06': 'คณะพยาบาลศาสตร์',
        '07': 'คณะเทคโนโลยีสารสนเทศ',
        '08': 'คณะบริหารธุรกิจ'
      };

      const departmentMap: { [key: string]: string } = {
        '01': 'วิศวกรรมคอมพิวเตอร์',
        '02': 'วิศวกรรมไฟฟ้า',
        '03': 'วิศวกรรมเครื่องกล',
        '04': 'คณิตศาสตร์',
        '05': 'ฟิสิกส์',
        '06': 'เคมี',
        '07': 'ภาษาอังกฤษ',
        '08': 'ภาษาไทย'
      };

      faculty = facultyMap[facultyCode] || 'ไม่ระบุ';
      department = departmentMap[deptCode] || 'ไม่ระบุ';

      if (studentId.startsWith('67') || studentId.startsWith('66') || studentId.startsWith('65') || studentId.startsWith('64')) {
        degreeLevel = 'ปริญญาตรี';
      } else if (studentId.startsWith('M')) {
        degreeLevel = 'ปริญญาโท';
      } else if (studentId.startsWith('D')) {
        degreeLevel = 'ปริญญาเอก';
      }
    }

    return {
      studentId,
      degreeLevel,
      department,
      faculty
    };
  };

  const getProviderDisplayName = (providerId: string): string => {
    switch (providerId) {
      case 'google.com':
        return 'Google';
      case 'microsoft.com':
        return 'Microsoft';
      case 'password':
        return 'อีเมล/รหัสผ่าน';
      default:
        return providerId;
    }
  };

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
      
      provider.setCustomParameters({
        prompt: 'select_account',
        response_mode: 'fragment'
      });

      console.log('Starting Microsoft login...');
      
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      console.log('Microsoft login successful:', firebaseUser.email);
      
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
      console.error('Microsoft login error:', err);
      await handleAuthError(err, attemptedEmail);
    } finally {
      setLoginLoading(false);
      loginInProgressRef.current = false;
    }
  };

  const handleAuthError = async (err: AuthError, attemptedEmail: string = '') => {
    if (err.code === 'auth/account-exists-with-different-credential') {
      let email = '';
      
      if (err.customData?.email) {
        email = err.customData.email as string;
      } else if (attemptedEmail) {
        email = attemptedEmail;
      } else if (err.message && err.message.includes('@')) {
        const emailMatch = err.message.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) {
          email = emailMatch[1];
        }
      }

      if (email) {
        setPendingEmail(email);
        try {
          const methods = await fetchSignInMethodsForEmail(auth, email);
          setExistingMethods(methods);
          setShowAccountExistsDialog(true);
        } catch (fetchError) {
          console.error('Error fetching sign-in methods:', fetchError);
          setError(`มีบัญชีผู้ใช้ที่ใช้อีเมล ${email} อยู่แล้ว กรุณาเข้าสู่ระบบด้วยวิธีการที่ใช้ในการสร้างบัญชี`);
        }
      } else {
        setError('มีบัญชีผู้ใช้ที่ใช้อีเมลนี้อยู่แล้ว กรุณาเข้าสู่ระบบด้วยวิธีการที่ใช้ในการสร้างบัญชี');
      }
    } else {
      let errorMessage = 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
      
      switch (err.code) {
        case 'auth/popup-closed-by-user':
          errorMessage = 'การเข้าสู่ระบบถูกยกเลิก กรุณาลองใหม่อีกครั้ง';
          break;
        case 'auth/popup-blocked':
          errorMessage = 'เบราว์เซอร์บล็อก popup กรุณาอนุญาต popup สำหรับเว็บไซต์นี้แล้วลองใหม่';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'มีการพยายามเข้าสู่ระบบมากเกินไป กรุณารอ 1-2 นาทีแล้วลองใหม่';
          break;
        default:
          if (err.message.includes('popup')) {
            errorMessage = 'ไม่สามารถเปิดหน้าต่างล็อกอินได้ กรุณาอนุญาต popup และลองใหม่';
          } else {
            errorMessage = `เกิดข้อผิดพลาด: ${err.message || err.code}`;
          }
      }
      
      setError(errorMessage);
      if (onLoginError) {
        onLoginError(errorMessage);
      }
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
      const existingData = existingUser.data() as UniversityUserData;
      finalUserData = {
        ...existingData,
        displayName: firebaseUser.displayName || existingData.displayName,
        photoURL: firebaseUser.photoURL || existingData.photoURL,
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
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
        lastLoginAt: serverTimestamp()
      };
      
      await setDoc(userDocRef, finalUserData);
    }

    // Create session and initialize monitoring
    await createSessionAndInitialize(firebaseUser.uid, firebaseUser.email!);

    setUserData(finalUserData);
    
    if (onLoginSuccess) {
      onLoginSuccess(finalUserData);
    }
  };

  const handleLogout = async () => {
    try {
      if (user?.uid) {
        await SessionManager.destroySession(user.uid);
      }
      
      stopSessionMonitoring();
      await signOut(auth);
      resetSessionState();
      setUser(null);
      setUserData(null);
      setError('');
      
      if (onLogout) {
        onLogout();
      }
    } catch (err) {
      console.error('Logout error:', err);
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

  const formatTimeRemaining = (minutes: number): string => {
    if (minutes <= 0) return '0 นาที';
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours} ชั่วโมง ${remainingMinutes} นาที`;
    }
    return `${minutes} นาที`;
  };

  const getTimeProgressColor = (): 'error' | 'warning' | 'info' => {
    if (sessionRemainingTime <= 5) return 'error';
    if (sessionRemainingTime <= 10) return 'warning';
    return 'info';
  };

  const getTimeProgressValue = (): number => {
    return (sessionRemainingTime / 30) * 100;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
        <CircularProgress size={24} sx={{ mr: 2 }} />
        <Typography>กำลังตรวจสอบสถานะการเข้าสู่ระบบ...</Typography>
      </Box>
    );
  }

  // Show user info when logged in and session is valid
  if (user && userData && sessionValid) {
    const statusInfo = getStatusInfo();
    
    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          {/* Session Warning Alert */}
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
              <Typography variant="body2" color="text.secondary">
                กรุณากดปุ่ม "ขยายเวลา" เพื่อต่ออายุเซสชันอีก 30 นาที
              </Typography>
            </Alert>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Avatar
              src={userData.photoURL}
              sx={{ width: 56, height: 56, mr: 2 }}
            >
              {userData.firstName.charAt(0)}
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6" gutterBottom>
                {userData.displayName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {userData.email}
              </Typography>
            </Box>
            <Chip 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {statusInfo.icon}
                  เข้าสู่ระบบแล้ว
                </Box>
              }
              color="success" 
              size="small"
            />
          </Box>

          {/* Session Time Display */}
          {sessionInitialized && (
            <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
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
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                เซสชันจะหมดอายุอัตโนมัติหลังจาก 30 นาทีนับจากการเข้าสู่ระบบหรือการขยายเวลาล่าสุด
              </Typography>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon color="action" fontSize="small" />
              <Box>
                <Typography variant="subtitle2">ชื่อ-นามสกุล</Typography>
                <Typography variant="body2" color="text.secondary">
                  ระดับ: {userData.degreeLevel}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  คณะ: {userData.faculty}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  สาขา: {userData.department}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ 
              p: 2, 
              bgcolor: statusInfo.color === 'success' ? 'success.50' : 
                     statusInfo.color === 'warning' ? 'warning.50' : 
                     statusInfo.color === 'error' ? 'error.50' : 'grey.50',
              borderRadius: 2,
              border: '1px solid',
              borderColor: statusInfo.color === 'success' ? 'success.200' : 
                          statusInfo.color === 'warning' ? 'warning.200' : 
                          statusInfo.color === 'error' ? 'error.200' : 'grey.200'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                {statusInfo.icon}
                <Typography variant="subtitle2" color={`${statusInfo.color}.dark`}>
                  สถานะบัญชี
                </Typography>
              </Box>
              <Typography variant="body2" color={`${statusInfo.color}.dark`} fontWeight="medium">
                {statusInfo.text}
              </Typography>
              
              {!userData.isVerified && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontSize: '0.8rem' }}>
                  บัญชีใหม่ต้องรอการอนุมัติจากผู้ดูแลระบบก่อนใช้งาน
                </Typography>
              )}
            </Box>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Stack spacing={1}>
            {/* Extend Session Button (show when time is less than 15 minutes) */}
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

            {/* Logout Button */}
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

  // Session expired state - show only when user exists but session is invalid
  if (user && userData && !sessionValid) {
    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body1" fontWeight="medium">
              เซสชันหมดอายุแล้ว
            </Typography>
            <Typography variant="body2" color="text.secondary">
              เซสชันการเข้าสู่ระบบของคุณหมดอายุแล้ว (30 นาที) กรุณาเข้าสู่ระบบใหม่เพื่อดำเนินการต่อ
            </Typography>
          </Alert>

          <Button
            variant="contained"
            size="large"
            fullWidth
            startIcon={<MicrosoftIcon />}
            onClick={handleMicrosoftLogin}
            disabled={disabled || loginLoading}
            sx={{
              bgcolor: '#0078d4',
              '&:hover': {
                bgcolor: '#106ebe'
              }
            }}
          >
            {loginLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบใหม่'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Login page - show when no user or no userData
  return (
    <>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <MicrosoftIcon sx={{ fontSize: 48, color: '#0078d4', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              เข้าสู่ระบบด้วยบัญชีมหาวิทยาลัย
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ใช้บัญชี Microsoft ของมหาวิทยาลัยเพื่อเข้าสู่ระบบ
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>หมายเหตุ:</strong> กรุณาใช้บัญชี Microsoft ของมหาวิทยาลัยเท่านั้น 
              (อีเมลที่ลงท้ายด้วย @psu.ac.th)
            </Typography>
          </Alert>

          <Alert severity="warning" sx={{ mb: 2 }} icon={<TimeIcon />}>
            <Typography variant="body2">
              <strong>เซสชันการใช้งาน:</strong> หลังจากเข้าสู่ระบบแล้ว คุณจะมีเวลาใช้งาน 30 นาที 
              หากต้องการใช้งานต่อเนื่องสามารถขยายเวลาได้ก่อนหมดอายุ
            </Typography>
          </Alert>

          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>เคล็ดลับ:</strong> หากเบราว์เซอร์บล็อก popup กรุณาคลิกที่ไอคอนการแจ้งเตือนในแถบที่อยู่และเลือก "อนุญาต"
            </Typography>
          </Alert>

          <Button
            variant="contained"
            size="large"
            fullWidth
            startIcon={loginLoading ? <CircularProgress size={20} color="inherit" /> : <MicrosoftIcon />}
            onClick={handleMicrosoftLogin}
            disabled={loginLoading || disabled}
            sx={{
              bgcolor: '#0078d4',
              '&:hover': {
                bgcolor: '#106ebe'
              },
              '&:disabled': {
                bgcolor: 'grey.400'
              },
              py: 1.5
            }}
          >
            {loginLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย Microsoft'}
          </Button>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
            การเข้าสู่ระบบจะทำการบันทึกข้อมูลของคุณในระบบเพื่อใช้ในการลงทะเบียนกิจกรรม
          </Typography>

          <Alert severity="warning" sx={{ mt: 2 }} icon={<HourglassIcon />}>
            <Typography variant="body2">
              <strong>สำหรับผู้ใช้ใหม่:</strong> บัญชีจะต้องได้รับการอนุมัติจากผู้ดูแลระบบก่อนสามารถลงทะเบียนกิจกรรมได้
            </Typography>
          </Alert>
        </CardContent>
      </Card>

      {/* Dialog for account exists with different credential */}
      <Dialog 
        open={showAccountExistsDialog} 
        onClose={handleCloseAccountExistsDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" />
          บัญชีมีอยู่แล้ว
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            อีเมล <strong>{pendingEmail}</strong> มีบัญชีอยู่แล้วในระบบ
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            กรุณาเข้าสู่ระบบด้วยวิธีการที่ใช้ในการสร้างบัญชีครั้งแรก:
          </Typography>
          <Box sx={{ pl: 2 }}>
            {existingMethods.map((method, index) => (
              <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                • {getProviderDisplayName(method)}
              </Typography>
            ))}
          </Box>
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              หากต้องการใช้ Microsoft แทน กรุณาติดต่อผู้ดูแลระบบเพื่อรวมบัญชี 
              หรือลบบัญชีเดิมแล้วสร้างใหม่
            </Typography>
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