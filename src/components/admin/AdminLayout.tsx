// src/components/admin/AdminLayout.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  CalendarDays,
  QrCode,
  Users,
  BarChart3,
  ShieldCheck,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  UserCircle,
  PanelLeftClose,
  PanelLeft,
  Shield,
  ClipboardList,
  Link2,
  ClipboardCheck,
} from 'lucide-react';

import { adminAuth as auth } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import type { AdminProfile, AdminPermission } from '@/types/admin';
import { DEPARTMENT_LABELS, ROLE_LABELS, ROLE_PERMISSIONS } from '@/types/admin';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import NotificationBell from './NotificationBell';
import ThemeToggle from '@/components/common/ThemeToggle';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
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

/** คงที่ระดับโมดูล — ไม่สร้างใหม่ทุกรอบ render */
const MENU_ITEMS: NavEntry[] = [
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
  {
    id: 'registration-history',
    label: 'ประวัติลงทะเบียน',
    icon: <ClipboardList className="h-5 w-5" />,
    permission: 'view_reports',
  },
  {
    id: 'survey-results',
    label: 'ผลแบบประเมิน',
    icon: <ClipboardCheck className="h-5 w-5" />,
    permission: 'view_reports',
  },
  {
    id: 'admin-management',
    label: 'จัดการแอดมิน',
    icon: <ShieldCheck className="h-5 w-5" />,
    permission: 'manage_admins',
  },
  { id: 'settings', label: 'ตั้งค่าระบบ', icon: <Settings className="h-5 w-5" />, permission: 'system_settings' },
];

type NavItemProps = {
  item: NavEntry;
  depth?: number;
  activeSection: string;
  sidebarCollapsed: boolean;
  isMobile: boolean;
  expandedMenus: string[];
  hasPerm: (p?: AdminPermission) => boolean;
  onExpand: (id: string) => void;
  onNavigate: (id: string) => void;
};

/** อย่าประกาศใน AdminLayout — remount ทุก state = กระพริบ */
function NavItem({
  item,
  depth = 0,
  activeSection,
  sidebarCollapsed,
  isMobile,
  expandedMenus,
  hasPerm,
  onExpand,
  onNavigate,
}: NavItemProps) {
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
            type="button"
            onClick={() => {
              if (hasChildren) {
                const firstChild = item.children?.find((c) => hasPerm(c.permission));
                if (firstChild) onNavigate(firstChild.id);
              } else {
                onNavigate(item.id);
              }
            }}
            className={cn(
              'mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-150',
              isActive || isChildActive
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                : 'text-slate-400 hover:bg-white/10 hover:text-white'
            )}
          >
            {item.icon}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (hasChildren) onExpand(item.id);
          else onNavigate(item.id);
        }}
        className={cn(
          'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
          depth > 0 ? 'ml-4 pl-4 text-[13px]' : '',
          isActive
            ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
            : isChildActive
              ? 'bg-white/5 text-white'
              : 'text-slate-400 hover:bg-white/10 hover:text-white'
        )}
      >
        <span className="shrink-0">{item.icon}</span>
        <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
        {hasChildren && (
          <ChevronRight
            className={cn('h-4 w-4 shrink-0 transition-transform duration-200', isExpanded && 'rotate-90')}
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
                  <NavItem
                    key={child.id}
                    item={child}
                    depth={depth + 1}
                    activeSection={activeSection}
                    sidebarCollapsed={sidebarCollapsed}
                    isMobile={isMobile}
                    expandedMenus={expandedMenus}
                    hasPerm={hasPerm}
                    onExpand={onExpand}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </>
  );
}

type SidebarContentProps = {
  liveAdmin: AdminProfile;
  sidebarCollapsed: boolean;
  isMobile: boolean;
  activeSection: string;
  expandedMenus: string[];
  hasPerm: (p?: AdminPermission) => boolean;
  onExpand: (id: string) => void;
  onNavigate: (id: string) => void;
  onCloseMobile: () => void;
  onLogoutClick: () => void;
};

