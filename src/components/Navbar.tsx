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
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Divider,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { 
  ScienceOutlined, 
  HomeOutlined, 
  AdminPanelSettingsOutlined, 
  LoginOutlined,
  LogoutOutlined,
  Home,
  AdminPanelSettings,
  Settings as SettingsIcon,
  HistoryOutlined,
  History as HistoryActiveIcon,
} from '@mui/icons-material';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useAuth, updateUserProfile } from '../lib/firebaseAuth';
import { useEffect, useState } from 'react';
import ProfileEditDialog from './profile/ProfileEditDialog';
import ThemeToggle from './common/ThemeToggle';

// สไตล์แก้ว (Liquid Glass)
const GlassWrapper = styled(AppBar)(({ theme }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.75 : 0.7),
    backgroundImage: isDark
      ? `linear-gradient(180deg, ${alpha('#ffffff', 0.04)} 0%, ${alpha('#ffffff', 0)} 100%)`
      : `linear-gradient(180deg, ${alpha('#ffffff', 0.15)} 0%, ${alpha('#ffffff', 0)} 100%)`,
    borderTop: isDark ? 'none' : `1px solid ${alpha('#ffffff', 0.3)}`,
    borderBottom: isDark
      ? `1px solid ${alpha('#ffffff', 0.1)}`
      : `1px solid ${alpha('#000000', 0.05)}`,
    boxShadow: isDark
      ? `0 8px 32px 0 ${alpha('#000000', 0.35)}`
      : `0 8px 32px 0 ${alpha('#1f2687', 0.08)}`,
  };
});

