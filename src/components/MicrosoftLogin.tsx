'use client';
import React, { useState, useEffect } from 'react';
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
  Chip
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
  CheckCircle as CheckIcon
} from '@mui/icons-material';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User,
  OAuthProvider
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
    // สมมติว่า email มีรูปแบบ: studentId@university.ac.th
    const studentId = email.split('@')[0];
    
    // สำหรับตัวอย่างนี้ ใช้รูปแบบรหัสนักศึกษาทั่วไป
    // คุณสามารถปรับแต่งตามรูปแบบของมหาวิทยาลัยของคุณ
    let degreeLevel = 'ไม่ระบุ';
    let department = 'ไม่ระบุ';
    let faculty = 'ไม่ระบุ';

    // ตัวอย่างการแยกข้อมูลจากรหัสนักศึกษา
    if (studentId.length >= 8) {
      const year = studentId.substring(0, 2);
      const facultyCode = studentId.substring(2, 4);
      const deptCode = studentId.substring(4, 6);
      
      // แมปรหัสคณะ (ตัวอย่าง)
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

      // แมปรหัสสาขา (ตัวอย่าง)
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

      // กำหนดระดับปริญญาจากรหัส
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

  const handleMicrosoftLogin = async () => {
    try {
      setLoginLoading(true);
      setError('');

      // สร้าง Microsoft OAuth provider
      const provider = new OAuthProvider('microsoft.com');
      
      // กำหนด scope สำหรับข้อมูลที่ต้องการ
      provider.addScope('openid');
      provider.addScope('email');
      provider.addScope('profile');
      
      // กำหนด tenant สำหรับมหาวิทยาลัย (ถ้ามี)
      // provider.setCustomParameters({
      //   tenant: 'your-university-tenant-id'
      // });

      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;

      // ตรวจสอบว่าเป็น email ของมหาวิทยาลัย
      if (!firebaseUser.email?.endsWith('@university.ac.th')) {
        await signOut(auth);
        setError('กรุณาใช้บัญชี Microsoft ของมหาวิทยาลัยเท่านั้น (@university.ac.th)');
        return;
      }

      // ตรวจสอบ IP restriction ก่อนเข้าสู่ระบบ (ถ้ามี)
      if (onPreLoginCheck) {
        const canProceed = await onPreLoginCheck(firebaseUser.email);
        if (!canProceed) {
          await signOut(auth);
          return;
        }
      }

      // แยกข้อมูลจาก email และ display name
      const { studentId, degreeLevel, department, faculty } = extractStudentInfoFromEmail(firebaseUser.email);
      
      // แยกชื่อ-นามสกุล (สมมติว่า displayName มีรูปแบบ "ชื่อ นามสกุล")
      const nameParts = (firebaseUser.displayName || '').split(' ');
      const firstName = nameParts[0] || 'ไม่ระบุ';
      const lastName = nameParts.slice(1).join(' ') || 'ไม่ระบุ';

      // ตรวจสอบข้อมูลผู้ใช้ที่มีอยู่
      const userDocRef = doc(db, 'universityUsers', firebaseUser.uid);
      const existingUser = await getDoc(userDocRef);

      let finalUserData: UniversityUserData;

      if (existingUser.exists()) {
        // อัพเดทข้อมูลที่มีอยู่
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
        // สร้างข้อมูลใหม่
        finalUserData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || '',
          firstName,
          lastName,
          studentId,
          degreeLevel,
          department,
          faculty,
          photoURL: firebaseUser.photoURL || '',
          isActive: true,
          isVerified: false, // ต้องรอการอนุมัติ
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

    } catch (err: any) {
      console.error('Microsoft login error:', err);
      let errorMessage = 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
      
      if (err.code === 'auth/popup-closed-by-user') {
        errorMessage = 'การเข้าสู่ระบบถูกยกเลิก';
      } else if (err.code === 'auth/popup-blocked') {
        errorMessage = 'เบราว์เซอร์บล็อก popup กรุณาอนุญาต popup สำหรับเว็บไซต์นี้';
      } else if (err.code === 'auth/network-request-failed') {
        errorMessage = 'เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย กรุณาลองใหม่อีกครั้ง';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'มีการพยายามเข้าสู่ระบบมากเกินไป กรุณารอสักครู่แล้วลองใหม่';
      }
      
      setError(errorMessage);
      if (onLoginError) {
        onLoginError(errorMessage);
      }
    } finally {
      setLoginLoading(false);
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

            {/* สถานะบัญชี */}
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

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>หมายเหตุ:</strong> กรุณาใช้บัญชี Microsoft ของมหาวิทยาลัยเท่านั้น 
            (อีเมลที่ลงท้ายด้วย @university.ac.th)
          </Typography>
        </Alert>

        <Button
          variant="contained"
          size="large"
          fullWidth
          startIcon={loginLoading ? <CircularProgress size={20} /> : <MicrosoftIcon />}
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

        {/* ข้อมูลเพิ่มเติมเกี่ยวกับการยืนยันบัญชี */}
        <Alert severity="warning" sx={{ mt: 2 }} icon={<HourglassIcon />}>
          <Typography variant="body2">
            <strong>สำหรับผู้ใช้ใหม่:</strong> บัญชีจะต้องได้รับการอนุมัติจากผู้ดูแลระบบก่อนสามารถลงทะเบียนกิจกรรมได้
          </Typography>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default MicrosoftLogin;