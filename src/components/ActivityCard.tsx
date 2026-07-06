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
        borderRadius: '28px', // More rounded, Bento style
        border: '1px solid rgba(0,0,0,0.06)',
        bgcolor: '#ffffff',
        overflow: 'hidden',
        position: 'relative',
        transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          borderRadius: '28px',
          padding: '2px',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.8), rgba(255,255,255,0))',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          pointerEvents: 'none',
        },
        '&:hover': {
          transform: 'translateY(-8px) scale(1.02)',
          boxShadow: '0 30px 60px rgba(0, 0, 0, 0.12), 0 0 40px rgba(0, 113, 227, 0.1) inset',
          borderColor: 'rgba(0, 113, 227, 0.2)',
        },
      }}
    >
      {/* Banner Section */}
      <Box sx={{ position: 'relative', height: { xs: 180, md: 220 }, bgcolor: bannerColor || 'grey.100', overflow: 'hidden' }}>
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
                transition: 'transform 0.7s ease, opacity 0.5s ease',
                '.MuiCard-root:hover &': {
                  transform: 'scale(1.08)' // Image zoom effect on card hover
                }
              }}
            />
            {!imageLoaded && <Skeleton variant="rectangular" width="100%" height="100%" sx={{ position: 'absolute', top: 0 }} />}
          </>
        ) : (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2, transition: 'all 0.7s', '.MuiCard-root:hover &': { transform: 'scale(1.1)', opacity: 0.4 } }}>
            <QrCode sx={{ fontSize: 80 }} />
          </Box>
        )}
        
        {/* Overlay Gradient */}
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 100%)' }} />

        <Chip
          label={status.label}
          color={getStatusColor(status.key) as any}
          size="small"
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            fontWeight: 800,
            fontSize: '0.8rem',
            px: 1,
            py: 1.5,
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        />
      </Box>

      {/* Content Section */}
      <CardContent sx={{ p: { xs: 3, md: 4 }, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 800,
            fontSize: { xs: '1.2rem', md: '1.3rem' },
            mb: 1,
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: '2.6em',
            color: '#1d1d1f',
          }}
        >
          {activityName}
        </Typography>

        {location && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2.5, color: '#86868b' }}>
            <LocationOn sx={{ fontSize: 18 }} />
            <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{location}</Typography>
          </Stack>
        )}

        <Stack spacing={2} sx={{ mb: 4, bgcolor: '#f5f5f7', p: 2, borderRadius: '16px' }}>
          <Stack spacing={0.5}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ color: 'text.secondary' }}>
              <AccessTime sx={{ fontSize: 16 }} />
              <Typography variant="caption" fontWeight={700}>กำหนดการ</Typography>
            </Stack>
            <Box sx={{ pl: 3.5 }}>
              <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#1d1d1f' }}>เริ่ม: {startText}</Typography>
              <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 500, color: '#86868b' }}>จบ: {endText}</Typography>
            </Box>
          </Stack>

          {hasCapacity && (
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary' }}>
                  <People sx={{ fontSize: 16 }} />
                  <Typography variant="caption" fontWeight={700}>จำนวนที่รับสมัคร</Typography>
                </Stack>
                <Typography variant="caption" fontWeight={800} color={percent >= 90 ? 'error.main' : 'text.primary'} sx={{ bgcolor: percent >= 90 ? 'rgba(255, 59, 48, 0.1)' : 'rgba(0, 0, 0, 0.05)', px: 1, py: 0.5, borderRadius: '8px' }}>
                  {cur} / {max}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={percent}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: 'rgba(0, 0, 0, 0.06)',
                  '& .MuiLinearProgress-bar': { borderRadius: 4, backgroundImage: 'linear-gradient(90deg, #0071e3 0%, #34c759 100%)' }
                }}
              />
            </Stack>
          )}
        </Stack>

        <Box sx={{ flexGrow: 1 }} />

        <Button
          component={canOpen ? Link : 'button'}
          href={canOpen ? `/register?activity=${encodeURIComponent(activityCode)}` : undefined}
          variant={canOpen ? 'contained' : 'outlined'}
          disabled={!canOpen}
          fullWidth
          sx={{
            borderRadius: '16px',
            py: 1.5,
            fontWeight: 700,
            textTransform: 'none',
            fontSize: '1rem',
            backgroundColor: canOpen ? '#0071e3' : 'transparent',
            color: canOpen ? '#ffffff' : 'text.secondary',
            border: canOpen ? 'none' : '1px solid rgba(0,0,0,0.1)',
            boxShadow: canOpen ? '0 8px 16px rgba(0, 113, 227, 0.25)' : 'none',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              backgroundColor: canOpen ? '#0077ed' : 'rgba(0,0,0,0.03)',
              boxShadow: canOpen ? '0 12px 24px rgba(0, 113, 227, 0.35)' : 'none',
              transform: canOpen ? 'translateY(-2px)' : 'none',
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