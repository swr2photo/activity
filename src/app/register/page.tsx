'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Container,
  CircularProgress,
  Alert,
  Box,
  Button,
  Typography
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  AccessTime as TimeIcon
} from '@mui/icons-material';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, increment, addDoc, onSnapshot, setDoc } from 'firebase/firestore';
// Import separated components
import NavigationBar from '../../components/navigation/NavigationBar';
import MicrosoftAuthSection from '../../components/auth/MicrosoftAuthSection';
import {
  IPRestrictionAlert,
  DuplicateRegistrationAlert,
  ProfileSetupAlert,
  SuccessAlert,
  ActivityStatusAlert
} from '../../components/alerts/StatusAlerts';
import ProfileEditDialog from '../../components/profile/ProfileEditDialog';
import ActivityBanner from '../../components/activity/ActivityBanner';
import ActivityInfoCard from '../../components/activity/ActivityInfoCard';

import ActivityRegistrationForm from '../../components/ActivityRegistrationForm';
import { db } from '../../lib/firebase';
import { useAuth, UniversityUserProfile } from '../../lib/firebaseAuth';
import { SessionManager } from '../../lib/sessionManager';
import { AdminSettings } from '../../types';

// Types
interface ActivityData {
  id: string;
  activityCode: string;
  activityName: string;
  description: string;
  location: string;
  latitude: number;
  longitude: number;
  checkInRadius: number;
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
  createdAt?: any;
  updatedAt?: any;
}

interface IPLoginRecord {
  ipAddress: string;
  userEmail: string;
  loginTime: any;
  expiresAt: any;
}

interface RegistrationRecord {
  activityCode: string;
  userEmail: string;
  registeredAt: any;
}

// Utility functions
const getUserIP = async (): Promise<string> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('Error getting IP:', error);
    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      return data.ip;
    } catch (fallbackError) {
      console.error('Fallback IP check failed:', fallbackError);
      return 'unknown';
    }
  }
};

const checkDuplicateRegistration = async (activityCode: string, userEmail: string): Promise<{ isDuplicate: boolean; message?: string }> => {
  try {
    const q = query(
      collection(db, 'registrations'),
      where('activityCode', '==', activityCode),
      where('userEmail', '==', userEmail)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      return {
        isDuplicate: true,
        message: 'บัญชีนี้เคยลงทะเบียนกิจกรรมนี้แล้ว'
      };
    }
    
    return { isDuplicate: false };
  } catch (error) {
    console.error('Error checking duplicate registration:', error);
    return { isDuplicate: false };
  }
};

const checkIPRestriction = async (userEmail: string): Promise<{ canLogin: boolean; message?: string; remainingTime?: number }> => {
  try {
    const userIP = await getUserIP();
    const now = new Date();
    
    const q = query(
      collection(db, 'ipLoginRecords'),
      where('ipAddress', '==', userIP)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const existingRecord = querySnapshot.docs[0].data() as IPLoginRecord;
      const expiresAt = existingRecord.expiresAt.toDate();
      
      if (now < expiresAt) {
        if (existingRecord.userEmail === userEmail) {
          return { canLogin: true };
        } else {
          const remainingMs = expiresAt.getTime() - now.getTime();
          const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));
          
          return {
            canLogin: false,
            message: `IP นี้เพิ่งมีการเข้าสู่ระบบด้วยบัญชีอื่น กรุณารออีก ${remainingMinutes} นาที`,
            remainingTime: remainingMinutes
          };
        }
      } else {
        await updateDoc(querySnapshot.docs[0].ref, {
          userEmail: userEmail,
          loginTime: now,
          expiresAt: new Date(now.getTime() + 60 * 60 * 1000)
        });
        return { canLogin: true };
      }
    } else {
      await addDoc(collection(db, 'ipLoginRecords'), {
        ipAddress: userIP,
        userEmail: userEmail,
        loginTime: now,
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000)
      });
      return { canLogin: true };
    }
  } catch (error) {
    console.error('Error checking IP restriction:', error);
    return { canLogin: true };
  }
};

