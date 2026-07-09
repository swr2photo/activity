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
} from '@mui/icons-material';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useAuth, updateUserProfile } from '../lib/firebaseAuth';
import { useEffect, useState } from 'react';
import ProfileEditDialog from './profile/ProfileEditDialog';

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

  const { currentAdmin, refetch } = useAdminAuth();
  const { user, userData, login: userLogin, logout: userLogout } = useAuth();
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
    ...(currentAdmin ? [{ label: 'Admin', path: '/admin', icon: <AdminPanelSettingsOutlined />, activeIcon: <AdminPanelSettings color="primary" /> }] : []),
  ];

  const handleConfirmLogout = async () => {
    setLogoutDialogOpen(false);
    await userLogout();
  };

  const getDisplayName = () => {
    if (userData?.displayName) return userData.displayName;
    if (userData?.firstName && userData?.lastName) return `${userData.firstName} ${userData.lastName}`;
    if (user?.displayName) return user.displayName.split(' ')[0];
    if (user?.email) return user.email.split('@')[0];
    return 'ผู้ใช้';
  };

  const getSubtitle = () => {
    if (userData?.faculty && userData?.department) return `${userData.faculty} - ${userData.department}`;
    if (userData?.department) return userData.department;
    if (userData?.faculty) return userData.faculty;
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
              
              <Box sx={{ width: '1px', height: 24, bgcolor: 'rgba(0,0,0,0.1)' }} />

              {user ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' }, mr: 0.5 }}>
                    <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 'medium', lineHeight: 1.2 }}>
                      {getDisplayName()}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.1 }}>
                      {getSubtitle()}
                    </Typography>
                  </Box>

                  <Tooltip title="จัดการบัญชี">
                    <IconButton onClick={handleMenuOpen} sx={{ p: 0 }}>
                      <Avatar 
                        src={getAvatarSrc()} 
                        sx={{ 
                          width: { xs: 36, sm: 40 }, 
                          height: { xs: 36, sm: 40 },
                          border: '2px solid rgba(255,255,255,0.6)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        }} 
                      >
                        {!getAvatarSrc() && getAvatarLetter()}
                      </Avatar>
                    </IconButton>
                  </Tooltip>

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
                          right: 18,
                          width: 10,
                          height: 10,
                          bgcolor: 'background.paper',
                          transform: 'translateY(-50%) rotate(45deg)',
                          zIndex: 0,
                        },
                      },
                    }}
                    transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                    anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
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
                          {userData?.faculty && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, lineHeight: 1.1 }}>
                              {userData.faculty}
                              {userData.department && ` - ${userData.department}`}
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

                    <MenuItem onClick={() => { handleMenuClose(); setProfileDialogOpen(true); }} sx={{ py: 1.25, mt: 1 }}>
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
                    <Avatar src={user.photoURL || undefined} sx={{ width: 28, height: 28 }} />
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
            // useAuth listener will automatically update userData
          }
        }}
      />
    </GlassWrapper>
  );
};

export default Navbar;