function SidebarContent({
  liveAdmin,
  sidebarCollapsed,
  isMobile,
  activeSection,
  expandedMenus,
  hasPerm,
  onExpand,
  onNavigate,
  onCloseMobile,
  onLogoutClick,
}: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'flex h-16 shrink-0 items-center gap-3 px-4',
          sidebarCollapsed && !isMobile ? 'justify-center px-2' : ''
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/20">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        {(!sidebarCollapsed || isMobile) && (
          <div className="min-w-0 flex-1 overflow-hidden">
            <h2 className="whitespace-nowrap text-sm font-bold text-white">Admin Panel</h2>
            <p className="max-w-[160px] truncate text-[11px] text-slate-400">
              {DEPARTMENT_LABELS[liveAdmin.department]}
            </p>
          </div>
        )}
        {isMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="ปิดเมนู"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <Separator className="mx-3 bg-white/10" />

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-4">
        <TooltipProvider>
          {MENU_ITEMS.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              activeSection={activeSection}
              sidebarCollapsed={sidebarCollapsed}
              isMobile={isMobile}
              expandedMenus={expandedMenus}
              hasPerm={hasPerm}
              onExpand={onExpand}
              onNavigate={onNavigate}
            />
          ))}
        </TooltipProvider>
      </nav>

      <Separator className="mx-3 bg-white/10" />

      <div className={cn('shrink-0 p-3', sidebarCollapsed && !isMobile ? 'flex justify-center' : '')}>
        {sidebarCollapsed && !isMobile ? (
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onLogoutClick}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
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
              <AvatarFallback className="bg-primary/30 text-sm font-bold text-primary">
                {liveAdmin.firstName?.charAt(0) || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{liveAdmin.displayName}</p>
              <p className="truncate text-[11px] text-slate-400">{ROLE_LABELS[liveAdmin.role]}</p>
            </div>
            <button
              type="button"
              onClick={onLogoutClick}
              className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
              title="ออกจากระบบ"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentAdmin,
  children,
  activeSection,
  onSectionChange,
  onLogout,
}) => {
  // ใช้ prop จาก App — ไม่ subscribe Firestore ซ้ำ
  const liveAdmin = currentAdmin;

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['activities']);
  const [logoutDialog, setLogoutDialog] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile((prev) => (prev === mobile ? prev : mobile));
      if (mobile) setMobileOpen(false);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const effectivePerms: AdminPermission[] = useMemo(
    () =>
      Array.isArray(liveAdmin.permissions)
        ? liveAdmin.permissions
        : ROLE_PERMISSIONS[liveAdmin.role] ?? [],
    [liveAdmin.permissions, liveAdmin.role]
  );

  const hasPerm = useMemo(
    () => (p?: AdminPermission) => !p || effectivePerms.includes(p),
    [effectivePerms]
  );

  useEffect(() => {
    const need = SECTION_PERM_REQUIRED[activeSection];
    if (!hasPerm(need)) {
      const flatSections = [
        'dashboard',
        ...MENU_ITEMS.flatMap((m) => (m.children?.length ? m.children : [m])).map((x) => x.id),
      ];
      const fallback = flatSections.find((sec) => hasPerm(SECTION_PERM_REQUIRED[sec])) || 'dashboard';
      if (fallback !== activeSection) onSectionChange(fallback);
    }
  }, [effectivePerms, activeSection, hasPerm, onSectionChange]);

  const handleMenuExpand = (menuId: string) => {
    setExpandedMenus((prev) =>
      prev.includes(menuId) ? prev.filter((id) => id !== menuId) : [...prev, menuId]
    );
  };

  const handleNavigate = (id: string) => {
    if (hasPerm(SECTION_PERM_REQUIRED[id])) {
      onSectionChange(id);
      if (isMobile) setMobileOpen(false);
    }
  };

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

  const sidebarProps: SidebarContentProps = {
    liveAdmin,
    sidebarCollapsed,
    isMobile,
    activeSection,
    expandedMenus,
    hasPerm,
    onExpand: handleMenuExpand,
    onNavigate: handleNavigate,
    onCloseMobile: () => setMobileOpen(false),
    onLogoutClick: () => setLogoutDialog(true),
  };

  return (
    <div className="flex min-h-screen max-w-[100vw] overflow-x-hidden bg-slate-50 dark:bg-slate-950">
      {!isMobile && (
        <aside
          className="fixed left-0 top-0 z-40 h-screen border-r border-white/5 bg-slate-950 transition-[width] duration-300 ease-in-out"
          style={{ width: sidebarWidth }}
        >
          <SidebarContent {...sidebarProps} />
        </aside>
      )}

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
              className="fixed left-0 top-0 z-50 h-screen w-[min(100vw-2.5rem,17rem)] max-w-[272px] border-r border-white/5 bg-slate-950"
            >
              <SidebarContent {...sidebarProps} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div
        className="flex min-h-screen min-w-0 max-w-full flex-1 flex-col transition-[margin] duration-300"
        style={{ marginLeft: isMobile ? 0 : sidebarWidth }}
      >
        <header
          className="fixed right-0 top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200/80 bg-white/90 px-3 backdrop-blur-xl transition-[left] duration-300 ease-in-out sm:h-16 sm:gap-3 sm:px-4 dark:border-slate-800 dark:bg-slate-900/90"
          style={{ left: isMobile ? 0 : sidebarWidth }}
        >
          {isMobile ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              className="shrink-0 text-slate-600 dark:text-slate-300"
              aria-label="เปิดเมนู"
            >
              <Menu className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="text-slate-600 dark:text-slate-300"
              title={sidebarCollapsed ? 'ขยาย Sidebar' : 'ย่อ Sidebar'}
            >
              {sidebarCollapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </Button>
          )}

          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 sm:text-base dark:text-slate-100">
            ระบบจัดการกิจกรรม
          </h1>

          <ThemeToggle appearance="plain" />
          <NotificationBell currentAdmin={liveAdmin} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={liveAdmin.profileImage} />
                  <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                    {liveAdmin.firstName?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
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
                <UserCircle className="mr-2 h-4 w-4" />
                โปรไฟล์
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNavigate('settings')}>
                <Settings className="mr-2 h-4 w-4" />
                ตั้งค่า
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setLogoutDialog(true)}
                className="text-rose-600 focus:bg-rose-50 focus:text-rose-600"
              >
                <LogOut className="mr-2 h-4 w-4" />
                ออกจากระบบ
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <div className="h-14 shrink-0 sm:h-16" aria-hidden />
        <main className="min-w-0 max-w-full flex-1 overflow-x-hidden">{children}</main>
      </div>

      <Dialog open={logoutDialog} onOpenChange={setLogoutDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <LogOut className="h-6 w-6 text-amber-600" />
            </div>
            <DialogTitle className="text-lg">ยืนยันการออกจากระบบ</DialogTitle>
            <DialogDescription>คุณต้องการออกจากระบบแอดมินหรือไม่?</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-2 py-2">
            <Avatar className="h-14 w-14 border-2 border-primary/20">
              <AvatarImage src={liveAdmin.profileImage} />
              <AvatarFallback className="bg-primary/10 font-bold text-primary">
                {liveAdmin.firstName?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <p className="text-sm font-semibold">{liveAdmin.displayName}</p>
              <p className="text-xs text-muted-foreground">
                {ROLE_LABELS[liveAdmin.role]} • {DEPARTMENT_LABELS[liveAdmin.department]}
              </p>
            </div>
          </div>

          {logoutError && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {logoutError}
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">การทำงานที่ยังไม่ได้บันทึกอาจจะหายไป</p>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setLogoutDialog(false);
                setLogoutError('');
              }}
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
