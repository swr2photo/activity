// components/ActivityCard.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
  LinearProgress,
  useTheme,
  Skeleton,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { AccessTime, People, LocationOn, QrCode } from '@mui/icons-material';

type ActivityCardProps = {
  id: string;
  activityCode: string;
  activityName: string;
  location?: string;
  startDateTime?: any;
  endDateTime?: any;
  maxParticipants?: number;
  currentParticipants?: number;
  bannerUrl?: string;
  bannerColor?: string;
  status: { key: string; label: string; tone: string };
  canOpen: boolean;
  bannerAspect?: string;
};

const formatDateTime = (d: any) => {
  if (!d) return '-';
  const dd: Date = d?.toDate?.() ?? (d instanceof Date ? d : new Date(d));
  return dd.toLocaleString('th-TH', { 
    year: '2-digit', 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

const ActivityCard: React.FC<ActivityCardProps> = ({
  activityCode,
  activityName,
  location,
  startDateTime,
  endDateTime,
  maxParticipants,
  currentParticipants,
  bannerUrl,
  bannerColor,
  status,
  canOpen,
  bannerAspect = 'cover'
}) => {
  const theme = useTheme();
  const [imageLoaded, setImageLoaded] = useState(false);

  const startText = formatDateTime(startDateTime);
  const endText = formatDateTime(endDateTime);
  
  const cur = currentParticipants || 0;
  const max = maxParticipants || 0;
  const hasCapacity = max > 0;
  const percent = hasCapacity ? Math.min(100, Math.round((cur / max) * 100)) : 0;

  const getStatusColor = (key: string) => {
    switch (key) {
      case 'active': return 'success';
      case 'upcoming': return 'info';
      case 'full': return 'warning';
      case 'ended': return 'error';
      default: return 'default';
    }
  };

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '20px',
        border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        bgcolor: theme.palette.mode === 'dark' ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        '&:hover': {
          transform: 'translateY(-6px) scale(1.01)',
          boxShadow: '0 30px 60px rgba(0, 0, 0, 0.08)',
          borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)',
        },
      }}
    >
      {/* Banner Section */}
      <Box sx={{ position: 'relative', height: { xs: 160, md: 190 }, bgcolor: bannerColor || 'grey.100', overflow: 'hidden' }}>
        {bannerUrl ? (
          <>
            <Box
              component="img"
              src={bannerUrl}
              alt={activityName}
              onLoad={() => setImageLoaded(true)}
              sx={{
                width: '100%',
                height: '100%',
                objectFit: bannerAspect as any,
                opacity: imageLoaded ? 1 : 0,
                transition: 'opacity 0.5s ease',
              }}
            />
            {!imageLoaded && <Skeleton variant="rectangular" width="100%" height="100%" sx={{ position: 'absolute', top: 0 }} />}
          </>
        ) : (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
            <QrCode sx={{ fontSize: 60 }} />
          </Box>
        )}
        
        {/* Overlay Gradient สำหรับความอ่านง่าย */}
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 100%)' }} />

        <Chip
          label={status.label}
          color={getStatusColor(status.key) as any}
          size="small"
          sx={{
            position: 'absolute',
            top: 14,
            left: 14,
            fontWeight: 800,
            fontSize: '0.75rem',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
        />
      </Box>

      {/* Content Section */}
      <CardContent sx={{ p: { xs: 2.5, md: 3.5 }, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 800,
            fontSize: { xs: '1.05rem', md: '1.15rem' },
            mb: 0.5,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: '3.1em',
          }}
        >
          {activityName}
        </Typography>

        {location && (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 2, opacity: 0.7 }}>
            <LocationOn sx={{ fontSize: 16 }} />
            <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>{location}</Typography>
          </Stack>
        )}

        <Stack spacing={1.5} sx={{ mb: 3 }}>
          <Stack spacing={0.5}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ color: 'text.secondary' }}>
              <AccessTime sx={{ fontSize: 16 }} />
              <Typography variant="caption" fontWeight={700}>กำหนดการ</Typography>
            </Stack>
            <Box sx={{ pl: 2.8 }}>
              <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 500 }}>เริ่ม: {startText}</Typography>
              <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 500, opacity: 0.8 }}>จบ: {endText}</Typography>
            </Box>
          </Stack>

          {hasCapacity && (
            <Stack spacing={0.8}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary' }}>
                  <People sx={{ fontSize: 16 }} />
                  <Typography variant="caption" fontWeight={700}>สถานะที่ว่าง</Typography>
                </Stack>
                <Typography variant="caption" fontWeight={800} color={percent >= 90 ? 'error.main' : 'text.primary'}>
                  {cur} / {max}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={percent}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: alpha(theme.palette.divider, 0.1),
                  '& .MuiLinearProgress-bar': { borderRadius: 3 }
                }}
              />
            </Stack>
          )}
        </Stack>

        <Box sx={{ flexGrow: 1 }} />

        {/* Action Button - Apple-style rounded button with proper component bindings to prevent routing bugs */}
        <Button
          component={canOpen ? Link : 'button'}
          href={canOpen ? `/register?activity=${encodeURIComponent(activityCode)}` : undefined}
          variant={canOpen ? 'contained' : 'outlined'}
          disabled={!canOpen}
          fullWidth
          sx={{
            borderRadius: '12px',
            py: 1.2,
            fontWeight: 700,
            textTransform: 'none',
            fontSize: '0.95rem',
            backgroundColor: canOpen ? '#0071e3' : 'transparent', // Apple Blue
            color: canOpen ? '#ffffff' : 'text.secondary',
            border: canOpen ? 'none' : '1px solid rgba(0,0,0,0.15)',
            boxShadow: 'none',
            transition: 'all 0.2s ease',
            '&:hover': {
              backgroundColor: canOpen ? '#0077ed' : 'rgba(0,0,0,0.03)',
              boxShadow: 'none',
            },
            '&.Mui-disabled': {
              bgcolor: 'rgba(0, 0, 0, 0.04)',
              color: 'rgba(0, 0, 0, 0.38)',
              borderColor: 'transparent',
            }
          }}
        >
          {canOpen ? 'ลงทะเบียนเข้าร่วม' : status.label}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ActivityCard;