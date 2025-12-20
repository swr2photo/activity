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
  useMediaQuery,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { AccessTime, People, LocationOn } from '@mui/icons-material';

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
  bannerTintColor?: string;
  bannerTintOpacity?: number;
  bannerAspect?: string;
  status: { key: string; label: string; tone: string };
  canOpen: boolean;
};

const toDate = (d: any): Date => d?.toDate?.() ?? (d instanceof Date ? d : new Date(d));

const formatDateTime = (d: any) => {
  const dd: Date = d?.toDate?.() ?? (d instanceof Date ? d : new Date(d));
  return dd.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
};

const ActivityCard: React.FC<ActivityCardProps> = ({
  id,
  activityCode,
  activityName,
  location,
  startDateTime,
  endDateTime,
  maxParticipants,
  currentParticipants,
  bannerUrl,
  bannerColor,
  bannerTintColor,
  bannerTintOpacity,
  bannerAspect,
  status,
  canOpen,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isMedium = useMediaQuery(theme.breakpoints.down('md'));
  const [imageLoaded, setImageLoaded] = useState(false);

  const startText = startDateTime ? formatDateTime(startDateTime) : '-';
  const endText = endDateTime ? formatDateTime(endDateTime) : '-';
  const capacityText = (maxParticipants || 0) > 0 ? currentParticipants || 0 : null;
  const capacityMax = (maxParticipants || 0) > 0 ? maxParticipants || 0 : null;
  const capacityPercent = capacityMax ? Math.round((capacityText! / capacityMax) * 100) : 0;

  const statusColorMap: any = {
    active: 'success',
    upcoming: 'info',
    full: 'warning',
    ended: 'default',
    inactive: 'default',
  };

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: { xs: 1.5, sm: 2.5, md: 3 },
        border: `1px solid ${alpha(theme.palette.mode === 'dark' ? '#ffffff' : '#000000', 0.08)}`,
        overflow: 'hidden',
        // ✨ Apple Liquid Glass Effect
        background:
          theme.palette.mode === 'dark'
            ? `linear-gradient(135deg, ${alpha('#ffffff', 0.03)}, ${alpha('#ffffff', 0.01)})`
            : `linear-gradient(135deg, ${alpha('#ffffff', 0.95)}, ${alpha('#ffffff', 0.85)})`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        transition: 'all .3s cubic-bezier(0.4, 0.0, 0.2, 1)',
        '&:hover': {
          transform: isMobile ? 'translateY(-4px)' : 'translateY(-8px)',
          boxShadow:
            theme.palette.mode === 'dark'
              ? `0 24px 48px ${alpha('#000000', 0.3)}`
              : `0 24px 48px ${alpha(theme.palette.primary.main, 0.12)}`,
          borderColor: alpha(theme.palette.primary.main, 0.3),
          background:
            theme.palette.mode === 'dark'
              ? `linear-gradient(135deg, ${alpha('#ffffff', 0.05)}, ${alpha('#ffffff', 0.02)})`
              : `linear-gradient(135deg, ${alpha('#ffffff', 0.97)}, ${alpha('#ffffff', 0.88)})`,
        },
      }}
    >
      {/* Banner Section - Mobile Optimized */}
      <Box
        sx={{
          position: 'relative',
          height: { xs: 120, sm: 140, md: 180 },
          overflow: 'hidden',
          flex: 'shrink',
        }}
      >
        {bannerUrl && (
          <Box
            component="img"
            src={bannerUrl}
            alt={activityName}
            onLoad={() => setImageLoaded(true)}
            loading="lazy"
            sx={{
              width: '100%',
              height: '100%',
              objectFit: bannerAspect === 'contain' ? 'contain' : 'cover',
              display: 'block',
              backgroundColor: bannerColor || '#f5f5f5',
              opacity: imageLoaded ? 1 : 0.8,
              transition: 'opacity .4s ease',
            }}
          />
        )}

        {!bannerUrl && (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              background: bannerColor || theme.palette.primary.main,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
        )}

        {/* Status Badge */}
        <Box
          sx={{
            position: 'absolute',
            top: isMobile ? 8 : 12,
            left: isMobile ? 8 : 12,
            right: isMobile ? 8 : 12,
            display: 'flex',
            gap: 0.6,
            flexWrap: 'wrap',
            alignItems: 'flex-start',
          }}
        >
          <Chip
            label={status.label}
            size={isMobile ? 'small' : 'medium'}
            color={statusColorMap[status.key] || 'default'}
            variant="filled"
            sx={{
              fontWeight: 950,
              opacity: 0.9,
              fontSize: isMobile ? '0.7rem' : '0.8rem',
            }}
          />
        </Box>
      </Box>

      {/* Content Section */}
      <CardContent sx={{ p: isMobile ? 1.5 : 2, flex: 1, display: 'flex', flexDirection: 'column', gap: isMobile ? 1 : 1.5 }}>
        {/* Title & Location */}
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant={isMobile ? 'body1' : 'h6'}
            fontWeight={950}
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.3,
              color: 'text.primary',
              fontSize: isMobile ? '0.95rem' : 'auto',
            }}
          >
            {activityName}
          </Typography>

          {location && (
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start', mt: isMobile ? 0.5 : 0.75 }}>
              <LocationOn
                fontSize="small"
                sx={{
                  color: 'text.secondary',
                  flex: 'shrink',
                  mt: 0.25,
                  fontSize: isMobile ? '1rem' : '1.25rem',
                }}
              />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  fontSize: isMobile ? '0.8rem' : '0.875rem',
                }}
              >
                {location}
              </Typography>
            </Box>
          )}
        </Box>

        <Divider sx={{ opacity: 0.2, my: isMobile ? 0.5 : undefined }} />

        {/* Date & Time */}
        <Stack spacing={isMobile ? 0.25 : 0.5}>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <AccessTime
              fontSize="small"
              sx={{
                color: 'text.secondary',
                flex: 'shrink',
                fontSize: isMobile ? '1rem' : '1.25rem',
              }}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={700}
              sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem' }}
            >
              ช่วงเวลา
            </Typography>
          </Box>
          <Typography
            variant="body2"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              fontSize: isMobile ? '0.775rem' : '0.875rem',
              lineHeight: 1.4,
              ml: isMobile ? 0 : undefined,
            }}
          >
            <Box component="span" sx={{ fontWeight: 600, display: 'block' }}>
              เริ่ม: {startText}
            </Box>
            <Box component="span" sx={{ fontWeight: 600, display: 'block' }}>
              สิ้นสุด: {endText}
            </Box>
          </Typography>
        </Stack>

        {/* Capacity */}
        {capacityMax && capacityMax > 0 && (
          <Stack spacing={isMobile ? 0.25 : 0.5}>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <People
                fontSize="small"
                sx={{
                  color: 'text.secondary',
                  flex: 'shrink',
                  fontSize: isMobile ? '1rem' : '1.25rem',
                }}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                fontWeight={700}
                sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem' }}
              >
                ที่นั่ง
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <LinearProgress
                variant="determinate"
                value={capacityPercent}
                sx={{
                  flex: 1,
                  height: isMobile ? 4 : 6,
                  borderRadius: 999,
                  background: alpha(theme.palette.primary.main, 0.1),
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 999,
                    background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  },
                }}
              />
              <Typography
                variant="caption"
                fontWeight={950}
                sx={{
                  minWidth: 'fit-content',
                  color: capacityPercent >= 80 ? 'warning.main' : 'text.secondary',
                  fontSize: isMobile ? '0.7rem' : '0.75rem',
                }}
              >
                {capacityText}/{capacityMax}
              </Typography>
            </Box>
          </Stack>
        )}

        <Box sx={{ flex: 1 }} />

        {/* Code & Action */}
        <Divider sx={{ opacity: 0.2 }} />

        <Stack
          direction={isMobile ? 'column' : 'row'}
          spacing={isMobile ? 1 : 1}
          alignItems={isMobile ? 'stretch' : 'center'}
        >
          <Chip
            label={`รหัส: ${activityCode}`}
            size={isMobile ? 'small' : 'medium'}
            sx={{
              borderRadius: 999,
              background: alpha(theme.palette.primary.main, 0.08),
              fontFamily: 'monospace',
              fontWeight: 900,
              fontSize: isMobile ? '0.65rem' : '0.75rem',
              order: isMobile ? 2 : 0,
            }}
          />
          {!isMobile && <Box sx={{ flex: 1 }} />}
          <Button
            component={Link}
            href={`/register?activity=${encodeURIComponent(activityCode)}`}
            variant={canOpen ? 'contained' : 'outlined'}
            disabled={!canOpen}
            size={isMobile ? 'small' : 'medium'}
            fullWidth={isMobile}
            sx={{
              borderRadius: 999,
              px: isMobile ? 1.5 : 2,
              fontWeight: 950,
              textTransform: 'none',
              whiteSpace: isMobile ? 'normal' : 'nowrap',
              transition: 'all .2s',
              fontSize: isMobile ? '0.85rem' : '0.9rem',
              order: isMobile ? 1 : 2,
              ...(canOpen && {
                boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.3)}`,
                '&:hover': {
                  boxShadow: `0 12px 32px ${alpha(theme.palette.primary.main, 0.4)}`,
                },
              }),
            }}
          >
            ลงทะเบียน
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default ActivityCard;
