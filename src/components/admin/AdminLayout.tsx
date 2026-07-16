// src/components/admin/AdminLayout.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, CalendarDays, QrCode, Users, BarChart3,
  ShieldCheck, Settings, LogOut, Bell, ChevronDown, ChevronRight,
  Menu, X, UserCircle, PanelLeftClose, PanelLeft, Shield, ClipboardList, Link2,
  ClipboardCheck
} from 'lucide-react';

import { adminAuth as auth, adminDb as db } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import type { AdminProfile, AdminPermission } from '@/types/admin';
import { DEPARTMENT_LABELS, ROLE_LABELS, ROLE_PERMISSIONS } from '@/types/admin';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import NotificationBell from './NotificationBell';
import ThemeToggle from '@/components/common/ThemeToggle';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

const DRAWER_WIDTH = 272;
const COLLAPSED_WIDTH = 72;

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

const SECTION_PERM_REQUIRED: Record<string, AdminPermission | undefined> = {
  dashboard: undefined,
  'activity-list': 'manage_activities',
  'qr-generator': 'manage_activities',
  'short-links': 'manage_activities',
  activities: 'manage_activities',
  users: 'manage_users',
  reports: 'view_reports',
  'registration-history': 'view_reports',
  'survey-results': 'view_reports',
  'admin-management': 'manage_admins',
  settings: 'system_settings',
  profile: undefined,
};

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentAdmin,
  children,
  activeSection,
  onSectionChange,
  onLogout,
}) => {
  // ─── Live Admin ───
  const [liveAdmin, setLiveAdmin] = useState<AdminProfile>(currentAdmin);

  useEffect(() => {
    if (!currentAdmin?.uid) return;
    setLiveAdmin(currentAdmin);
    try {
      const ref = doc(db, 'adminUsers', currentAdmin.uid);
      const unsub = onSnapshot(ref, (snap) => {
        if (!snap.exists()) return;
        const d = snap.data() as Partial<AdminProfile>;
        setLiveAdmin((prev) => ({
          ...prev,
          ...d,
          permissions: Array.isArray(d.permissions)
            ? (d.permissions as AdminPermission[])
            : (prev.permissions ?? ROLE_PERMISSIONS[prev.role] ?? []),
          profileImage: d.profileImage !== undefined ? d.profileImage : prev.profileImage,
        }));
      });
      return () => unsub();
    } catch (e) {
      console.error('Error subscribing to admin profile:', e);
    }
  }, [currentAdmin?.uid]);

  // ─── State ───
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['activities']);
  const [logoutDialog, setLogoutDialog] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  // Responsive check
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
        setMobileOpen(false);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ─── Permissions ───
  const effectivePerms: AdminPermission[] = useMemo(
    () =>
      Array.isArray(liveAdmin.permissions)
        ? liveAdmin.permissions
        : ROLE_PERMISSIONS[liveAdmin.role] ?? [],
    [liveAdmin.permissions, liveAdmin.role]
  );
  const hasPerm = (p?: AdminPermission) => !p || effectivePerms.includes(p);

  // ─── Nav Items ───
  const menuItems: NavEntry[] = [
    { id: 'dashboard', label: 'แดชบอร์ด', icon: <LayoutDashboard className="h-5 w-5" /> },
    {
      id: 'activities',
      label: 'จัดการกิจกรรม',
      icon: <CalendarDays className="h-5 w-5" />,
      permission: 'manage_activities',
      children: [
        { id: 'activity-list', label: 'รายการกิจกรรม', icon: <CalendarDays className="h-4 w-4" /> },
        { id: 'qr-generator', label: 'สร้าง QR Code', icon: <QrCode className="h-4 w-4" /> },
        { id: 'short-links', label: 'ลิงก์ย่อ & Dynamic QR', icon: <Link2 className="h-4 w-4" /> },
      ],
    },
    { id: 'users', label: 'จัดการผู้ใช้', icon: <Users className="h-5 w-5" />, permission: 'manage_users' },
    { id: 'reports', label: 'รายงาน', icon: <BarChart3 className="h-5 w-5" />, permission: 'view_reports' },
    { id: 'registration-history', label: 'ประวัติลงทะเบียน', icon: <ClipboardList className="h-5 w-5" />, permission: 'view_reports' },
    { id: 'survey-results', label: 'ผลแบบประเมิน', icon: <ClipboardCheck className="h-5 w-5" />, permission: 'view_reports' },
    { id: 'admin-management', label: 'จัดการแอดมิน', icon: <ShieldCheck className="h-5 w-5" />, permission: 'manage_admins' },
    { id: 'settings', label: 'ตั้งค่าระบบ', icon: <Settings className="h-5 w-5" />, permission: 'system_settings' },
  ];

  // Redirect on permission change
  useEffect(() => {
    const need = SECTION_PERM_REQUIRED[activeSection];
    if (!hasPerm(need)) {
      const flatSections = [
        'dashboard',
        ...menuItems.flatMap((m) => (m.children?.length ? m.children : [m])).map((x) => x.id),
      ];
      const fallback = flatSections.find((sec) => hasPerm(SECTION_PERM_REQUIRED[sec])) || 'dashboard';
      if (fallback !== activeSection) onSectionChange(fallback);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePerms.join(','), activeSection]);

  // ─── Handlers ───
  const handleMenuExpand = (menuId: string) => {
    setExpandedMenus((prev) =>
      prev.includes(menuId) ? prev.filter((id) => id !== menuId) : [...prev, menuId]
    );
  };

  const handleNavigate = (id: string) => {
    const need = SECTION_PERM_REQUIRED[id];
    if (hasPerm(need)) {
      onSectionChange(id);
      if (isMobile) setMobileOpen(false);
    }
  };

  const handleLogoutClick = () => setLogoutDialog(true);

  const handleLogoutConfirm = async () => {
    setLoggingOut(true);
    setLogoutError('');
    try {
      await signOut(auth);
      localStorage.removeItem('adminSession');
      sessionStorage.clear();
      onLogout();
      setLogoutDialog(false);
    } catch {
      setLogoutError('เกิดข้อผิดพลาดในการออกจากระบบ กรุณาลองใหม่');
    } finally {
      setLoggingOut(false);
    }
  };

  const sidebarWidth = sidebarCollapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH;

  // ─── Sidebar Nav Item ───
  const NavItem = ({ item, depth = 0 }: { item: NavEntry; depth?: number }) => {
    if (!hasPerm(item.permission)) return null;
    const isExpanded = expandedMenus.includes(item.id);
    const hasChildren = !!item.children?.length;
    const isActive = activeSection === item.id;
    const isChildActive = item.children?.some((c) => activeSection === c.id) ?? false;

    if (sidebarCollapsed && !isMobile) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => {
                if (hasChildren) {
                  // Navigate to first child
                  const firstChild = item.children?.find((c) => hasPerm(c.permission));
                  if (firstChild) handleNavigate(firstChild.id);
                } else {
                  handleNavigate(item.id);
                }
              }}
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-lg mx-auto transition-all duration-200',
                (isActive || isChildActive)
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              )}
            >
              {item.icon}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <>
        <button
          onClick={() => {
            if (hasChildren) handleMenuExpand(item.id);
            else handleNavigate(item.id);
          }}
          className={cn(
            'group flex items-center w-full gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
            depth > 0 ? 'ml-4 pl-4 text-[13px]' : '',
            isActive
              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
              : isChildActive
                ? 'bg-white/5 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
          )}
        >
          <span className="shrink-0">{item.icon}</span>
          <span className="flex-1 text-left truncate">{item.label}</span>
          {hasChildren && (
            <ChevronRight
              className={cn(
                'h-4 w-4 shrink-0 transition-transform duration-200',
                isExpanded && 'rotate-90'
              )}
            />
          )}
        </button>
        {hasChildren && (
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="mt-1 space-y-1">
                  {item.children!.map((child) => (
                    <NavItem key={child.id} item={child} depth={depth + 1} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </>
    );
  };

  // ─── Sidebar Content ───
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className={cn(
        'flex items-center gap-3 px-4 h-16 shrink-0',
        sidebarCollapsed && !isMobile ? 'justify-center px-2' : ''
      )}>
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/20 shrink-0">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        {(!sidebarCollapsed || isMobile) && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            className="overflow-hidden flex-1 min-w-0"
          >
            <h2 className="text-sm font-bold text-white whitespace-nowrap">Admin Panel</h2>
            <p className="text-[11px] text-slate-400 truncate max-w-[160px]">
              {DEPARTMENT_LABELS[liveAdmin.department]}
            </p>
          </motion.div>
        )}
        {isMobile && (
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="ปิดเมนู"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <Separator className="bg-white/10 mx-3" />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        <TooltipProvider>
          {menuItems.map((item) => (
            <NavItem key={item.id} item={item} />
          ))}
        </TooltipProvider>
      </nav>

      <Separator className="bg-white/10 mx-3" />

      {/* User Footer */}
      <div className={cn(
        'p-3 shrink-0',
        sidebarCollapsed && !isMobile ? 'flex justify-center' : ''
      )}>
        {sidebarCollapsed && !isMobile ? (
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogoutClick}
                  className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">ออกจากระบบ</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 border-2 border-white/20">
              <AvatarImage src={liveAdmin.profileImage} />
              <AvatarFallback className="bg-primary/30 text-primary text-sm font-bold">
                {liveAdmin.firstName?.charAt(0) || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{liveAdmin.displayName}</p>
              <p className="text-[11px] text-slate-400 truncate">{ROLE_LABELS[liveAdmin.role]}</p>
            </div>
            <button
              onClick={handleLogoutClick}
              className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="ออกจากระบบ"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen max-w-[100vw] overflow-x-hidden bg-slate-50 dark:bg-slate-950">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside
          className="fixed top-0 left-0 z-40 h-screen bg-slate-950 border-r border-white/5 transition-all duration-300 ease-in-out"
          style={{ width: sidebarWidth }}
        >
          {SidebarContent()}
        </aside>
      )}

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobile && mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -DRAWER_WIDTH }}
              animate={{ x: 0 }}
              exit={{ x: -DRAWER_WIDTH }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed top-0 left-0 z-50 h-screen bg-slate-950 border-r border-white/5 w-[min(100vw-2.5rem,17rem)] max-w-[272px]"
            >
              {SidebarContent()}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div
        className="flex-1 flex flex-col min-h-screen min-w-0 max-w-full overflow-x-hidden transition-all duration-300"
        style={{ marginLeft: isMobile ? 0 : sidebarWidth }}
      >
        {/* Header */}
        <header className="sticky top-0 z-30 h-14 sm:h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800 flex items-center px-3 sm:px-4 gap-2 sm:gap-3 shrink-0">
          {/* Mobile menu toggle */}
          {isMobile ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              className="text-slate-600 dark:text-slate-300 shrink-0"
              aria-label="เปิดเมนู"
            >
              <Menu className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="text-slate-600 dark:text-slate-300"
              title={sidebarCollapsed ? 'ขยาย Sidebar' : 'ย่อ Sidebar'}
            >
              {sidebarCollapsed ? (
                <PanelLeft className="h-5 w-5" />
              ) : (
                <PanelLeftClose className="h-5 w-5" />
              )}
            </Button>
          )}

          <h1 className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-100 truncate flex-1 min-w-0">
            ระบบจัดการกิจกรรม
          </h1>

          <ThemeToggle appearance="plain" />

          {/* Notification */}
          <NotificationBell currentAdmin={liveAdmin} />

          {/* Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={liveAdmin.profileImage} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                    {liveAdmin.firstName?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-semibold">{liveAdmin.displayName}</span>
                  <span className="text-xs font-normal text-muted-foreground">{liveAdmin.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleNavigate('profile')}>
                <UserCircle className="h-4 w-4 mr-2" />
                โปรไฟล์
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNavigate('settings')}>
                <Settings className="h-4 w-4 mr-2" />
                ตั้งค่า
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogoutClick}
                className="text-rose-600 focus:text-rose-600 focus:bg-rose-50"
              >
                <LogOut className="h-4 w-4 mr-2" />
                ออกจากระบบ
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page Content */}
        <main className="flex-1 min-w-0 max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Logout Dialog */}
      <Dialog open={logoutDialog} onOpenChange={setLogoutDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 mb-3">
              <LogOut className="h-6 w-6 text-amber-600" />
            </div>
            <DialogTitle className="text-lg">ยืนยันการออกจากระบบ</DialogTitle>
            <DialogDescription>
              คุณต้องการออกจากระบบแอดมินหรือไม่?
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-2 py-2">
            <Avatar className="h-14 w-14 border-2 border-primary/20">
              <AvatarImage src={liveAdmin.profileImage} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                {liveAdmin.firstName?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <p className="font-semibold text-sm">{liveAdmin.displayName}</p>
              <p className="text-xs text-muted-foreground">
                {ROLE_LABELS[liveAdmin.role]} • {DEPARTMENT_LABELS[liveAdmin.department]}
              </p>
            </div>
          </div>

          {logoutError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {logoutError}
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            การทำงานที่ยังไม่ได้บันทึกอาจจะหายไป
          </p>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => { setLogoutDialog(false); setLogoutError(''); }}
              disabled={loggingOut}
              className="flex-1"
            >
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={handleLogoutConfirm}
              disabled={loggingOut}
              className="flex-1 gap-2"
            >
              {loggingOut ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  กำลังออก...
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4" />
                  ออกจากระบบ
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLayout;