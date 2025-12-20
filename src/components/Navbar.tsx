// components/Navbar.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import {
  AppBar,
  Container,
  Toolbar,
  Typography,
  Button,
  Stack,
  Box,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ScienceOutlined } from '@mui/icons-material';

const Navbar: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        borderBottom: `1px solid ${alpha('#ffffff', 0.12)}`,
        background: `linear-gradient(180deg, ${alpha(
          theme.palette.background.paper,
          0.98
        )}, ${alpha(theme.palette.background.paper, 0.95)})`,
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        zIndex: 999,
      }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ py: 1.5 }}>
          {/* Logo */}
          <Box
            component={Link}
            href="/"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              textDecoration: 'none',
              mr: 'auto',
              transition: 'transform .3s ease',
              '&:hover': { transform: 'scale(1.02)' },
            }}
          >
            <ScienceOutlined sx={{ color: 'primary.main', fontSize: 28 }} />
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, flexDirection: 'column' }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 950,
                  letterSpacing: -0.6,
                  lineHeight: 1,
                  color: 'text.primary',
                }}
              >
                PSU Register
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                กิจกรรมชุมนุมคณะวิทยาศาสตร์
              </Typography>
            </Box>
          </Box>

          {/* Nav Links */}
          <Stack direction="row" spacing={isMobile ? 0.5 : 2} alignItems="center">
            <Button
              component={Link}
              href="/"
              color="inherit"
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                fontSize: isMobile ? '0.85rem' : '0.95rem',
                '&:hover': { color: 'primary.main' },
              }}
            >
              หน้าแรก
            </Button>

            <Button
              component={Link}
              href="/admin"
              color="inherit"
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                fontSize: isMobile ? '0.85rem' : '0.95rem',
                '&:hover': { color: 'primary.main' },
              }}
            >
              Admin
            </Button>

            {/* ปุ่มติดต่อ: ทำเป็นลิงก์ไป footer หรือ mailto */}
            <Button
              component="a"
              href="mailto:psuscc@psu.ac.th"
              variant="contained"
              size="small"
              sx={{
                borderRadius: 999,
                px: 2,
                fontWeight: 950,
                textTransform: 'none',
              }}
            >
              ติดต่อ
            </Button>
          </Stack>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default Navbar;
