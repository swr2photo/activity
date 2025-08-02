// components/navigation/NavigationBar.tsx
'use client';
import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
  Divider
} from '@mui/material';
import {
  EventNote as EventIcon,
  Edit as EditIcon,
  Logout as LogoutIcon,
  AccountCircle as AccountIcon,
  Person as PersonIcon,
  School as SchoolIcon,
  Badge as BadgeIcon,
  Email as EmailIcon
} from '@mui/icons-material';
import { UniversityUserProfile } from '../../lib/firebaseAuth';

interface NavigationBarProps {
  user: any;
  userData: UniversityUserProfile | null;
  onLogout: () => void;
  onEditProfile: () => void;
}

const NavigationBar: React.FC<NavigationBarProps> = ({ 
  user, 
  userData, 
  onLogout, 
  onEditProfile 
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    onLogout();
  };

  const handleEditProfile = () => {
    handleMenuClose();
    onEditProfile();
  };

  // Helper functions
  const getDisplayName = () => {
    if (userData?.displayName) return userData.displayName;
    if (userData?.firstName && userData?.lastName) return `${userData.firstName} ${userData.lastName}`;
    if (user?.displayName) return user.displayName;
    if (user?.email) return user.email.split('@')[0];
    return 'ผู้ใช้';
  };

  const getAvatarSrc = () => {
    if (userData?.photoURL) return userData.photoURL;
    if (user?.photoURL) return user.photoURL;
    return null;
  };

  const getAvatarLetter = () => {
    if (userData?.firstName) return userData.firstName.charAt(0).toUpperCase();
    return getDisplayName().charAt(0).toUpperCase();
  };

  const getSubtitle = () => {
    if (userData?.faculty && userData?.department) {
      return `${userData.faculty} - ${userData.department}`;
    }
    if (userData?.department) return userData.department;
    if (userData?.faculty) return userData.faculty;
    return 'ยังไม่ได้กรอกข้อมูล';
  };

  return (
    <AppBar 
      position="static" 
      sx={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        mb: 3,
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}
    >
      <Toolbar sx={{ minHeight: { xs: 64, sm: 72 } }}>
        {/* Logo and Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EventIcon sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ 
              flexGrow: 1,
              fontSize: { xs: '1rem', sm: '1.25rem' },
              fontWeight: 'bold'
            }}
          >
            ระบบลงทะเบียนกิจกรรม
          </Typography>
        </Box>
        
        {/* User Profile Section */}
        {user ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: 'auto' }}>
            {/* User Info - Hidden on mobile */}
            <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: 'rgba(255,255,255,0.9)', 
                  fontWeight: 'medium',
                  lineHeight: 1.2
                }}
              >
                {getDisplayName()}
              </Typography>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'rgba(255,255,255,0.7)',
                  lineHeight: 1.1
                }}
              >
                {getSubtitle()}
              </Typography>
            </Box>
            
            {/* Profile Avatar */}
            <Tooltip title="จัดการบัญชี">
              <IconButton
                onClick={handleMenuClick}
                sx={{ p: 0 }}
              >
                <Avatar 
                  src={getAvatarSrc() || undefined}
                  sx={{ 
                    width: { xs: 36, sm: 40 }, 
                    height: { xs: 36, sm: 40 }, 
                    border: '2px solid rgba(255,255,255,0.5)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    fontSize: { xs: '1rem', sm: '1.125rem' }
                  }}
                >
                  {!getAvatarSrc() && getAvatarLetter()}
                </Avatar>
              </IconButton>
            </Tooltip>

            {/* Profile Menu */}
            <Menu
              anchorEl={anchorEl}
              open={open}
              onClose={handleMenuClose}
              onClick={handleMenuClose}
              PaperProps={{
                elevation: 0,
                sx: {
                  overflow: 'visible',
                  filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                  mt: 1.5,
                  minWidth: { xs: 260, sm: 300 },
                  '&:before': {
                    content: '""',
                    display: 'block',
                    position: 'absolute',
                    top: 0,
                    right: 14,
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
              {/* Profile Header */}
              <Box sx={{ px: 2, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar 
                    src={getAvatarSrc() || undefined} 
                    sx={{ 
                      width: 48, 
                      height: 48,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                  >
                    {!getAvatarSrc() && getAvatarLetter()}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography 
                      variant="subtitle1" 
                      fontWeight="bold"
                      sx={{ 
                        wordBreak: 'break-word',
                        lineHeight: 1.2
                      }}
                    >
                      {getDisplayName()}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ 
                        fontSize: '0.75rem',
                        wordBreak: 'break-all',
                        lineHeight: 1.1
                      }}
                    >
                      {user.email}
                    </Typography>
                    {userData?.faculty && (
                      <Typography 
                        variant="caption" 
                        color="text.secondary"
                        sx={{ 
                          display: 'block',
                          mt: 0.5,
                          lineHeight: 1.1
                        }}
                      >
                        {userData.faculty}
                        {userData.department && ` - ${userData.department}`}
                      </Typography>
                    )}
                    {userData?.studentId && (
                      <Typography 
                        variant="caption" 
                        color="primary.main" 
                        sx={{ 
                          display: 'block', 
                          fontFamily: 'monospace',
                          mt: 0.5,
                          fontWeight: 'bold'
                        }}
                      >
                        รหัส: {userData.studentId}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>

              {/* Menu Items */}
              <MenuItem onClick={handleEditProfile} sx={{ py: 1.5 }}>
                <ListItemIcon>
                  <EditIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary="แก้ไขข้อมูลส่วนตัว"
                  secondary="เปลี่ยนชื่อ, คณะ, สาขา, รูปโปรไฟล์"
                  primaryTypographyProps={{ 
                    fontSize: '0.9rem',
                    fontWeight: 'medium'
                  }}
                  secondaryTypographyProps={{ 
                    fontSize: '0.75rem'
                  }}
                />
              </MenuItem>

              <Divider />

              <MenuItem onClick={handleLogout} sx={{ py: 1.5 }}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" color="error" />
                </ListItemIcon>
                <ListItemText 
                  primary="ออกจากระบบ"
                  secondary="ออกจากบัญชีปัจจุบัน"
                  primaryTypographyProps={{ 
                    color: 'error.main',
                    fontSize: '0.9rem',
                    fontWeight: 'medium'
                  }}
                  secondaryTypographyProps={{ 
                    fontSize: '0.75rem'
                  }}
                />
              </MenuItem>
            </Menu>
          </Box>
        ) : (
          // Not logged in state
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
            <AccountIcon sx={{ color: 'rgba(255,255,255,0.7)' }} />
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              ยังไม่ได้เข้าสู่ระบบ
            </Typography>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default NavigationBar;