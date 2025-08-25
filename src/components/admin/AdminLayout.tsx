// src/components/admin/AdminLayout.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Drawer, AppBar, Toolbar, List, Typography, Divider, IconButton, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Avatar, Menu, MenuItem, Badge, useTheme, useMediaQuery, Collapse,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Alert, CircularProgress, SwipeableDrawer
} from '@mui/material';
import {
  Menu as MenuIcon, Dashboard as DashboardIcon, People as PeopleIcon, Event as EventIcon,
  Assessment as ReportsIcon, Settings as SettingsIcon, Security as SecurityIcon, Logout as LogoutIcon,
  Notifications as NotificationsIcon, Person as PersonIcon, ExpandLess, ExpandMore, QrCode as QrCodeIcon,
  SupervisorAccount as SupervisorIcon, Warning as WarningIcon
} from '@mui/icons-material';

import { signOut } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

import type { AdminProfile, AdminPermission } from '../../types/admin';
import { DEPARTMENT_LABELS, ROLE_LABELS, ROLE_PERMISSIONS } from '../../types/admin';

const DRAWER_WIDTH = 280;

interface AdminLayoutProps {
  currentAdmin: AdminProfile;
  children: React.ReactNode;
  activeSection: string;
  onSectionChange: (section: string) => void;
  onLogout: () => void;
}

interface NavEntry {
  id: string;
  label: string;
  icon: React.ReactNode;
  permission?: AdminPermission;
  children?: NavEntry[];
}

