// src/app/not-found.tsx
'use client';

import React from 'react';
import { Box, Button, Card, CardContent, Typography, Stack } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import HomeIcon from '@mui/icons-material/Home';
import MapIcon from '@mui/icons-material/Map';
import { useRouter } from 'next/navigation';

export default function NotFoundPage() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Box
      sx={{
        minHeight: '70vh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        py: { xs: 4, md: 8 },
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, transparent)`,
      }}
    >
      <Card
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 680,
          borderRadius: 3,
          overflow: 'hidden',
          border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
        }}
      >
        <CardContent sx={{ p: { xs: 3, md: 4 }, textAlign: 'center' }}>
          <Typography variant="h2" fontWeight={800} sx={{ mb: 1 }}>
            404
          </Typography>
          <Typography variant="h6" fontWeight={700}>
            ไม่พบหน้าที่คุณต้องการ
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
            ลิงก์อาจหมดอายุหรือถูกย้ายไปยังที่อื่น
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="center">
            <Button variant="contained" startIcon={<HomeIcon />} onClick={() => router.push('/')}>
              กลับหน้าหลัก
            </Button>
            <Button variant="outlined" startIcon={<MapIcon />} onClick={() => router.back()}>
              กลับหน้าก่อนหน้า
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
