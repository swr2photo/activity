// components/activity/ActivityInfoCard.tsx
'use client';
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Stack,
  Box,
  Divider,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Badge,
  CircularProgress
} from '@mui/material';
import {
  EventNote as EventIcon,
  Info as InfoIcon,
  LocationOn as LocationIcon,
  Schedule as ScheduleIcon,
  Map as MapIcon,
  MyLocation as MyLocationIcon,
  Group as GroupIcon,
  CheckCircle as CheckIcon,
  Close as CloseIcon,
  Warning as WarningIcon,
  PersonOff as PersonOffIcon
} from '@mui/icons-material';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import ActivityLocationMap from './ActivityLocationMap';

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

interface ActivityInfoCardProps {
  activity: ActivityData;
  showRegistrationButton?: boolean;
}

// Enhanced Participant Counter Component
const ParticipantCounter: React.FC<{
  currentParticipants: number;
  maxParticipants: number;
  activityId: string;
}> = ({ currentParticipants, maxParticipants, activityId }) => {
  const [realTimeCount, setRealTimeCount] = useState(currentParticipants);

  useEffect(() => {
    // Real-time listener for participant count
    const unsubscribe = onSnapshot(doc(db, 'activityQRCodes', activityId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setRealTimeCount(data.currentParticipants || 0);
      }
    });

    return () => unsubscribe();
  }, [activityId]);

  if (maxParticipants <= 0) return null;

  const percentage = Math.min((realTimeCount / maxParticipants) * 100, 100);
  const isFull = realTimeCount >= maxParticipants;
  const isNearFull = percentage > 80;

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <GroupIcon fontSize="small" />
          จำนวนผู้เข้าร่วม
        </Typography>
        <Badge
          badgeContent={
            isFull ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <PersonOffIcon fontSize="small" />
                เต็มแล้ว
              </Box>
            ) : isNearFull ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <WarningIcon fontSize="small" />
                ใกล้เต็ม
              </Box>
            ) : ""
          }
          color={isFull ? "error" : isNearFull ? "warning" : "default"}
          sx={{
            '& .MuiBadge-badge': {
              fontSize: '0.6rem',
              height: 16,
              minWidth: 16
            }
          }}
        >
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 'bold',
              color: isFull ? 'error.main' : isNearFull ? 'warning.main' : 'success.main'
            }}
          >
            {realTimeCount}/{maxParticipants}
          </Typography>
        </Badge>
      </Box>
      
      <LinearProgress
        variant="determinate"
        value={percentage}
        sx={{
          height: 12,
          borderRadius: 6,
          bgcolor: 'grey.200',
          '& .MuiLinearProgress-bar': {
            borderRadius: 6,
            bgcolor: isFull ? 'error.main' : isNearFull ? 'warning.main' : 'success.main',
            background: isFull 
              ? 'linear-gradient(90deg, #f87171 0%, #ef4444 100%)'
              : isNearFull 
                ? 'linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)'
                : 'linear-gradient(90deg, #34d399 0%, #10b981 100%)'
          }
        }}
      />
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {percentage.toFixed(1)}% ของจำนวนที่รับ
        </Typography>
        <Typography variant="caption" color="text.secondary">
          เหลือ {Math.max(0, maxParticipants - realTimeCount)} ที่นั่ง
        </Typography>
      </Box>
    </Box>
  );
};