const Navbar: React.FC = () => {
  const theme = useTheme();
  const pathname = usePathname();
  // กำหนด iPad (หน้าจอกว้างไม่เกิน 1024px) ให้อยู่ด้านล่าง
  const isTabletOrMobile = useMediaQuery(theme.breakpoints.down('lg'));

  const { currentAdmin, refetch } = useAdminAuth();
  const { user, userData, login: userLogin, logout: userLogout, refreshUserData } = useAuth();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  useEffect(() => {
    refetch();
  }, [user]);

  const navLinks = [
    { label: 'หน้าแรก', path: '/', icon: <HomeOutlined />, activeIcon: <Home color="primary" /> },
    ...(user ? [{ label: 'ประวัติ', path: '/my-history', icon: <HistoryOutlined />, activeIcon: <HistoryActiveIcon color="primary" /> }] : []),
    ...(currentAdmin ? [{ label: 'Admin', path: '/admin', icon: <AdminPanelSettingsOutlined />, activeIcon: <AdminPanelSettings color="primary" /> }] : []),
  ];

  const handleConfirmLogout = async () => {
    setLogoutDialogOpen(false);
    await userLogout();
  };

  const getDisplayName = () => {
    if (userData?.username?.trim()) return userData.username.trim();
    if (userData?.displayName) return userData.displayName;
    if (userData?.firstName && userData?.lastName) return `${userData.firstName} ${userData.lastName}`;
    if (user?.displayName) return user.displayName.split(' ')[0];
    if (user?.email) return user.email.split('@')[0];
    return 'ผู้ใช้';
  };

  const getSubtitle = () => {
    if (userData?.department && userData.department !== 'ไม่ระบุ') return userData.department;
    return 'กรุณากรอกข้อมูลส่วนตัว';
  };

  const getAvatarSrc = () => userData?.photoURL || user?.photoURL || undefined;

  const getAvatarLetter = () =>
    userData?.firstName?.charAt(0).toUpperCase() ||
    getDisplayName().charAt(0).toUpperCase();

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

          {/* NAV LINKS & AUTH - Desktop Layout */}
          {!isTabletOrMobile && (
            <Stack direction="row" spacing={2} alignItems="center">
              <Stack direction="row" spacing={1}>
                {navLinks.map((link) => (
                  <Button
                    key={link.label}
                    component={Link}
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
              
              <Box sx={{ width: '1px', height: 24, bgcolor: 'divider' }} />

              <ThemeToggle />

              {user ? (
                <Box
                  onClick={handleMenuOpen}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    cursor: 'pointer',
                    borderRadius: 2,
                    py: 0.5,
                    pl: 1,
                    pr: 0.25,
                    '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.6) },
                  }}
                >
                  <Box
                    sx={{
                      display: { xs: 'none', sm: 'flex' },
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      minWidth: 0,
                      maxWidth: 160,
                      lineHeight: 1.15,
                    }}
                  >
                    <Typography
                      noWrap
                      sx={{
                        color: 'text.primary',
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        width: '100%',
                        textAlign: 'right',
                      }}
                    >
                      {getDisplayName()}
                    </Typography>
                    <Typography
                      noWrap
                      sx={{
                        color: 'text.secondary',
                        fontSize: '0.7rem',
                        fontWeight: 500,
                        width: '100%',
                        textAlign: 'right',
                      }}
                    >
                      {getSubtitle()}
                    </Typography>
                  </Box>

                  <Tooltip title="จัดการบัญชี">
                    <Avatar
                      src={getAvatarSrc()}
                      sx={{
                        width: { xs: 36, sm: 40 },
                        height: { xs: 36, sm: 40 },
                        border: '2px solid',
                        borderColor: alpha(theme.palette.divider, 0.5),
                        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                      }}
                    >
                      {!getAvatarSrc() && getAvatarLetter()}
                    </Avatar>
                  </Tooltip>
                </Box>
              ) : (
                <Button 
                  variant="contained" 
                  onClick={userLogin} 
                  startIcon={<LoginOutlined />}
                  sx={{ borderRadius: 4, px: 3, fontWeight: 700 }}
                >
                  เข้าสู่ระบบ
                </Button>
              )}
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
                    key={link.label}
                    component={Link}
                    href={link.path}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textDecoration: 'none',
                      color: isActive ? 'primary.main' : 'text.secondary',
                      position: 'relative',
                      gap: 0.5,
                      cursor: 'pointer'
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

              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                <ThemeToggle />
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.7, color: 'text.secondary' }}>
                  ธีม
                </Typography>
              </Box>

              {/* Mobile Auth Button */}
              {user ? (
                <Box
                  onClick={handleMenuOpen}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    color: 'text.secondary',
                    gap: 0.5,
                    cursor: 'pointer'
                  }}
                >
                  <IconButton color="inherit" sx={{ p: 0.5 }}>
                    <Avatar src={getAvatarSrc()} sx={{ width: 28, height: 28 }}>
                      {!getAvatarSrc() && getAvatarLetter()}
                    </Avatar>
                  </IconButton>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.7 }}>
                    โปรไฟล์
                  </Typography>
                </Box>
              ) : (
                <Box
                  onClick={userLogin}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    color: 'text.secondary',
                    gap: 0.5,
                    cursor: 'pointer'
                  }}
                >
                  <IconButton color="inherit">
                    <LoginOutlined />
                  </IconButton>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.7 }}>
                    เข้าสู่ระบบ
                  </Typography>
                </Box>
              )}
            </Stack>
          )}
        </Toolbar>
      </Container>

      {/* User Profile Menu (Shared between Desktop and Mobile) */}
      {user && (
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          onClick={handleMenuClose}
          PaperProps={{
            elevation: 0,
            sx: {
              overflow: 'visible',
              mt: 1.5,
              minWidth: { xs: 260, sm: 300 },
              borderRadius: 2,
              backdropFilter: 'blur(16px) saturate(180%)',
              backgroundColor: 'rgba(255,255,255,0.9)',
              border: '1px solid rgba(255,255,255,0.25)',
              boxShadow:
                '0 8px 24px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(255,255,255,0.15)',
              '&:before': {
                content: '""',
                display: 'block',
                position: 'absolute',
                top: 0,
                right: isTabletOrMobile ? 'calc(50% - 5px)' : 18,
                bottom: isTabletOrMobile ? -5 : 'auto',
                width: 10,
                height: 10,
                bgcolor: 'background.paper',
                transform: 'rotate(45deg)',
                zIndex: 0,
              },
            },
          }}
          transformOrigin={
            isTabletOrMobile 
              ? { horizontal: 'center', vertical: 'bottom' } 
              : { horizontal: 'right', vertical: 'top' }
          }
          anchorOrigin={
            isTabletOrMobile 
              ? { horizontal: 'center', vertical: 'top' } 
              : { horizontal: 'right', vertical: 'bottom' }
          }
        >
          <Box sx={{ px: 2, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar src={getAvatarSrc()} sx={{ width: 48, height: 48, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                {!getAvatarSrc() && getAvatarLetter()}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ lineHeight: 1.2 }}>
                  {getDisplayName()}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', wordBreak: 'break-all', lineHeight: 1.1 }}>
                  {user.email}
                </Typography>
                {userData?.department && userData.department !== 'ไม่ระบุ' && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, lineHeight: 1.1 }}>
                    {userData.department}
                  </Typography>
                )}
                {userData?.studentId && (
                  <Typography variant="caption" color="primary.main" sx={{ display: 'block', fontFamily: 'monospace', mt: 0.5, fontWeight: 'bold' }}>
                    รหัส: {userData.studentId}
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>

          <MenuItem component="a" href="/my-history" onClick={handleMenuClose} sx={{ py: 1.25, mt: 1 }}>
            <ListItemIcon><HistoryOutlined fontSize="small" /></ListItemIcon>
            <ListItemText primary="ประวัติการลงทะเบียน" primaryTypographyProps={{ fontSize: '0.92rem', fontWeight: 'medium' }} />
          </MenuItem>
          <MenuItem onClick={() => { handleMenuClose(); setProfileDialogOpen(true); }} sx={{ py: 1.25 }}>
            <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="ตั้งค่าโปรไฟล์" primaryTypographyProps={{ fontSize: '0.92rem', fontWeight: 'medium' }} />
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { handleMenuClose(); setLogoutDialogOpen(true); }} sx={{ py: 1.25 }}>
            <ListItemIcon><LogoutOutlined fontSize="small" color="error" /></ListItemIcon>
            <ListItemText
              primary="ออกจากระบบ"
              secondary="ออกจากบัญชีปัจจุบัน"
              primaryTypographyProps={{ color: 'error.main', fontSize: '0.92rem', fontWeight: 'medium' }}
              secondaryTypographyProps={{ fontSize: '0.75rem' }}
            />
          </MenuItem>
        </Menu>
      )}

      {/* Logout Confirmation Dialog */}
      <Dialog
        open={logoutDialogOpen}
        onClose={() => setLogoutDialogOpen(false)}
        PaperProps={{
          sx: { borderRadius: '20px', p: 1 }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>ยืนยันการออกจากระบบ?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบบัญชี {user?.email}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setLogoutDialogOpen(false)} sx={{ fontWeight: 600, color: 'text.secondary' }}>
            ยกเลิก
          </Button>
          <Button onClick={handleConfirmLogout} variant="contained" color="error" sx={{ borderRadius: '12px', fontWeight: 700 }}>
            ออกจากระบบ
          </Button>
        </DialogActions>
      </Dialog>

      {/* Profile Edit Dialog */}
      <ProfileEditDialog
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
        user={user}
        userData={userData}
        onSave={async (updates) => {
          if (user?.uid) {
            await updateUserProfile(user.uid, updates);
            await refreshUserData();
          }
        }}
      />
    </GlassWrapper>
  );
};

export default Navbar;