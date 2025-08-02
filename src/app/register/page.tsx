'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Container,
  CircularProgress,
  Alert,
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Divider,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import {
  AccessTime as TimeIcon,
  LocationOn as LocationIcon,
  Group as GroupIcon,
  Info as InfoIcon,
  Person as PersonIcon,
  Map as MapIcon,
  MyLocation as MyLocationIcon,
  CheckCircle as CheckIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import { GoogleMap, MarkerF, CircleF, useLoadScript } from '@react-google-maps/api';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, increment } from 'firebase/firestore';
import ActivityRegistrationForm from '../../components/ActivityRegistrationForm';
import MicrosoftLogin from '../../components/MicrosoftLogin';
import { db } from '../../lib/firebase';
import { useAuth, UniversityUserProfile } from '../../lib/firebaseAuth';
import { AdminSettings } from '../../types';

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
  createdAt?: any;
  updatedAt?: any;
}

const mapContainerStyle = {
  width: '100%',
  height: '300px',
};

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ['places'];

const ActivityLocationMap: React.FC<{ 
  latitude: number; 
  longitude: number; 
  radius: number; 
  activityName: string;
  userLocation?: { lat: number; lng: number } | null;
}> = ({ latitude, longitude, radius, activityName, userLocation }) => {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  const center = { lat: latitude, lng: longitude };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  if (loadError) {
    return (
      <Alert severity="error">
        ไม่สามารถโหลดแผนที่ได้: {loadError.message}
      </Alert>
    );
  }

  if (!isLoaded) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
        <CircularProgress size={20} sx={{ mr: 1 }} />
        กำลังโหลดแผนที่...
      </Box>
    );
  }

  return (
    <Box>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={16}
        center={center}
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          scaleControl: true,
          streetViewControl: false,
          rotateControl: false,
          fullscreenControl: true,
        }}
      >
        <MarkerF
          position={center}
          title={`ตำแหน่งกิจกรรม: ${activityName}`}
          icon={{
            url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDOC4xMzQgMiA1IDUuMTM0IDUgOUM1IDEyLjA4NSA3LjIxIDE2LjE2MiAxMS4yNSAyMS42NzVDMTEuNTM4IDIyLjEwOCAxMi40NjIgMjIuMTA4IDEyLjc1IDIxLjY3NUMxNi43OSAxNi4xNjIgMTkgMTIuMDg1IDE5IDlDMTkgNS4xMzQgMTUuODY2IDIgMTIgMloiIGZpbGw9IiNmZjAwMDAiLz4KPGNpcmNsZSBjeD0iMTIiIGN5PSI5IiByPSIzIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K',
            scaledSize: new google.maps.Size(32, 32),
          }}
        />
        
        {userLocation && (
          <MarkerF
            position={userLocation}
            title="ตำแหน่งของคุณ"
            icon={{
              url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiMwMDc0ZDkiLz4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iNCIgZmlsbD0id2hpdGUiLz4KPC9zdmc+',
              scaledSize: new google.maps.Size(24, 24),
            }}
          />
        )}
        
        <CircleF
          center={center}
          radius={radius}
          options={{
            fillColor: '#4caf50',
            fillOpacity: 0.2,
            strokeColor: '#4caf50',
            strokeOpacity: 0.8,
            strokeWeight: 2,
          }}
        />
      </GoogleMap>
      
      {userLocation && (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            ข้อมูลตำแหน่ง
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ระยะห่างจากจุดกิจกรรม: {Math.round(calculateDistance(
              userLocation.lat, userLocation.lng, 
              latitude, longitude
            ))} เมตร
          </Typography>
          <Typography variant="body2" color="text.secondary">
            สถานะ: {calculateDistance(userLocation.lat, userLocation.lng, latitude, longitude) <= radius 
              ? '✅ อยู่ในพื้นที่กิจกรรม' 
              : '❌ อยู่นอกพื้นที่กิจกรรม'}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

const RegistrationSteps: React.FC<{ 
  activeStep: number; 
  requiresLogin: boolean;
  isVerified: boolean;
}> = ({ activeStep, requiresLogin, isVerified }) => {
  // เปลี่ยนให้แสดงขั้นตอน login เสมอ
  const steps = requiresLogin 
    ? ['เข้าสู่ระบบ', 'ตรวจสอบสิทธิ์', 'ลงทะเบียน']
    : ['เข้าสู่ระบบ', 'ลงทะเบียน'];

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon />
          ขั้นตอนการลงทะเบียน
        </Typography>
        <Stepper activeStep={activeStep} alternativeLabel>
          {steps.map((label, index) => (
            <Step key={label}>
              <StepLabel
                StepIconProps={{
                  style: {
                    color: index <= activeStep ? '#4caf50' : '#e0e0e0'
                  }
                }}
              >
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
        
        {requiresLogin && !isVerified && activeStep === 1 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>รอการอนุมัติ:</strong> บัญชีของคุณอยู่ระหว่างการตรวจสอบ 
              กรุณารอให้ผู้ดูแลระบบอนุมัติก่อนลงทะเบียนกิจกรรม
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

const RegisterPageContent: React.FC = () => {
  const searchParams = useSearchParams();
  const activityCode = searchParams.get('activity') || '';
  
  const { user, userData, loading: authLoading, login, logout } = useAuth();
  
  const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(null);
  const [activityData, setActivityData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [validActivity, setValidActivity] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, [activityCode]);

  const isActivityActive = (activity: ActivityData) => {
    const now = new Date();
    const startTime = activity.startDateTime?.toDate() || new Date();
    const endTime = activity.endDateTime?.toDate() || new Date();
    
    return activity.isActive && 
           now >= startTime && 
           now <= endTime;
  };

  const getActivityStatus = (activity: ActivityData) => {
    const now = new Date();
    const startTime = activity.startDateTime?.toDate() || new Date();
    const endTime = activity.endDateTime?.toDate() || new Date();
    
    if (!activity.isActive) return { status: 'ปิดใช้งาน', color: 'error' as const, message: 'กิจกรรมนี้ถูกปิดใช้งานแล้ว' };
    if (now < startTime) return { 
      status: 'รอเปิด', 
      color: 'warning' as const, 
      message: `กิจกรรมจะเปิดลงทะเบียนในวันที่ ${startTime.toLocaleString('th-TH')}`
    };
    if (now > endTime) return { 
      status: 'สิ้นสุดแล้ว', 
      color: 'default' as const, 
      message: `กิจกรรมสิ้นสุดแล้วเมื่อวันที่ ${endTime.toLocaleString('th-TH')}`
    };
    
    if (activity.maxParticipants > 0 && activity.currentParticipants >= activity.maxParticipants) {
      return { 
        status: 'เต็มแล้ว', 
        color: 'error' as const, 
        message: 'กิจกรรมนี้มีผู้สมัครครบจำนวนแล้ว'
      };
    }
    
    return { status: 'เปิดลงทะเบียน', color: 'success' as const, message: '' };
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      setLocationLoading(true);
      setLocationError('');
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(userPos);
          setLocationLoading(false);

          if (activityData) {
            const distance = calculateDistance(
              userPos.lat,
              userPos.lng,
              activityData.latitude,
              activityData.longitude
            );

            if (distance <= activityData.checkInRadius) {
              setLocationError(`✅ คุณอยู่ในพื้นที่กิจกรรม (ห่างจากจุดกิจกรรม ${Math.round(distance)} เมตร)`);
            } else {
              setLocationError(`❌ คุณอยู่นอกพื้นที่กิจกรรม (ห่างจากจุดกิจกรรม ${Math.round(distance)} เมตร - ต้องอยู่ในรัศมี ${activityData.checkInRadius} เมตร)`);
            }
          }
        },
        (error) => {
          setLocationLoading(false);
          let errorMessage = 'ไม่สามารถดึงตำแหน่งปัจจุบันได้: ';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += 'ผู้ใช้ปฏิเสธการเข้าถึงตำแหน่ง กรุณาอนุญาตการเข้าถึงตำแหน่งในเบราว์เซอร์';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += 'ไม่สามารถระบุตำแหน่งได้ กรุณาตรวจสอบการเชื่อมต่อ GPS';
              break;
            case error.TIMEOUT:
              errorMessage += 'หมดเวลาในการขอตำแหน่ง กรุณาลองใหม่อีกครั้ง';
              break;
            default:
              errorMessage += 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
              break;
          }
          setLocationError(errorMessage);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000
        }
      );
    } else {
      setLocationError('เบราว์เซอร์ของคุณไม่รองรับการเข้าถึงตำแหน่ง');
    }
  };

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
        
        if (statusInfo.status === 'เปิดลงทะเบียน') {
          setValidActivity(true);
        } else {
          setError(statusInfo.message);
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

  const handleRegistrationSuccess = async () => {
    if (activityData) {
      try {
        const docRef = doc(db, 'activityQRCodes', activityData.id);
        await updateDoc(docRef, {
          currentParticipants: increment(1)
        });
        
        setActivityData(prev => prev ? {
          ...prev,
          currentParticipants: prev.currentParticipants + 1
        } : prev);
      } catch (error) {
        console.error('Error updating participant count:', error);
      }
    }
  };

  const handleLoginSuccess = (userProfile: any) => {
    console.log('Login successful:', userProfile);
  };

  const handleLoginError = (errorMessage: string) => {
    setError(errorMessage);
  };

  // แก้ไขฟังก์ชัน getCurrentStep เพื่อจัดการขั้นตอนใหม่
  const getCurrentStep = () => {
    if (!user) return 0; // ยังไม่ login
    
    if (activityData?.requiresUniversityLogin) {
      if (userData && !userData.isVerified) return 1; // login แล้วแต่ยังไม่ verify
      if (userData && userData.isVerified) return 2; // verify แล้ว พร้อมลงทะเบียน
    } else {
      // กิจกรรมไม่ต้องการ university login แต่ login แล้ว
      return 1; // พร้อมลงทะเบียน
    }
    
    return 0;
  };

  // แก้ไขฟังก์ชัน canProceedToRegistration เพื่อบังคับให้ต้อง login ก่อนเสมอ
  const canProceedToRegistration = () => {
    if (!activityData) return false;
    
    // บังคับให้ต้องมี user (login) เสมอ
    if (!user) return false;
    
    // หากกิจกรรมต้องการ university login จะต้องมีการ verify ด้วย
    if (activityData.requiresUniversityLogin) {
      return userData && userData.isVerified && userData.isActive;
    }
    
    // หากไม่ต้องการ university login แต่ต้อง login อยู่ดี
    return true;
  };

  if (loading || authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
        <Box sx={{ ml: 2, display: 'flex', alignItems: 'center' }}>
          กำลังโหลดข้อมูล...
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
        <Button 
          color="inherit" 
          size="small" 
          onClick={loadInitialData}
          sx={{ ml: 2 }}
        >
          ลองใหม่
        </Button>
      </Alert>
    );
  }

  return (
    <>
      {/* Progress Steps */}
      {activityData && (
        <RegistrationSteps 
          activeStep={getCurrentStep()}
          requiresLogin={activityData.requiresUniversityLogin}
          isVerified={userData?.isVerified || false}
        />
      )}

      {/* Microsoft Login Section - แสดงเสมอ */}
      <MicrosoftLogin
        onLoginSuccess={handleLoginSuccess}
        onLoginError={handleLoginError}
        onLogout={() => setError('')}
      />

      {/* User Verification Status */}
      {activityData?.requiresUniversityLogin && user && userData && !userData.isVerified && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body1" gutterBottom>
            <strong>รอการอนุมัติบัญชี</strong>
          </Typography>
          <Typography variant="body2">
            บัญชีของคุณอยู่ระหว่างการตรวจสอบจากผู้ดูแลระบบ 
            คุณจะสามารถลงทะเบียนกิจกรรมได้หลังจากได้รับการอนุมัติ
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            หากมีข้อสงสัย กรุณาติดต่อผู้ดูแลระบบ
          </Typography>
        </Alert>
      )}

      {/* Activity Information Card */}
      {activityData && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box>
                <Typography variant="h5" gutterBottom>
                  {activityData.activityName}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  รหัสกิจกรรม: {activityData.activityCode}
                </Typography>
                {activityData.requiresUniversityLogin && (
                  <Chip 
                    label="ต้องใช้บัญชีมหาวิทยาลัย" 
                    color="info" 
                    size="small"
                    sx={{ mt: 1 }}
                  />
                )}
              </Box>
              <Chip 
                label={getActivityStatus(activityData).status}
                color={getActivityStatus(activityData).color}
                variant="filled"
              />
            </Box>

            <Divider sx={{ my: 2 }} />

            <Stack spacing={2}>
              {activityData.description && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <InfoIcon color="action" fontSize="small" sx={{ mt: 0.5 }} />
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>รายละเอียด</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {activityData.description}
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* รหัสผู้ใช้ - แสดงเฉพาะเมื่อ login แล้ว */}
              {user && (!activityData.requiresUniversityLogin || (userData?.isVerified)) && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <PersonIcon color="action" fontSize="small" sx={{ mt: 0.5 }} />
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>รหัสผู้ใช้สำหรับลงทะเบียน</Typography>
                    <Paper sx={{ p: 1.5, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}>
                      <Typography variant="h6" color="primary.main" sx={{ fontFamily: 'monospace' }}>
                        {activityData.userCode}
                      </Typography>
                    </Paper>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      กรุณาจดจำรหัสนี้เพื่อใช้ในการลงทะเบียน
                    </Typography>
                  </Box>
                </Box>
              )}
              
              {activityData.location && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <LocationIcon color="action" fontSize="small" sx={{ mt: 0.5 }} />
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>สถานที่</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {activityData.location}
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* ตำแหน่งที่ตั้งและการเช็คอิน */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <MapIcon color="action" fontSize="small" sx={{ mt: 0.5 }} />
                <Box sx={{ width: '100%' }}>
                  <Typography variant="subtitle2" gutterBottom>ตำแหน่งกิจกรรม</Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    พิกัด: {activityData.latitude.toFixed(6)}, {activityData.longitude.toFixed(6)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    รัศมีเช็คอิน: {activityData.checkInRadius} เมตร
                  </Typography>
                  
                  <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<MapIcon />}
                      onClick={() => setShowLocationDialog(true)}
                    >
                      ดูแผนที่
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={locationLoading ? <CircularProgress size={16} /> : <MyLocationIcon />}
                      onClick={getCurrentLocation}
                      disabled={locationLoading}
                    >
                      {locationLoading ? 'กำลังค้นหา...' : 'ตรวจสอบตำแหน่งของฉัน'}
                    </Button>
                  </Box>

                  {locationError && (
                    <Alert 
                      severity={locationError.includes('✅') ? 'success' : locationError.includes('❌') ? 'error' : 'warning'} 
                      sx={{ mt: 2 }}
                    >
                      {locationError}
                    </Alert>
                  )}
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <TimeIcon color="action" fontSize="small" sx={{ mt: 0.5 }} />
                <Box>
                  <Typography variant="subtitle2" gutterBottom>วันเวลา</Typography>
                  <Typography variant="body2" color="text.secondary">
                    เริ่ม: {activityData.startDateTime?.toDate()?.toLocaleString('th-TH') || 'ไม่ระบุ'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    สิ้นสุด: {activityData.endDateTime?.toDate()?.toLocaleString('th-TH') || 'ไม่ระบุ'}
                  </Typography>
                </Box>
              </Box>
              
              {activityData.maxParticipants > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <GroupIcon color="action" fontSize="small" sx={{ mt: 0.5 }} />
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>จำนวนผู้เข้าร่วม</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {activityData.currentParticipants} / {activityData.maxParticipants} คน
                    </Typography>
                    {activityData.maxParticipants > 0 && (
                      <Box sx={{ 
                        width: '100%', 
                        bgcolor: 'grey.200', 
                        borderRadius: 1, 
                        mt: 1,
                        height: 8,
                        overflow: 'hidden'
                      }}>
                        <Box
                          sx={{
                            width: `${Math.min((activityData.currentParticipants / activityData.maxParticipants) * 100, 100)}%`,
                            height: '100%',
                            bgcolor: activityData.currentParticipants >= activityData.maxParticipants 
                              ? 'error.main' 
                              : activityData.currentParticipants / activityData.maxParticipants > 0.8 
                                ? 'warning.main' 
                                : 'success.main',
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </Box>
                    )}
                  </Box>
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Message when not logged in */}
      {validActivity && !user && (
        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ textAlign: 'center' }}>
            <SecurityIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              ต้องเข้าสู่ระบบก่อนลงทะเบียน
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              กรุณาเข้าสู่ระบบด้วยบัญชี Microsoft ก่อนดำเนินการลงทะเบียนกิจกรรม
            </Typography>
            <Alert severity="info">
              การลงทะเบียนกิจกรรมต้องเข้าสู่ระบบเพื่อความปลอดภัยและการจัดการข้อมูล
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Registration Form - แสดงเฉพาะเมื่อผ่านเงื่อนไขครบ */}
      {validActivity && adminSettings && activityCode && canProceedToRegistration() && (
        <ActivityRegistrationForm
          activityCode={activityCode}
          adminSettings={adminSettings}
          onSuccess={handleRegistrationSuccess}
        />
      )}

      {/* Message when login required but not completed for university activities */}
      {validActivity && activityData?.requiresUniversityLogin && user && !canProceedToRegistration() && (
        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ textAlign: 'center' }}>
            <SecurityIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              กิจกรรมนี้ต้องการการยืนยันตัวตนจากมหาวิทยาลัย
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              คุณได้เข้าสู่ระบบแล้ว แต่ยังต้องรอการอนุมัติจากผู้ดูแลระบบ
              เพื่อยืนยันสิทธิ์ในการลงทะเบียนกิจกรรมนี้
            </Typography>
            
            {userData && !userData.isVerified && (
              <Alert severity="warning">
                บัญชีของคุณอยู่ระหว่างการตรวจสอบ กรุณารอการอนุมัติจากผู้ดูแลระบบ
              </Alert>
            )}
            
            {userData && !userData.isActive && (
              <Alert severity="error">
                บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Location Dialog */}
      <Dialog 
        open={showLocationDialog} 
        onClose={() => setShowLocationDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <MapIcon />
          ตำแหน่งกิจกรรม: {activityData?.activityName}
        </DialogTitle>
        <DialogContent>
          {activityData && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                🟢 วงกลมสีเขียวแสดงพื้นที่ที่สามารถเช็คอินได้ (รัศมี {activityData.checkInRadius} เมตร)
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                📍 หมุดสีแดงแสดงจุดกิจกรรม
              </Typography>
              {userLocation && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  🔵 จุดสีน้ำเงินแสดงตำแหน่งของคุณ
                </Typography>
              )}
              
              <ActivityLocationMap
                latitude={activityData.latitude}
                longitude={activityData.longitude}
                radius={activityData.checkInRadius}
                activityName={activityData.activityName}
                userLocation={userLocation}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLocationDialog(false)}>
            ปิด
          </Button>
          <Button 
            onClick={getCurrentLocation} 
            variant="contained" 
            startIcon={locationLoading ? <CircularProgress size={16} /> : <MyLocationIcon />}
            disabled={locationLoading}
          >
            {locationLoading ? 'กำลังค้นหา...' : 'ค้นหาตำแหน่งของฉัน'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

const RegisterPage: React.FC = () => {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Suspense fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
          <Typography variant="body1" sx={{ ml: 2 }}>
            กำลังโหลดหน้าลงทะเบียน...
          </Typography>
        </Box>
      }>
        <RegisterPageContent />
      </Suspense>
    </Container>
  );
};

export default RegisterPage;