const ActivityInfoCard: React.FC<ActivityInfoCardProps> = ({ 
  activity, 
  showRegistrationButton = false 
}) => {
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);

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

          const distance = calculateDistance(
            userPos.lat,
            userPos.lng,
            activity.latitude,
            activity.longitude
          );

          if (distance <= activity.checkInRadius) {
            setLocationError(`คุณอยู่ในพื้นที่กิจกรรม (ห่างจากจุดกิจกรรม ${Math.round(distance)} เมตร)`);
          } else {
            setLocationError(`คุณอยู่นอกพื้นที่กิจกรรม (ห่างจากจุดกิจกรรม ${Math.round(distance)} เมตร - ต้องอยู่ในรัศมี ${activity.checkInRadius} เมตร)`);
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

  return (
    <>
      <Card sx={{ 
        mb: 4,
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
        border: '1px solid rgba(255,255,255,0.2)'
      }}>
        <CardContent>
          <Typography variant="h5" gutterBottom sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            color: 'primary.main',
            fontWeight: 'bold'
          }}>
            <EventIcon />
            รายละเอียดกิจกรรม
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Stack spacing={3}>
            {activity.description && (
              <Box sx={{ 
                p: 2, 
                bgcolor: 'grey.50', 
                borderRadius: 2,
                borderLeft: '4px solid',
                borderLeftColor: 'primary.main'
              }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <InfoIcon color="primary" fontSize="small" sx={{ mt: 0.5 }} />
                  <Box>
                    <Typography variant="subtitle2" gutterBottom color="primary.main">
                      รายละเอียดกิจกรรม
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {activity.description}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}
            
            {activity.location && (
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <LocationIcon color="action" fontSize="small" sx={{ mt: 0.5 }} />
                <Box>
                  <Typography variant="subtitle2" gutterBottom>สถานที่</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {activity.location}
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
                  พิกัด: {activity.latitude.toFixed(6)}, {activity.longitude.toFixed(6)}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  รัศมีเช็คอิน: {activity.checkInRadius} เมตร
                </Typography>
                
                <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<MapIcon />}
                    onClick={() => setShowLocationDialog(true)}
                    sx={{
                      borderColor: 'primary.main',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
                      }
                    }}
                  >
                    ดูแผนที่
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={locationLoading ? <CircularProgress size={16} /> : <MyLocationIcon />}
                    onClick={getCurrentLocation}
                    disabled={locationLoading}
                    sx={{
                      borderColor: 'success.main',
                      color: 'success.main',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)'
                      }
                    }}
                  >
                    {locationLoading ? 'กำลังค้นหา...' : 'ตรวจสอบตำแหน่งของฉัน'}
                  </Button>
                </Box>

                {locationError && (
                  <Alert 
                    severity={locationError.includes('อยู่ในพื้นที่กิจกรรม') ? 'success' : locationError.includes('อยู่นอกพื้นที่กิจกรรม') ? 'error' : 'warning'} 
                    sx={{ 
                      mt: 2,
                      background: locationError.includes('อยู่ในพื้นที่กิจกรรม') 
                        ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)'
                        : locationError.includes('อยู่นอกพื้นที่กิจกรรม')
                          ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)'
                          : 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
                    }}
                    icon={
                      locationError.includes('อยู่ในพื้นที่กิจกรรม') ? <CheckIcon /> :
                      locationError.includes('อยู่นอกพื้นที่กิจกรรม') ? <CloseIcon /> :
                      <WarningIcon />
                    }
                  >
                    {locationError}
                  </Alert>
                )}
              </Box>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <ScheduleIcon color="action" fontSize="small" sx={{ mt: 0.5 }} />
              <Box>
                <Typography variant="subtitle2" gutterBottom>วันเวลา</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ 
                    p: 1.5, 
                    bgcolor: 'success.50', 
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'success.200',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}>
                    <ScheduleIcon color="success" fontSize="small" />
                    <Typography variant="body2" color="success.dark" fontWeight="medium">
                      เริ่ม: {activity.startDateTime?.toDate()?.toLocaleString('th-TH') || 'ไม่ระบุ'}
                    </Typography>
                  </Box>
                  <Box sx={{ 
                    p: 1.5, 
                    bgcolor: 'error.50', 
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'error.200',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}>
                    <ScheduleIcon color="error" fontSize="small" />
                    <Typography variant="body2" color="error.dark" fontWeight="medium">
                      สิ้นสุด: {activity.endDateTime?.toDate()?.toLocaleString('th-TH') || 'ไม่ระบุ'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
            
            {/* Enhanced Participant Counter */}
            {activity.maxParticipants > 0 && (
              <Box sx={{ 
                p: 2, 
                background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                borderRadius: 2,
                border: '1px solid #0ea5e9'
              }}>
                <ParticipantCounter
                  currentParticipants={activity.currentParticipants}
                  maxParticipants={activity.maxParticipants}
                  activityId={activity.id}
                />
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Location Dialog */}
      <Dialog 
        open={showLocationDialog} 
        onClose={() => setShowLocationDialog(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white'
        }}>
          <MapIcon />
          ตำแหน่งกิจกรรม: {activity.activityName}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box>
            <Stack spacing={1} sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CheckIcon fontSize="small" color="success" />
                วงกลมสีเขียวแสดงพื้นที่ที่สามารถเช็คอินได้ (รัศมี {activity.checkInRadius} เมตร)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <LocationIcon fontSize="small" color="error" />
                หมุดสีแดงแสดงจุดกิจกรรม
              </Typography>
              {userLocation && (
                <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <MyLocationIcon fontSize="small" color="primary" />
                  จุดสีน้ำเงินแสดงตำแหน่งของคุณ
                </Typography>
              )}
            </Stack>
            
            <ActivityLocationMap
              latitude={activity.latitude}
              longitude={activity.longitude}
              radius={activity.checkInRadius}
              activityName={activity.activityName}
              userLocation={userLocation}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setShowLocationDialog(false)}>
            ปิด
          </Button>
          <Button 
            onClick={getCurrentLocation} 
            variant="contained" 
            startIcon={locationLoading ? <CircularProgress size={16} /> : <MyLocationIcon />}
            disabled={locationLoading}
            sx={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)'
              }
            }}
          >
            {locationLoading ? 'กำลังค้นหา...' : 'ค้นหาตำแหน่งของฉัน'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ActivityInfoCard;