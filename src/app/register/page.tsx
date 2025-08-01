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
  Paper
} from '@mui/material';
import {
  AccessTime as TimeIcon,
  LocationOn as LocationIcon,
  Group as GroupIcon,
  Info as InfoIcon,
  Person as PersonIcon,
  Map as MapIcon,
  MyLocation as MyLocationIcon
} from '@mui/icons-material';
import { GoogleMap, MarkerF, CircleF, useLoadScript } from '@react-google-maps/api';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, increment } from 'firebase/firestore';
import ActivityRegistrationForm from '../../components/ActivityRegistrationForm';
import { db } from '../../lib/firebase';
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
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
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

const RegisterPageContent: React.FC = () => {
  const searchParams = useSearchParams();
  const activityCode = searchParams.get('activity') || '';
  
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
    
    // ตรวจสอบจำนวนผู้เข้าร่วม
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
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
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

          // คำนวณระยะห่าง
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

      // โหลด settings
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

      // ตรวจสอบกิจกรรม
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
          userCode: docData.userCode || ''
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
    // อัพเดทจำนวนผู้เข้าร่วม
    if (activityData) {
      try {
        const docRef = doc(db, 'activityQRCodes', activityData.id);
        await updateDoc(docRef, {
          currentParticipants: increment(1)
        });
        
        // อัพเดท state ในหน้า
        setActivityData(prev => prev ? {
          ...prev,
          currentParticipants: prev.currentParticipants + 1
        } : prev);
      } catch (error) {
        console.error('Error updating participant count:', error);
      }
    }
  };

  if (loading) {
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

              {/* รหัสผู้ใช้ */}
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

      {/* Registration Form */}
      {validActivity && adminSettings && activityCode && (
        <ActivityRegistrationForm
          activityCode={activityCode}
          adminSettings={adminSettings}
        />
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