/** map หน้า -> permission ที่ต้องมี (ถ้าไม่ระบุ = ใครก็เข้าได้) */
const SECTION_PERM_REQUIRED: Record<string, AdminPermission | undefined> = {
  dashboard: undefined,
  'activity-list': 'manage_activities',
  'qr-generator': 'manage_activities',
  activities: 'manage_activities',
  users: 'manage_users',
  reports: 'view_reports',
  'admin-management': 'manage_admins',
  settings: 'system_settings',
  profile: undefined,
};

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentAdmin,
  children,
  activeSection,
  onSectionChange,
  onLogout
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // -------------------
  // Live admin state (ดึงจาก Firestore realtime)
  // -------------------
  const [liveAdmin, setLiveAdmin] = useState<AdminProfile>(currentAdmin);

  // sync ครั้งแรก + subscribe realtime
  useEffect(() => {
    setLiveAdmin(currentAdmin);
    const ref = doc(db, 'adminUsers', currentAdmin.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const d = snap.data() as Partial<AdminProfile>;
      // merge โดยคงค่าเดิมไว้ถ้าไม่มีในเอกสาร
      setLiveAdmin((prev) => ({
        ...prev,
        ...d,
        // กัน permissions undefined
        permissions: Array.isArray(d.permissions) ? (d.permissions as AdminPermission[]) : (prev.permissions ?? ROLE_PERMISSIONS[prev.role] ?? []),
        // กันค่ารูป undefined (ไม่เขียนทับด้วย undefined)
        profileImage: d.profileImage !== undefined ? d.profileImage : prev.profileImage,
      }));
    });
    return () => unsub();
  }, [currentAdmin.uid]);

  // -------------------
  // Drawer / Navbar state
  // -------------------
  const [drawerOpen, setDrawerOpen] = useState(!isMobile);
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['activities']);
  const [logoutDialog, setLogoutDialog] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  const effectivePerms: AdminPermission[] = useMemo(
    () => (Array.isArray(liveAdmin.permissions) ? liveAdmin.permissions : ROLE_PERMISSIONS[liveAdmin.role] ?? []),
    [liveAdmin.permissions, liveAdmin.role]
  );
  const hasPerm = (p?: AdminPermission) => !p || effectivePerms.includes(p);

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

  // ถ้าสิทธิ์เปลี่ยนระหว่างใช้งาน และหน้าเดิมเข้าไม่ได้ ให้ย้ายไปหน้าแรกที่เข้าได้
  useEffect(() => {
    const need = SECTION_PERM_REQUIRED[activeSection];
    if (!hasPerm(need)) {
      // หา target แรกที่มีสิทธิ์
      const flatSections = [
        'dashboard',
        ...menuItems
          .flatMap(m => (m.children?.length ? m.children : [m]))
          .map(x => x.id),
      ];
      const fallback = flatSections.find(sec => hasPerm(SECTION_PERM_REQUIRED[sec])) || 'dashboard';
      if (fallback !== activeSection) onSectionChange(fallback);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePerms.join(','), activeSection]);

  // -------------------
  // Handlers
  // -------------------
  const handleDrawerToggle = () => setDrawerOpen(prev => !prev);
  const handleMenuExpand = (menuId: string) => {
    setExpandedMenus(prev => prev.includes(menuId) ? prev.filter(id => id !== menuId) : [...prev, menuId]);
  };
  const handleProfileMenuOpen = (e: React.MouseEvent<HTMLElement>) => setProfileMenuAnchor(e.currentTarget);
  const handleProfileMenuClose = () => setProfileMenuAnchor(null);

  const handleNavigate = (id: string) => {
    const need = SECTION_PERM_REQUIRED[id];
    if (hasPerm(need)) {
      onSectionChange(id);
      if (isMobile) setDrawerOpen(false);
    } else {
      // ปิดเมนูแต่ไม่เปลี่ยนหน้า ถ้าไม่มีสิทธิ์
      if (isMobile) setDrawerOpen(false);
    }
  };

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

  // -------------------
  // Drawer content
  // -------------------
  const renderItem = (item: NavEntry, depth = 0) => {
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
              else handleNavigate(item.id);
            }}
            sx={{
              pl: 2 + depth * 2, borderRadius: 2, mx: 1, mb: 0.5,
              '&.Mui-selected': {
                backgroundColor: 'primary.main', color: 'white',
                '&:hover': { backgroundColor: 'primary.dark' }
              }
            }}
          >
            <ListItemIcon sx={{ color: activeSection === item.id ? 'white' : 'inherit', minWidth: 40 }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{ fontSize: '.9rem', fontWeight: activeSection === item.id ? 600 : 400 }}
            />
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

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Brand */}
      <Box sx={{ p: 3, textAlign: 'center', bgcolor: 'primary.main', color: 'white' }}>
        <Avatar sx={{ bgcolor: 'white', color: 'primary.main', mx: 'auto', mb: 1, width: 56, height: 56 }}>
          <SupervisorIcon sx={{ fontSize: 32 }} />
        </Avatar>
        <Typography variant="h6" fontWeight="bold">Admin Panel</Typography>
        <Typography variant="caption">{DEPARTMENT_LABELS[liveAdmin.department]}</Typography>
      </Box>

      {/* Menu */}
      <Box sx={{ flex: 1, overflow: 'auto', py: 2 }}>
        <List>{menuItems.map(renderItem)}</List>
      </Box>

      {/* User + Quick Logout */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar src={liveAdmin.profileImage} sx={{ width: 40, height: 40 }}>
            {liveAdmin.firstName?.charAt(0)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight="medium" noWrap>{liveAdmin.displayName}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {ROLE_LABELS[liveAdmin.role]}
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

  // -------------------
  // Render
  // -------------------
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          width: { md: `calc(100% - ${!isMobile && drawerOpen ? DRAWER_WIDTH : 0}px)` },
          ml: { md: `${!isMobile && drawerOpen ? DRAWER_WIDTH : 0}px` },
          bgcolor: 'background.paper',
          color: 'text.primary',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.shorter
          })
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            aria-label="เปิด/ปิดเมนู"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography
            variant="h6"
            noWrap
            sx={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            ระบบจัดการกิจกรรม
          </Typography>
          <IconButton color="inherit" sx={{ mr: 1 }} aria-label="การแจ้งเตือน">
            <Badge badgeContent={4} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>
          <IconButton onClick={handleProfileMenuOpen} sx={{ p: 0 }} aria-label="เมนูโปรไฟล์">
            <Avatar src={liveAdmin.profileImage} sx={{ width: 32, height: 32 }}>
              {liveAdmin.firstName?.charAt(0)}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={profileMenuAnchor}
            open={Boolean(profileMenuAnchor)}
            onClose={handleProfileMenuClose}
            onClick={handleProfileMenuClose}
            PaperProps={{ sx: { borderRadius: 2, minWidth: 180 } }}
          >
            <MenuItem onClick={() => handleNavigate('profile')}>
              <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon> โปรไฟล์
            </MenuItem>
            <MenuItem onClick={() => handleNavigate('settings')}>
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

      {/* Drawer: มือถือใช้ SwipeableDrawer, เดสก์ท็อปใช้ Persistent Drawer */}
      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        {isMobile ? (
          <SwipeableDrawer
            anchor="left"
            open={drawerOpen}
            onOpen={() => setDrawerOpen(true)}
            onClose={() => setDrawerOpen(false)}
            disableDiscovery
            ModalProps={{ keepMounted: true }}
            sx={{
              '& .MuiDrawer-paper': {
                width: DRAWER_WIDTH,
                boxSizing: 'border-box',
                border: 'none'
              }
            }}
          >
            {drawerContent}
          </SwipeableDrawer>
        ) : (
          <Drawer
            variant="persistent"
            open={drawerOpen}
            sx={{
              '& .MuiDrawer-paper': {
                width: DRAWER_WIDTH,
                boxSizing: 'border-box',
                border: 'none',
                boxShadow: '2px 0 8px rgba(0,0,0,0.1)'
              }
            }}
          >
            {drawerContent}
          </Drawer>
        )}
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${!isMobile && drawerOpen ? DRAWER_WIDTH : 0}px)` },
          minHeight: '100vh',
          bgcolor: 'grey.50',
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.shorter
          })
        }}
      >
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
            <Avatar src={liveAdmin.profileImage} sx={{ width: 60, height: 60, mx: 'auto', mb: 2, border: '3px solid', borderColor: 'primary.main' }}>
              {liveAdmin.firstName?.charAt(0)}
            </Avatar>
            <Typography variant="body1" gutterBottom><strong>{liveAdmin.displayName}</strong></Typography>
            <Typography variant="body2" color="text.secondary">
              {ROLE_LABELS[liveAdmin.role]} • {DEPARTMENT_LABELS[liveAdmin.department]}
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

export default AdminLayout;
