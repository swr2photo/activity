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
  DialogActions
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
  Warning as WarningIcon
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
  redirectAfterLogin?: boolean;
  disabled?: boolean;
}

const MicrosoftLogin: React.FC<MicrosoftLoginProps> = ({
  onLoginSuccess,
  onLoginError,
  onLogout,
  onPreLoginCheck,
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
  
  // ใช้ ref เพื่อติดตามสถานะการล็อกอิน
  const loginInProgressRef = useRef(false);
  const popupWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        await loadUserData(firebaseUser.uid);
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ปรับปรุงการตรวจสอบการปิดหน้าต่าง - ลดความซับซ้อน
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (loginInProgressRef.current) {
        e.preventDefault();
        e.returnValue = 'กำลังดำเนินการเข้าสู่ระบบ คุณแน่ใจหรือไม่ว่าต้องการออกจากหน้านี้?';
        return e.returnValue;
      }
    };

    // ตรวจสอบการเปลี่ยนแถบแบบเบา
    const handleVisibilityChange = () => {
      if (loginInProgressRef.current && document.hidden) {
        // แทนที่จะหยุดการล็อกอิน ให้แสดงการเตือนเบาๆ
        console.warn('Tab changed during login process');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

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

  // ปรับปรุงการจัดการ Popup - ลดการบล็อกและเพิ่มความเร็ว
  const handleMicrosoftLogin = async () => {
    let attemptedEmail = '';
    
    try {
      setLoginLoading(true);
      setError('');
      loginInProgressRef.current = true;

      // ตั้งค่า provider ก่อนสร้าง popup
      const provider = new OAuthProvider('microsoft.com');
      provider.addScope('openid');
      provider.addScope('email');
      provider.addScope('profile');
      
      // เพิ่ม custom parameters เพื่อปรับปรุงประสิทธิภาพ
      provider.setCustomParameters({
        prompt: 'select_account',
        // ลดเวลาการโหลด
        response_mode: 'fragment'
      });

      console.log('Starting Microsoft login...');
      
      // ใช้ setTimeout เพื่อให้ UI อัพเดทก่อน
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      console.log('Microsoft login successful:', firebaseUser.email);
      
      // Store the email that was attempted
      attemptedEmail = firebaseUser.email || '';

      if (!firebaseUser.email?.endsWith('@university.ac.th')) {
        await signOut(auth);
        setError('กรุณาใช้บัญชี Microsoft ของมหาวิทยาลัยเท่านั้น (@university.ac.th)');
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

  // ปรับปรุงการจัดการ Error ให้ชัดเจนและเป็นมิตรกับผู้ใช้มากขึ้น
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
        case 'auth/credential-already-in-use':
          errorMessage = 'ข้อมูลประจำตัวนี้ถูกใช้งานแล้วในบัญชีอื่น';
          break;
        case 'auth/cancelled-popup-request':
          errorMessage = 'การเข้าสู่ระบบถูกยกเลิก กรุณาลองใหม่อีกครั้ง';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'การเข้าสู่ระบบด้วย Microsoft ไม่ได้รับอนุญาต กรุณาติดต่อผู้ดูแลระบบ';
          break;
        case 'auth/unauthorized-domain':
          errorMessage = 'โดเมนนี้ไม่ได้รับอนุญาตให้ใช้การเข้าสู่ระบบ กรุณาติดต่อผู้ดูแลระบบ';
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

    setUserData(finalUserData);
    
    if (onLoginSuccess) {
      onLoginSuccess(finalUserData);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
        <CircularProgress size={24} sx={{ mr: 2 }} />
        <Typography>กำลังตรวจสอบสถานะการเข้าสู่ระบบ...</Typography>
      </Box>
    );
  }

  // แสดงข้อมูลผู้ใช้ที่เข้าสู่ระบบแล้ว
  if (user && userData) {
    const statusInfo = getStatusInfo();
    
    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
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

          <Divider sx={{ my: 2 }} />

          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon color="action" fontSize="small" />
              <Box>
                <Typography variant="subtitle2">ชื่อ-นามสกุล</Typography>
                <Typography variant="body2" color="text.secondary">
                  {userData.firstName} {userData.lastName}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BadgeIcon color="action" fontSize="small" />
              <Box>
                <Typography variant="subtitle2">รหัสนักศึกษา</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                  {userData.studentId}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SchoolIcon color="action" fontSize="small" />
              <Box>
                <Typography variant="subtitle2">ข้อมูลการศึกษา</Typography>
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
        </CardContent>
      </Card>
    );
  }

  // หน้าเข้าสู่ระบบ
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
              (อีเมลที่ลงท้ายด้วย @university.ac.th)
            </Typography>
          </Alert>

          {/* ลดข้อความเตือนให้สั้นลงและไม่น่ากลัว */}
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