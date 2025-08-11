// src/components/admin/AdminLayout.tsx
'use client';

import React, { useState } from 'react';
import {
  Box, Drawer, AppBar, Toolbar, List, Typography, Divider, IconButton, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Avatar, Menu, MenuItem, Badge, useTheme, useMediaQuery, Collapse,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Alert, CircularProgress
} from '@mui/material';
import {
  Menu as MenuIcon, Dashboard as DashboardIcon, People as PeopleIcon, Event as EventIcon,
  Assessment as ReportsIcon, Settings as SettingsIcon, Security as SecurityIcon, Logout as LogoutIcon,
  Notifications as NotificationsIcon, Person as PersonIcon, ExpandLess, ExpandMore, QrCode as QrCodeIcon,
  SupervisorAccount as SupervisorIcon, Warning as WarningIcon
} from '@mui/icons-material';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import type { AdminProfile, AdminPermission } from '../../types/admin';
import { DEPARTMENT_LABELS, ROLE_LABELS } from '../../types/admin';

const DRAWER_WIDTH = 280;

interface AdminLayoutProps {
  currentAdmin: AdminProfile;
  children: React.ReactNode;
  activeSection: string;
  onSectionChange: (section: string) => void;
  onLogout: () => void;
}

// ชนิดสำหรับเมนู (หลีกเลี่ยงชนกับ MUI MenuItem)
interface NavEntry {
  id: string;
  label: string;
  icon: React.ReactNode;
  permission?: AdminPermission;
  children?: NavEntry[];
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentAdmin,
  children,
  activeSection,
  onSectionChange,
  onLogout
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(!isMobile);
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['activities']);

  const [logoutDialog, setLogoutDialog] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  // ✅ กันเหนียว: ทำ permissions ให้เป็นอาเรย์เสมอ
  const safePerms: AdminPermission[] = Array.isArray(currentAdmin?.permissions)
    ? (currentAdmin.permissions as AdminPermission[])
    : [];

  // ✅ helper เช็คสิทธิ์ (ใช้แทน .includes() ตรงๆ ทุกที่)
  const hasPerm = (p?: AdminPermission) => !p || safePerms.includes(p);

  const menuItems: NavEntry[] = [
    { id: 'dashboard', label: 'แดชบอร์ด', icon: <DashboardIcon /> },
    {
      id: 'activities',
      label: 'จัดการกิจกรรม',
      icon: <EventIcon />,
      permission: 'manage_activities',
      children: [
        { id: 'activity-list', label: 'รายการกิจกรรม', icon: <EventIcon /> },
        { id: 'qr-generator', label: 'สร้าง QR Code', icon: <QrCodeIcon /> }
      ]
    },
    { id: 'users', label: 'จัดการผู้ใช้', icon: <PeopleIcon />, permission: 'manage_users' },
    { id: 'reports', label: 'รายงาน', icon: <ReportsIcon />, permission: 'view_reports' },
    { id: 'admin-management', label: 'จัดการแอดมิน', icon: <SecurityIcon />, permission: 'manage_admins' },
    { id: 'settings', label: 'ตั้งค่าระบบ', icon: <SettingsIcon />, permission: 'system_settings' }
  ];

  const handleDrawerToggle = () => setDrawerOpen(!drawerOpen);
  const handleMenuExpand = (menuId: string) => {
    setExpandedMenus(prev => prev.includes(menuId) ? prev.filter(id => id !== menuId) : [...prev, menuId]);
  };
  const handleProfileMenuOpen = (e: React.MouseEvent<HTMLElement>) => setProfileMenuAnchor(e.currentTarget);
  const handleProfileMenuClose = () => setProfileMenuAnchor(null);

  const handleLogoutClick = () => { setProfileMenuAnchor(null); setLogoutDialog(true); };
  const handleLogoutConfirm = async () => {
    setLoggingOut(true); setLogoutError('');
    try {
      await signOut(auth);
      localStorage.removeItem('adminSession');
      sessionStorage.clear();
      onLogout();
      setLogoutDialog(false);
    } catch (e: any) {
      console.error('Logout error:', e);
      setLogoutError('เกิดข้อผิดพลาดในการออกจากระบบ กรุณาลองใหม่');
    } finally {
      setLoggingOut(false);
    }
  };
  const handleLogoutCancel = () => { setLogoutDialog(false); setLogoutError(''); };

  const renderItem = (item: NavEntry, depth = 0) => {
    // ✅ ใช้ hasPerm ป้องกัน permissions เป็น undefined
    if (!hasPerm(item.permission)) return null;

    const isExpanded = expandedMenus.includes(item.id);
    const hasChildren = !!item.children?.length;

    return (
      <React.Fragment key={item.id}>
        <ListItem disablePadding>
          <ListItemButton
            selected={activeSection === item.id}
            onClick={() => {
              if (hasChildren) handleMenuExpand(item.id);
              else {
                onSectionChange(item.id);
                if (isMobile) setDrawerOpen(false);
              }
            }}
            sx={{
              pl: 2 + depth * 2, borderRadius: 2, mx: 1, mb: 0.5,
              '&.Mui-selected': { backgroundColor: 'primary.main', color: 'white',
                '&:hover': { backgroundColor: 'primary.dark' } }
            }}
          >
            <ListItemIcon sx={{ color: activeSection === item.id ? 'white' : 'inherit', minWidth: 40 }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '.9rem', fontWeight: activeSection === item.id ? 600 : 400 }} />
            {hasChildren && (isExpanded ? <ExpandLess /> : <ExpandMore />)}
          </ListItemButton>
        </ListItem>
        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.children!.map(child => renderItem(child, depth + 1))}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Brand */}
      <Box sx={{ p: 3, textAlign: 'center', bgcolor: 'primary.main', color: 'white' }}>
        <Avatar sx={{ bgcolor: 'white', color: 'primary.main', mx: 'auto', mb: 1, width: 56, height: 56 }}>
          <SupervisorIcon sx={{ fontSize: 32 }} />
        </Avatar>
        <Typography variant="h6" fontWeight="bold">Admin Panel</Typography>
        <Typography variant="caption">{DEPARTMENT_LABELS[currentAdmin.department]}</Typography>
      </Box>

      {/* Menu */}
      <Box sx={{ flex: 1, overflow: 'auto', py: 2 }}>
        <List>{menuItems.map(renderItem)}</List>
      </Box>

      {/* User + Quick Logout */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar src={currentAdmin.profileImage} sx={{ width: 40, height: 40 }}>
            {currentAdmin.firstName?.charAt(0)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight="medium" noWrap>{currentAdmin.displayName}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {ROLE_LABELS[currentAdmin.role]}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={handleLogoutClick}
            sx={{ color: 'error.main', '&:hover': { bgcolor: 'error.light' } }}
            title="ออกจากระบบ"
          >
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerOpen ? DRAWER_WIDTH : 0}px)` },
          ml: { md: `${drawerOpen ? DRAWER_WIDTH : 0}px` },
          bgcolor: 'background.paper',
          color: 'text.primary',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
        }}
      >
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>ระบบจัดการกิจกรรม</Typography>
          <IconButton color="inherit" sx={{ mr: 1 }}>
            <Badge badgeContent={4} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>
          <IconButton onClick={handleProfileMenuOpen} sx={{ p: 0 }}>
            <Avatar src={currentAdmin.profileImage} sx={{ width: 32, height: 32 }}>
              {currentAdmin.firstName?.charAt(0)}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={profileMenuAnchor}
            open={Boolean(profileMenuAnchor)}
            onClose={handleProfileMenuClose}
            onClick={handleProfileMenuClose}
            PaperProps={{ sx: { borderRadius: 2, minWidth: 180 } }}
          >
            <MenuItem onClick={() => onSectionChange('profile')}>
              <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon> โปรไฟล์
            </MenuItem>
            <MenuItem onClick={() => onSectionChange('settings')}>
              <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon> ตั้งค่า
            </MenuItem>
            <Divider />
            <MenuItem
              onClick={handleLogoutClick}
              sx={{ color: 'error.main', '&:hover': { bgcolor: 'error.light' } }}
            >
              <ListItemIcon><LogoutIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
              ออกจากระบบ
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={isMobile ? 'temporary' : 'persistent'}
          open={drawerOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH, border: 'none', boxShadow: '2px 0 8px rgba(0,0,0,0.1)' } }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, width: { md: `calc(100% - ${drawerOpen ? DRAWER_WIDTH : 0}px)` }, minHeight: '100vh', bgcolor: 'grey.50' }}>
        <Toolbar />
        {children}
      </Box>

      {/* Logout dialog */}
      <Dialog open={logoutDialog} onClose={handleLogoutCancel} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ textAlign: 'center', pb: 1, bgcolor: 'warning.light', color: 'warning.dark' }}>
          <WarningIcon sx={{ fontSize: 40, mb: 1, color: 'warning.main' }} />
          <Typography variant="h6" fontWeight="bold">ยืนยันการออกจากระบบ</Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 3, textAlign: 'center' }}>
          {logoutError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{logoutError}</Alert>}
          <Box sx={{ mb: 3 }}>
            <Avatar src={currentAdmin.profileImage} sx={{ width: 60, height: 60, mx: 'auto', mb: 2, border: '3px solid', borderColor: 'primary.main' }}>
              {currentAdmin.firstName?.charAt(0)}
            </Avatar>
            <Typography variant="body1" gutterBottom><strong>{currentAdmin.displayName}</strong></Typography>
            <Typography variant="body2" color="text.secondary">
              {ROLE_LABELS[currentAdmin.role]} • {DEPARTMENT_LABELS[currentAdmin.department]}
            </Typography>
          </Box>
          <Typography variant="body1" sx={{ mb: 2 }}>คุณต้องการออกจากระบบแอดมินหรือไม่?</Typography>
          <Typography variant="body2" color="text.secondary">การทำงานที่ยังไม่ได้บันทึกอาจจะหายไป</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1, justifyContent: 'center' }}>
          <Button onClick={handleLogoutCancel} variant="outlined" size="large" disabled={loggingOut} sx={{ minWidth: 120, borderRadius: 2 }}>ยกเลิก</Button>
          <Button
            onClick={handleLogoutConfirm}
            variant="contained" color="error" size="large" disabled={loggingOut}
            startIcon={loggingOut ? <CircularProgress size={16} color="inherit" /> : <LogoutIcon />}
            sx={{ minWidth: 120, borderRadius: 2 }}
          >
            {loggingOut ? 'กำลังออกจากระบบ...' : 'ออกจากระบบ'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Utility logout (optionally export)
export const performLogout = async (): Promise<void> => {
  try {
    await signOut(auth);
    localStorage.removeItem('adminSession');
    localStorage.removeItem('currentAdmin');
    localStorage.removeItem('adminPermissions');
    sessionStorage.clear();
    window.location.href = '/admin/login';
  } catch (error) {
    console.error('Logout error:', error);
    throw new Error('เกิดข้อผิดพลาดในการออกจากระบบ');
  }
};

export default AdminLayout;
