// components/Navbar.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  IconButton,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { 
  ScienceOutlined, 
  HomeOutlined, 
  AdminPanelSettingsOutlined, 
  EmailOutlined,
  Home,
  AdminPanelSettings,
  Email
} from '@mui/icons-material';

// สไตล์แก้ว (Liquid Glass)
const GlassWrapper = styled(AppBar)(({ theme }) => ({
  // พื้นหลังแบบเบลอและไล่เฉด
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  backgroundColor: alpha(theme.palette.background.paper, 0.7),
  backgroundImage: `linear-gradient(180deg, ${alpha('#ffffff', 0.15)} 0%, ${alpha('#ffffff', 0)} 100%)`,
  borderTop: theme.palette.mode === 'light' ? `1px solid ${alpha('#ffffff', 0.3)}` : 'none',
  borderBottom: theme.palette.mode === 'light' ? `1px solid ${alpha('#000000', 0.05)}` : `1px solid ${alpha('#ffffff', 0.1)}`,
  boxShadow: `0 8px 32px 0 ${alpha('#1f2687', 0.08)}`,
}));

const Navbar: React.FC = () => {
  const theme = useTheme();
  const pathname = usePathname();
  // กำหนด iPad (หน้าจอกว้างไม่เกิน 1024px) ให้อยู่ด้านล่าง
  const isTabletOrMobile = useMediaQuery(theme.breakpoints.down('lg'));

  const navLinks = [
    { label: 'หน้าแรก', path: '/', icon: <HomeOutlined />, activeIcon: <Home color="primary" /> },
    { label: 'Admin', path: '/admin', icon: <AdminPanelSettingsOutlined />, activeIcon: <AdminPanelSettings color="primary" /> },
    { label: 'ติดต่อ', path: 'mailto:psuscc@psu.ac.th', icon: <EmailOutlined />, activeIcon: <Email color="primary" />, isExternal: true },
  ];

  return (
    <GlassWrapper
      // สลับตำแหน่งตาม Device
      position={isTabletOrMobile ? "fixed" : "sticky"}
      elevation={0}
      sx={{
        top: isTabletOrMobile ? 'auto' : 0,
        bottom: isTabletOrMobile ? 0 : 'auto',
        // ปรับความสูงให้เหมาะกับแต่ละเครื่อง
        minHeight: isTabletOrMobile ? 'auto' : 64,
        paddingBottom: isTabletOrMobile ? 'env(safe-area-inset-bottom)' : 0, // รองรับรอยบาก iPhone
        borderRadius: isTabletOrMobile ? '24px 24px 0 0' : 0, // มนด้านบนในมือถือ
      }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ 
          justifyContent: 'space-between',
          height: isTabletOrMobile ? 70 : 64 
        }}>
          
          {/* LOGO - แสดงเฉพาะบนคอมพิวเตอร์ */}
          {!isTabletOrMobile && (
            <Box
              component={Link}
              href="/"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                textDecoration: 'none',
                transition: 'all 0.3s ease',
                '&:hover': { opacity: 0.8 },
              }}
            >
              <Box sx={{ 
                bgcolor: 'primary.main', 
                p: 0.5, 
                borderRadius: 1, 
                display: 'flex',
                boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`
              }}>
                <ScienceOutlined sx={{ color: '#fff', fontSize: 24 }} />
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 900, color: 'text.primary', lineHeight: 1.2, letterSpacing: -0.5 }}>
                  PSU REGISTER
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  Faculty of Science
                </Typography>
              </Box>
            </Box>
          )}

          {/* NAV LINKS - Desktop Layout */}
          {!isTabletOrMobile && (
            <Stack direction="row" spacing={1}>
              {navLinks.map((link) => (
                <Button
                  key={link.path}
                  component={link.isExternal ? 'a' : Link}
                  href={link.path}
                  sx={{
                    px: 2,
                    borderRadius: 2,
                    fontWeight: 700,
                    color: pathname === link.path ? 'primary.main' : 'text.secondary',
                    bgcolor: pathname === link.path ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.05),
                      color: 'primary.main'
                    }
                  }}
                >
                  {link.label}
                </Button>
              ))}
            </Stack>
          )}

          {/* TAB BAR - Mobile/iPad Layout (Liquid Icons) */}
          {isTabletOrMobile && (
            <Stack 
              direction="row" 
              sx={{ width: '100%', justifyContent: 'space-around', alignItems: 'center' }}
            >
              {navLinks.map((link) => {
                const isActive = pathname === link.path;
                return (
                  <Box
                    key={link.path}
                    component={link.isExternal ? 'a' : Link}
                    href={link.path}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textDecoration: 'none',
                      color: isActive ? 'primary.main' : 'text.secondary',
                      position: 'relative',
                      gap: 0.5
                    }}
                  >
                    <IconButton color="inherit" sx={{ 
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      transform: isActive ? 'translateY(-4px) scale(1.1)' : 'none'
                    }}>
                      {isActive ? link.activeIcon : link.icon}
                    </IconButton>
                    <Typography sx={{ 
                      fontSize: '0.65rem', 
                      fontWeight: 800,
                      opacity: isActive ? 1 : 0.7
                    }}>
                      {link.label}
                    </Typography>
                    {/* จุด Indicator ด้านล่างแบบ Apple */}
                    {isActive && (
                      <Box sx={{
                        position: 'absolute',
                        bottom: -4,
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        bgcolor: 'primary.main'
                      }} />
                    )}
                  </Box>
                );
              })}
            </Stack>
          )}
        </Toolbar>
      </Container>
    </GlassWrapper>
  );
};

export default Navbar;