// Update user profile function (ใช้ setDoc แทน updateDoc)
const updateUserProfileInFirestore = async (uid: string, updatedData: Partial<UniversityUserProfile>): Promise<void> => {
  try {
    console.log('เริ่มอัพเดทโปรไฟล์สำหรับผู้ใช้:', uid);
    
    const userDocRef = doc(db, 'users', uid);
    
    // ใช้ setDoc กับ merge: true แทน updateDoc
    await setDoc(userDocRef, {
      ...updatedData,
      updatedAt: new Date()
    }, { merge: true });
    
    console.log('อัพเดทโปรไฟล์สำเร็จ');
    
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

const RegisterPageContent: React.FC = () => {
  const searchParams = useSearchParams();
  const activityCode = searchParams.get('activity') || '';
  
  const { user, userData, loading: authLoading, login, logout } = useAuth();
  
  // State management
  const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(null);
  const [activityData, setActivityData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [validActivity, setValidActivity] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Session management states
  const [sessionExpired, setSessionExpired] = useState(false);
  const [sessionWarning, setSessionWarning] = useState('');
  const [sessionRemainingTime, setSessionRemainingTime] = useState(0);
  const [sessionValidating, setSessionValidating] = useState(false);
  
  // IP restriction states
  const [ipBlocked, setIpBlocked] = useState(false);
  const [blockRemainingTime, setBlockRemainingTime] = useState(0);
  const [checkingIP, setCheckingIP] = useState(false);
  
  // Duplicate registration states
  const [isDuplicateRegistration, setIsDuplicateRegistration] = useState(false);
  
  // Profile edit dialog state
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);

  // Initial session validation when user is detected
  useEffect(() => {
    if (user && !sessionExpired && !sessionValidating) {
      validateInitialSession();
    }
  }, [user]);

  // Session monitoring interval
  useEffect(() => {
    let sessionCheckInterval: NodeJS.Timeout;

    if (user && !sessionExpired) {
      // ตั้งค่าการตรวจสอบเซสชันทุก 2 นาที (หลังจากตรวจสอบครั้งแรกแล้ว)
      sessionCheckInterval = setInterval(() => {
        validateUserSession(false); // false = ไม่ใช่ initial check
      }, 120000);
    }

    return () => {
      if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
      }
    };
  }, [user, sessionExpired]);

  const validateInitialSession = async () => {
    if (!user?.uid) return;
    
    setSessionValidating(true);
    console.log('Validating initial session for user:', user.uid);

    try {
      // รอ 2 วินาทีเพื่อให้ session ถูกสร้างเสร็จก่อน (ถ้าเพิ่งเข้าสู่ระบบ)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const sessionResult = await SessionManager.validateSession(user.uid);
      console.log('Initial session validation result:', sessionResult);
      
      if (!sessionResult.isValid) {
        console.log('Session is invalid:', sessionResult.message);
        setSessionExpired(true);
        setError(sessionResult.message || 'เซสชันหมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่');
        return;
      }

      console.log('Session is valid, remaining time:', sessionResult.remainingTime);
      setSessionRemainingTime(sessionResult.remainingTime || 0);
      setSessionExpired(false);
      
      // แสดงการเตือนเมื่อเหลือเวลา 5 นาที
      if (sessionResult.remainingTime && sessionResult.remainingTime <= 5) {
        setSessionWarning(`เซสชันจะหมดอายุในอีก ${sessionResult.remainingTime} นาที กรุณาเตรียมตัวเข้าสู่ระบบใหม่`);
      } else {
        setSessionWarning('');
      }
    } catch (error) {
      console.error('Error validating initial session:', error);
      // ถ้า error ในการตรวจสอบ session แต่ยัง login อยู่ ให้ถือว่าใช้ได้
      console.log('Session validation error, but user still logged in - assuming valid');
    } finally {
      setSessionValidating(false);
    }
  };

  const validateUserSession = async (isInitial: boolean = false) => {
    if (!user?.uid) return;

    try {
      const sessionResult = await SessionManager.validateSession(user.uid);
      
      if (!sessionResult.isValid) {
        console.log('Session validation failed:', sessionResult.message);
        setSessionExpired(true);
        setError(sessionResult.message || 'เซสชันหมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่');
        setSessionWarning('');
        return;
      }

      setSessionRemainingTime(sessionResult.remainingTime || 0);
      
      // แสดงการเตือนเมื่อเหลือเวลา 5 นาที
      if (sessionResult.remainingTime && sessionResult.remainingTime <= 5) {
        setSessionWarning(`เซสชันจะหมดอายุในอีก ${sessionResult.remainingTime} นาที กรุณาเตรียมตัวเข้าสู่ระบบใหม่`);
      } else {
        setSessionWarning('');
      }
      
      // ถ้าเป็นการตรวจสอบครั้งแรกและมี error อยู่ ให้ล้าง error
      if (isInitial && error && !sessionExpired) {
        setError('');
      }
    } catch (error) {
      console.error('Error validating session:', error);
    }
  };

  // Activity status helpers
  const getActivityStatus = (activity: ActivityData) => {
    const now = new Date();
    const startTime = activity.startDateTime?.toDate() || new Date();
    const endTime = activity.endDateTime?.toDate() || new Date();
    
    if (!activity.isActive) return { 
      status: 'inactive' as const, 
      message: 'กิจกรรมนี้ถูกปิดใช้งานแล้ว' 
    };
    if (now < startTime) return { 
      status: 'upcoming' as const, 
      message: `กิจกรรมจะเปิดลงทะเบียนในวันที่ ${startTime.toLocaleString('th-TH')}`,
      startTime 
    };
    if (now > endTime) return { 
      status: 'ended' as const, 
      message: `กิจกรรมสิ้นสุดแล้วเมื่อวันที่ ${endTime.toLocaleString('th-TH')}`,
      endTime 
    };
    
    if (activity.maxParticipants > 0 && activity.currentParticipants >= activity.maxParticipants) {
      return { 
        status: 'full' as const, 
        message: 'กิจกรรมนี้มีผู้สมัครครบจำนวนแล้ว'
      };
    }
    
    return { status: 'active' as const, message: '' };
  };

  // Check conditions
  const canProceedToRegistration = () => {
    if (!activityData) return false;
    if (!user) return false;
    if (sessionExpired) return false;
    if (sessionValidating) return false;
    if (ipBlocked) return false;
    if (isDuplicateRegistration) return false;
    if (needsProfileSetup) return false;
    return true;
  };

  const shouldShowMicrosoftLogin = () => {
    return (!user || sessionExpired) && !ipBlocked && !isDuplicateRegistration;
  };

  // Determine existing auth status for ActivityRegistrationForm
  const getExistingAuthStatus = (): boolean => {
    return !!(user && userData && !sessionExpired && !sessionValidating);
  };

  // Effects
  useEffect(() => {
    loadInitialData();
  }, [activityCode]);

  useEffect(() => {
    if (user && activityCode && !isDuplicateRegistration && !sessionExpired && !sessionValidating) {
      checkForDuplicateRegistration();
    }
  }, [user, activityCode, sessionExpired, sessionValidating]);

  useEffect(() => {
    if (user && userData !== null && !sessionExpired && !sessionValidating) {
      const needsSetup = !userData?.firstName || !userData?.lastName;
      setNeedsProfileSetup(needsSetup);
      
      if (needsSetup && !showProfileDialog) {
        setShowProfileDialog(true);
      }
    }
  }, [user, userData, showProfileDialog, sessionExpired, sessionValidating]);

  useEffect(() => {
    if (activityData?.id) {
      const unsubscribe = onSnapshot(doc(db, 'activityQRCodes', activityData.id), (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setActivityData(prev => prev ? {
            ...prev,
            currentParticipants: data.currentParticipants || 0,
            isActive: data.isActive !== undefined ? data.isActive : true
          } : prev);
        }
      });

      return () => unsubscribe();
    }
  }, [activityData?.id]);

  // Event handlers
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

      const q = query(
        collection(db, 'activityQRCodes'),
        where('activityCode', '==', activityCode)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('ไม่พบรหัสกิจกรรมนี้ในระบบ กรุณาติดต่อผู้ดูแล');
        setValidActivity(false);
      } else {
        const docRef = querySnapshot.docs[0];
        const docData = docRef.data();
        const activity: ActivityData = {
          id: docRef.id,
          ...docData,
          currentParticipants: docData.currentParticipants || 0,
          latitude: docData.latitude || 13.7563,
          longitude: docData.longitude || 100.5018,
          checkInRadius: docData.checkInRadius || 100,
          userCode: docData.userCode || '',
          requiresUniversityLogin: docData.requiresUniversityLogin || false
        } as ActivityData;

        setActivityData(activity);

        const statusInfo = getActivityStatus(activity);
        
        if (statusInfo.status === 'active') {
          setValidActivity(true);
        } else {
          setValidActivity(false);
        }
      }
    } catch (err) {
      console.error('Error loading admin settings or activity:', err);
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  const checkForDuplicateRegistration = async () => {
    if (!user?.email || !activityCode) return;

    try {
      const result = await checkDuplicateRegistration(activityCode, user.email);
      setIsDuplicateRegistration(result.isDuplicate);
      if (result.isDuplicate && result.message) {
        setError(result.message);
      }
    } catch (error) {
      console.error('Error checking duplicate registration:', error);
    }
  };

  const handlePreLoginCheck = async (userEmail: string): Promise<boolean> => {
    setCheckingIP(true);
    
    try {
      const ipCheck = await checkIPRestriction(userEmail);
      
      if (!ipCheck.canLogin) {
        setIpBlocked(true);
        setBlockRemainingTime(ipCheck.remainingTime || 60);
        setError(ipCheck.message || 'ไม่สามารถเข้าสู่ระบบได้');
        return false;
      }
      
      setIpBlocked(false);
      setError('');
      return true;
    } catch (error) {
      console.error('Error in pre-login check:', error);
      return true;
    } finally {
      setCheckingIP(false);
    }
  };

  const handleLoginSuccess = async (userProfile: any) => {
    console.log('Login successful:', userProfile);
    
    try {
      const userIP = await getUserIP();
      const now = new Date();
      
      const q = query(
        collection(db, 'ipLoginRecords'),
        where('ipAddress', '==', userIP)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        await updateDoc(querySnapshot.docs[0].ref, {
          userEmail: userProfile.email,
          loginTime: now,
          expiresAt: new Date(now.getTime() + 60 * 60 * 1000)
        });
      }
      
      // Reset session states
      setSessionExpired(false);
      setSessionWarning('');
      setError('');
      
      if (activityCode) {
        setTimeout(() => {
          checkForDuplicateRegistration();
        }, 1000);
      }
    } catch (error) {
      console.error('Error updating IP record after login:', error);
    }
  };

  const handleLoginError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleLogout = async () => {
    try {
      // ทำลาย session ก่อน logout หาก user มี uid
      if (user?.uid) {
        await SessionManager.destroySession(user.uid);
      }
      
      await logout();
      setError('');
      setSuccessMessage('');
      setIpBlocked(false);
      setBlockRemainingTime(0);
      setIsDuplicateRegistration(false);
      setNeedsProfileSetup(false);
      setSessionExpired(false);
      setSessionWarning('');
      setSessionRemainingTime(0);
      setSessionValidating(false);
    } catch (error) {
      console.error('Logout error:', error);
      setError('เกิดข้อผิดพลาดในการออกจากระบบ');
    }
  };

  const handleSessionExpired = () => {
    setSessionExpired(true);
    setSessionWarning('');
    setError('เซสชันหมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่เพื่อดำเนินการต่อ');
  };

  const handleIPBlockExpired = () => {
    setIpBlocked(false);
    setBlockRemainingTime(0);
    setError('');
  };

  const handleEditProfile = () => {
    setShowProfileDialog(true);
  };

  const handleSaveProfile = async (updatedData: Partial<UniversityUserProfile>) => {
    try {
      if (!user?.uid) throw new Error('ไม่พบข้อมูลผู้ใช้');
      
      // Use the local function since updateUserProfile is not available in useAuth
      await updateUserProfileInFirestore(user.uid, updatedData);
      setNeedsProfileSetup(false);
      setSuccessMessage('บันทึกข้อมูลเรียบร้อยแล้ว');
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error: any) {
      throw new Error(error.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  const handleRegistrationSuccess = async () => {
    if (activityData) {
      try {
        const docRef = doc(db, 'activityQRCodes', activityData.id);
        await updateDoc(docRef, {
          currentParticipants: increment(1)
        });
        
        if (user?.email) {
          await addDoc(collection(db, 'registrations'), {
            activityCode: activityCode,
            userEmail: user.email,
            registeredAt: new Date()
          });
        }
        
        setActivityData(prev => prev ? {
          ...prev,
          currentParticipants: prev.currentParticipants + 1
        } : prev);
      } catch (error) {
        console.error('Error updating participant count:', error);
      }
    }
  };

  // Render loading state
  if (loading || authLoading || sessionValidating) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        minHeight: '50vh',
        flexDirection: 'column',
        gap: 2
      }}>
        <CircularProgress size={40} />
        <Typography variant="body1" color="text.secondary">
          {sessionValidating ? 'กำลังตรวจสอบเซสชัน...' : 'กำลังโหลดข้อมูล...'}
        </Typography>
      </Box>
    );
  }

  // Render error state (non-recoverable errors)
  if (error && !ipBlocked && !isDuplicateRegistration && !successMessage && !sessionExpired && !sessionWarning) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
        <Button 
          color="inherit" 
          size="small" 
          onClick={loadInitialData}
          sx={{ ml: 2 }}
          startIcon={<RefreshIcon />}
        >
          ลองใหม่
        </Button>
      </Alert>
    );
  }

  // Get activity status for conditional rendering
  const activityStatus = activityData ? getActivityStatus(activityData) : null;

  return (
    <>
      {/* Navigation Bar */}
      <NavigationBar 
        user={user}
        userData={userData}
        onLogout={handleLogout}
        onEditProfile={handleEditProfile}
      />

      {/* Success Message */}
      {successMessage && (
        <SuccessAlert 
          message={successMessage}
          onClose={() => setSuccessMessage('')}
        />
      )}

      {/* Session Warning Alert */}
      {sessionWarning && !sessionExpired && (
        <Alert 
          severity="warning" 
          sx={{ mt: 2 }}
          icon={<TimeIcon />}
        >
          <Typography variant="body2" fontWeight="medium">
            {sessionWarning}
          </Typography>
        </Alert>
      )}

      {/* Session Expired Alert */}
      {sessionExpired && (
        <Alert 
          severity="error" 
          sx={{ mt: 2 }}
          icon={<WarningIcon />}
        >
          <Typography variant="body1" fontWeight="medium">
            เซสชันหมดอายุแล้ว
          </Typography>
          <Typography variant="body2" color="text.secondary">
            เซสชันการเข้าสู่ระบบของคุณหมดอายุแล้ว (30 นาที) กรุณาเข้าสู่ระบบใหม่เพื่อดำเนินการต่อ
          </Typography>
        </Alert>
      )}

      {/* Activity Banner */}
      {activityData && !ipBlocked && (
        <ActivityBanner activity={activityData} />
      )}

      {/* IP Restriction Alert */}
      {ipBlocked && (
        <IPRestrictionAlert 
          remainingTime={blockRemainingTime}
          onClose={handleIPBlockExpired}
        />
      )}

      {/* Duplicate Registration Alert */}
      {isDuplicateRegistration && user && !sessionExpired && (
        <DuplicateRegistrationAlert />
      )}

      {/* Activity Status Alert (for non-active activities) */}
      {activityData && activityStatus && activityStatus.status !== 'active' && !ipBlocked && (
        <ActivityStatusAlert
          status={activityStatus.status}
          message={activityStatus.message}
          startTime={activityStatus.startTime}
          endTime={activityStatus.endTime}
        />
      )}

      {/* Microsoft Login Section */}
      {shouldShowMicrosoftLogin() && activityData && validActivity && (
        <MicrosoftAuthSection
          activityData={activityData}
          onLoginSuccess={handleLoginSuccess}
          onLoginError={handleLoginError}
          onPreLoginCheck={handlePreLoginCheck}
          checkingIP={checkingIP}
        />
      )}

      {/* Profile Setup Alert */}
      {user && needsProfileSetup && !ipBlocked && !isDuplicateRegistration && !sessionExpired && !sessionValidating && (
        <ProfileSetupAlert onEditProfile={handleEditProfile} />
      )}

      {/* Activity Information Card */}
      {activityData && !ipBlocked && !isDuplicateRegistration && !sessionExpired && !sessionValidating && (
        <ActivityInfoCard 
          activity={activityData}
          showRegistrationButton={canProceedToRegistration()}
        />
      )}

      {/* Registration Form */}
      {validActivity && adminSettings && activityCode && canProceedToRegistration() && (
        <ActivityRegistrationForm
          activityCode={activityCode}
          adminSettings={adminSettings}
          existingAuthStatus={getExistingAuthStatus()}
          onSuccess={handleRegistrationSuccess}
        />
      )}

      {/* Profile Edit Dialog */}
      <ProfileEditDialog
        open={showProfileDialog}
        onClose={() => {
          setShowProfileDialog(false);
          // หากยังต้องการข้อมูล ให้เปิด dialog อีกครั้งหลัง 500ms
          if (needsProfileSetup && !sessionExpired && !sessionValidating) {
            setTimeout(() => {
              setShowProfileDialog(true);
            }, 500);
          }
        }}
        user={user}
        userData={userData}
        onSave={handleSaveProfile}
      />
    </>
  );
};

// Main RegisterPage Component
const RegisterPage: React.FC = () => {
  return (
    <Box sx={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%)'
    }}>
      <Container maxWidth="md" sx={{ py: 0 }}>
        <Suspense fallback={
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            minHeight: '50vh',
            flexDirection: 'column',
            gap: 2
          }}>
            <CircularProgress size={40} />
            <Typography variant="body1" color="text.secondary">
              กำลังโหลดหน้าลงทะเบียน...
            </Typography>
          </Box>
        }>
          <RegisterPageContent />
        </Suspense>
      </Container>
    </Box>
  );
};

export default RegisterPage;