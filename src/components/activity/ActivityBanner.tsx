// components/activity/ActivityBanner.tsx
'use client';
import React, { useState } from 'react';
import {
  Card,
  Box,
  Typography,
  Chip
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  HourglassEmpty as HourglassIcon,
  PersonOff as PersonOffIcon,
  Schedule as ScheduleIcon,
  Room as RoomIcon,
  Group as GroupIcon
} from '@mui/icons-material';

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

interface ActivityBannerProps {
  activity: ActivityData;
}

const ActivityBanner: React.FC<ActivityBannerProps> = ({ activity }) => {
  const [imageError, setImageError] = useState(false);

  // สร้าง gradient สวยๆ ตาม status ของกิจกรรม
  const getGradient = () => {
    const now = new Date();
    const startTime = activity.startDateTime?.toDate() || new Date();
    const endTime = activity.endDateTime?.toDate() || new Date();
    
    if (!activity.isActive) {
      return 'linear-gradient(135deg, #64748b 0%, #475569 100%)'; // Gray for inactive
    }
    if (now < startTime) {
      return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'; // Orange for upcoming
    }
    if (now > endTime) {
      return 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'; // Gray for ended
    }
    return 'linear-gradient(135deg, #10b981 0%, #059669 100%)'; // Green for active
  };

  const getStatusInfo = () => {
    const now = new Date();
    const startTime = activity.startDateTime?.toDate() || new Date();
    const endTime = activity.endDateTime?.toDate() || new Date();
    
    if (!activity.isActive) return { text: 'ปิดใช้งาน', color: 'error' as const, icon: <CancelIcon fontSize="small" /> };
    if (now < startTime) return { text: 'รอเปิด', color: 'warning' as const, icon: <HourglassIcon fontSize="small" /> };
    if (now > endTime) return { text: 'สิ้นสุดแล้ว', color: 'default' as const, icon: <CheckIcon fontSize="small" /> };
    
    if (activity.maxParticipants > 0 && activity.currentParticipants >= activity.maxParticipants) {
      return { text: 'เต็มแล้ว', color: 'error' as const, icon: <PersonOffIcon fontSize="small" /> };
    }
    
    return { text: 'เปิดลงทะเบียน', color: 'success' as const, icon: <CheckIcon fontSize="small" /> };
  };

  const statusInfo = getStatusInfo();

  return (
    <Card sx={{ mb: 3, overflow: 'hidden', position: 'relative' }}>
      {/* Background Banner */}
      <Box
        sx={{
          position: 'relative',
          height: { xs: 200, sm: 250, md: 300 },
          background: activity.bannerUrl && !imageError 
            ? `url(${activity.bannerUrl})` 
            : getGradient(),
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          alignItems: 'flex-end',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 100%)',
            zIndex: 1
          }
        }}
      >
        {/* Hidden image for error detection */}
        {activity.bannerUrl && (
          <img
            src={activity.bannerUrl}
            alt=""
            style={{ display: 'none' }}
            onError={() => setImageError(true)}
            onLoad={() => setImageError(false)}
          />
        )}

        {/* Status Badge */}
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 2
          }}
        >
          <Chip
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {statusInfo.icon}
                {statusInfo.text}
              </Box>
            }
            color={statusInfo.color}
            variant="filled"
            sx={{
              bgcolor: 'rgba(255,255,255,0.9)',
              color: statusInfo.color === 'success' ? 'success.dark' : 
                    statusInfo.color === 'warning' ? 'warning.dark' : 
                    statusInfo.color === 'error' ? 'error.dark' : 'text.primary',
              fontWeight: 'bold',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
          />
        </Box>

        {/* Activity Info Overlay */}
        <Box
          sx={{
            position: 'relative',
            zIndex: 2,
            p: 3,
            width: '100%',
            color: 'white'
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            sx={{
              fontWeight: 'bold',
              textShadow: '2px 2px 4px rgba(0,0,0,0.7)',
              fontSize: { xs: '1.75rem', sm: '2.125rem', md: '2.5rem' }
            }}
          >
            {activity.activityName}
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Chip
              label={`รหัส: ${activity.activityCode}`}
              size="small"
              sx={{
                bgcolor: 'rgba(255,255,255,0.2)',
                color: 'white',
                fontFamily: 'monospace',
                backdropFilter: 'blur(10px)'
              }}
            />
            {activity.requiresUniversityLogin && (
              <Chip
                label="ต้องใช้บัญชีมหาวิทยาลัย"
                size="small"
                sx={{
                  bgcolor: 'rgba(59, 130, 246, 0.8)',
                  color: 'white',
                  backdropFilter: 'blur(10px)'
                }}
              />
            )}
          </Box>

          {/* Quick Info */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ScheduleIcon sx={{ fontSize: '1rem' }} />
              <Typography variant="caption" sx={{ textShadow: '1px 1px 2px rgba(0,0,0,0.7)' }}>
                {activity.startDateTime?.toDate()?.toLocaleDateString('th-TH')}
              </Typography>
            </Box>
            
            {activity.location && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <RoomIcon sx={{ fontSize: '1rem' }} />
                <Typography variant="caption" sx={{ textShadow: '1px 1px 2px rgba(0,0,0,0.7)' }}>
                  {activity.location}
                </Typography>
              </Box>
            )}
            
            {activity.maxParticipants > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <GroupIcon sx={{ fontSize: '1rem' }} />
                <Typography variant="caption" sx={{ textShadow: '1px 1px 2px rgba(0,0,0,0.7)' }}>
                  {activity.currentParticipants}/{activity.maxParticipants} คน
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Card>
  );
};

export default ActivityBanner;