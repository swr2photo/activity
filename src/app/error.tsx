// src/app/error.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Card, CardContent, Typography, Stack, Divider,
  Chip, Alert, IconButton, Collapse, Tooltip
} from '@mui/material';
import { alpha, keyframes, useTheme } from '@mui/material/styles';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import HomeIcon from '@mui/icons-material/Home';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ReportIcon from '@mui/icons-material/Report';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloseIcon from '@mui/icons-material/Close';
import { useRouter, usePathname } from 'next/navigation';

// ใช้ relative path
import { reportError } from '../lib/errorReporter';
import { auth } from '../lib/firebase';

const float = keyframes`
  0%,100% { transform: translateY(0) }
  50% { transform: translateY(-6px) }
`;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [showDetails, setShowDetails] = useState(false);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const refCode = useMemo(() => {
    const base = error.digest || Math.random().toString(36).slice(2, 8);
    const stamp = Date.now().toString(36).slice(-4);
    return `${base}-${stamp}`.toUpperCase();
  }, [error.digest]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const user = auth.currentUser;
        const id = await reportError({
          message: error.message,
          stack: error.stack,
          digest: error.digest,
          path: pathname || '/',
          userId: user?.uid ?? null,
          userEmail: user?.email ?? null,
          meta: { refCode },
        });
        if (mounted) setErrorId(id);
        console.error('Captured error:', { error, errorId: id, refCode });
      } catch { /* noop */ }
    })();
    return () => { mounted = false; };
  }, [error, pathname, refCode]);

  const copyInfo = async () => {
    try {
      const info = [
        `Reference: ${refCode}${errorId ? ` (${errorId})` : ''}`,
        `Path: ${pathname}`,
        `Message: ${error.message}`,
        error.stack ? `Stack: ${error.stack}` : '',
      ].filter(Boolean).join('\n');
      await navigator.clipboard.writeText(info);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* noop */ }
  };

  if (dismissed) return null;

  return (
    <Box
      sx={{
        minHeight: '70vh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        py: { xs: 4, md: 8 },
        background: `radial-gradient(1200px 400px at -20% -20%, ${alpha(theme.palette.error.main, 0.08)}, transparent),
                     linear-gradient(180deg, ${alpha(theme.palette.background.default, 0.6)}, ${theme.palette.background.default})`,
      }}
    >
      <Card
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 760,
          borderRadius: 3,
          overflow: 'hidden',
          border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
          boxShadow: `0 24px 64px ${alpha('#000', 0.12)}`,
          backdropFilter: 'blur(10px)', // liquid glass
          background: alpha(theme.palette.background.paper, 0.7),
        }}
      >
        <Box
          sx={{
            p: { xs: 2, md: 3 },
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
            background: `linear-gradient(135deg, ${alpha(theme.palette.error.light, 0.15)}, ${alpha(theme.palette.background.paper, 0.7)})`,
          }}
        >
          <Box sx={{
            width: 56, height: 56, borderRadius: 2, display: 'grid', placeItems: 'center',
            bgcolor: alpha(theme.palette.error.main, 0.1),
            boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.error.main, 0.12)}`,
            animation: `${float} 5s ease-in-out infinite`,
          }}>
            <ReportIcon sx={{ color: 'error.main' }} />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" fontWeight={800}>
              เกิดข้อผิดพลาดในการทำงาน
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              เราขออภัยในความไม่สะดวก — คุณสามารถลองใหม่หรือกลับไปหน้าหลักได้
            </Typography>
          </Box>

          <Tooltip title="ปิดกล่องนี้">
            <IconButton onClick={() => setDismissed(true)} size="small">
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={2}>
            <Alert severity="error" variant="outlined" sx={{ borderColor: alpha(theme.palette.error.main, 0.3) }}>
              <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                <Typography variant="body2" fontWeight={700}>Reference</Typography>
                <Chip size="small" label={refCode} color="error" variant="outlined" sx={{ fontWeight: 700 }} />
                {errorId && (<Chip size="small" label={`ID: ${errorId}`} variant="outlined" sx={{ ml: 0.5 }} />)}
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                หากต้องการติดต่อผู้ดูแล โปรดแจ้งรหัสอ้างอิงนี้เพื่อช่วยตรวจสอบปัญหาได้เร็วขึ้น
              </Typography>
            </Alert>

            {/* ปรับให้ปุ่มเต็มความกว้างบนมือถือ */}
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{ '& button': { flex: { xs: '1 1 100%', sm: 1 } } }}
            >
              <Button variant="contained" color="error" startIcon={<RestartAltIcon />} onClick={reset}>
                ลองใหม่
              </Button>
              <Button variant="outlined" startIcon={<HomeIcon />} onClick={() => router.push('/')}>
                กลับหน้าหลัก
              </Button>
              <Button variant="text" startIcon={<ContentCopyIcon />} onClick={copyInfo}>
                {copied ? 'คัดลอกแล้ว' : 'คัดลอกรายละเอียด'}
              </Button>
            </Stack>

            <Divider />

            <Button
              onClick={() => setShowDetails(v => !v)}
              endIcon={<ExpandMoreIcon sx={{ transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)', transition: '200ms' }} />}
              sx={{ alignSelf: 'flex-start' }}
            >
              รายละเอียดทางเทคนิค
            </Button>
            <Collapse in={showDetails} unmountOnExit>
              <Box
                component="pre"
                sx={{
                  p: 2, m: 0, borderRadius: 2, overflow: 'auto',
                  fontSize: 12, lineHeight: 1.6,
                  bgcolor: alpha(theme.palette.grey[900], theme.palette.mode === 'dark' ? 0.3 : 0.08),
                  border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                }}
              >
                {[
                  `Path: ${pathname}`,
                  `Message: ${error.message}`,
                  error.digest ? `Digest: ${error.digest}` : '',
                  '',
                  error.stack || '',
                ].filter(Boolean).join('\n')}
              </Box>
            </Collapse>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
