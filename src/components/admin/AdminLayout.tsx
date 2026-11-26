// src/components/admin/AdminLayout.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { signOut } from 'firebase/auth';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  UserCircle,
  PanelLeftClose,
  PanelLeft,
  FlaskConical,
  Link2,
} from 'lucide-react';

import { adminAuth as auth } from '@/lib/firebaseAdminClient';
import { cn } from '@/lib/utils';
import type { AdminProfile, AdminPermission } from '@/types/admin';
import { DEPARTMENT_LABELS, ROLE_LABELS, ROLE_PERMISSIONS } from '@/types/admin';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
const COLLAPSED_WIDTH = 76;

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
  description?: string;
  icon: React.ReactNode;
  permission?: AdminPermission;
  children?: NavEntry[];
}

const SECTION_PERM_REQUIRED: Record<string, AdminPermission | undefined> = {
  dashboard: undefined,
  activities: undefined, // ตรวจสิทธิ์ภายใน ActivitiesHubPanel (รองรับทั้ง manage_activities และ view_reports)
  'short-links': 'manage_activities',
  users: 'manage_users',
  'team-settings': undefined, // ตรวจสิทธิ์ตามแท็บใน TeamSettingsHub
  profile: undefined,
};

/** 5 เมนูหลักเรียบง่าย เข้าใจทันที (ไม่มีเมนูย่อยที่เข้าไม่ถึงตอนย่อแถบซ้าย) */
const MENU_ITEMS: NavEntry[] = [
  {
    id: 'dashboard',
    label: 'ภาพรวม',
    description: 'สถิติและกิจกรรมล่าสุด',
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    id: 'activities',
    label: 'กิจกรรม',
    description: 'สร้าง จัดการ และดูผู้เข้าร่วม',
    icon: <CalendarDays className="h-5 w-5" />,
  },
  {
    id: 'short-links',
    label: 'ลิงก์ย่อ & Dynamic QR',
    description: 'ลิงก์สั้นและ QR ที่เปลี่ยนอัตโนมัติ',
    icon: <Link2 className="h-5 w-5" />,
    permission: 'manage_activities',
  },
  {
    id: 'users',
    label: 'ผู้ใช้งาน',
    description: 'บัญชีผู้ใช้ในระบบ',
    icon: <Users className="h-5 w-5" />,
    permission: 'manage_users',
  },
  {
    id: 'team-settings',
    label: 'ทีมแอดมิน & ตั้งค่า',
    description: 'สิทธิ์ ทีมงาน และประวัติระบบ',
    icon: <Settings className="h-5 w-5" />,
  },
];

const SECTION_TITLES: Record<string, { label: string; description?: string }> = {
  ...Object.fromEntries(MENU_ITEMS.map((m) => [m.id, { label: m.label, description: m.description }])),
  profile: { label: 'โปรไฟล์', description: 'ข้อมูลส่วนตัวของผู้ดูแล' },
};

type NavItemProps = {
  item: NavEntry;
  index: number;
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
  index,
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
  const highlighted = isActive || isChildActive;

  if (sidebarCollapsed && !isMobile) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => {
              if (hasChildren) {
                const firstChild = item.children?.find((c) => hasPerm(c.permission));
                if (firstChild) onNavigate(firstChild.id);
              } else {
                onNavigate(item.id);
              }
            }}
            className={cn(
              'relative mx-auto flex h-11 w-11 items-center justify-center rounded-xl transition-[background-color,color,box-shadow,scale] duration-300 active:scale-90',
              highlighted
                ? 'bg-brand-gradient text-white shadow-[0_8px_20px_-8px_rgba(6,182,212,0.8)]'
                : 'text-slate-400 hover:bg-white/[0.07] hover:text-white'
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
    <div className="animate-fade-up" style={{ animationDelay: `${60 + index * 45}ms` }}>
      <button
        type="button"
        aria-current={isActive ? 'page' : undefined}
        onClick={() => {
          if (hasChildren) onExpand(item.id);
          else onNavigate(item.id);
        }}
        className={cn(
          'group relative flex w-full items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm font-semibold transition-[background-color,color] duration-300',
          depth > 0 ? 'ml-4 pl-4 text-[13px]' : '',
          highlighted
            ? 'bg-white/[0.08] text-white'
            : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'
        )}
      >
        {/* แถบไฮไลต์ด้านซ้าย */}
        <span
          aria-hidden
          className={cn(
            'absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand-gradient transition-[scale,opacity] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
            isActive ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'
          )}
        />
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-[background-color,color,translate] duration-300',
            highlighted
              ? 'bg-brand-gradient text-white shadow-[0_6px_16px_-6px_rgba(6,182,212,0.8)]'
              : 'bg-white/[0.04] group-hover:translate-x-0.5 group-hover:bg-white/[0.08]'
          )}
        >
          <span className="[&>svg]:h-[18px] [&>svg]:w-[18px]">{item.icon}</span>
        </span>
        <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
        {hasChildren && (
          <ChevronRight
            className={cn('h-4 w-4 shrink-0 transition-transform duration-200', isExpanded && 'rotate-90')}
          />
        )}
      </button>
      {hasChildren && (
        // CSS grid-rows transition แทน framer-motion (ไม่ต้องโหลดไลบรารีแอนิเมชัน)
        <div
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
            isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          )}
        >
          <div className="overflow-hidden">
            <div className="mt-1 space-y-1">
              {item.children!.map((child, ci) => (
                <NavItem
                  key={child.id}
                  item={child}
                  index={ci}
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
          </div>
        </div>
      )}
    </div>
  );
}

type SidebarContentProps = {
  liveAdmin: AdminProfile;
  menuItems: NavEntry[];
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
  menuItems,
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
  const compact = sidebarCollapsed && !isMobile;
  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* กราฟิกพื้นหลัง: แสงไล่สี + จุด */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute -left-24 -top-24 h-72 w-72 animate-aurora rounded-full"
          style={{ background: 'radial-gradient(closest-side, rgba(10,107,207,0.35), transparent)' }}
        />
        <div
          className="absolute -bottom-28 -right-24 h-72 w-72 animate-aurora rounded-full [animation-delay:-9s]"
          style={{ background: 'radial-gradient(closest-side, rgba(16,185,129,0.22), transparent)' }}
        />
        <div className="absolute inset-0 bg-dots text-white opacity-[0.12] mask-fade-b" />
      </div>

      <div
        className={cn(
          'relative flex h-16 shrink-0 items-center gap-3 px-4',
          compact ? 'justify-center px-2' : ''
        )}
      >
        <div className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient shadow-[0_8px_22px_-8px_rgba(6,182,212,0.8)]">
          <FlaskConical className="h-5 w-5 text-white transition-transform duration-500 group-hover:rotate-[-12deg]" />
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-950 bg-emerald-400" />
        </div>
        {!compact && (
          <div className="min-w-0 flex-1 animate-fade-in overflow-hidden">
            <h2 className="whitespace-nowrap text-sm font-extrabold tracking-tight text-white">
              PSU Admin
            </h2>
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

      <div className="relative mx-3 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <nav aria-label="เมนูแอดมิน" className="relative min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-3 py-4">
        {!compact && (
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            เมนูหลัก
          </p>
        )}
        <TooltipProvider>
          {menuItems.map((item, i) => (
            <NavItem
              key={item.id}
              item={item}
              index={i}
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

      <div className="relative mx-3 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <div className={cn('relative shrink-0 p-3', compact ? 'flex justify-center' : '')}>
        {compact ? (
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="ออกจากระบบ"
                  onClick={onLogoutClick}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">ออกจากระบบ</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.04] p-2.5">
            <div className="relative">
              <Avatar className="h-9 w-9 ring-2 ring-white/15">
                <AvatarImage src={liveAdmin.profileImage} />
                <AvatarFallback className="bg-brand-gradient text-sm font-bold text-white">
                  {liveAdmin.firstName?.charAt(0) || '?'}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-950 bg-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{liveAdmin.displayName}</p>
              <p className="truncate text-[11px] text-slate-400">{ROLE_LABELS[liveAdmin.role]}</p>
            </div>
            <button
              type="button"
              onClick={onLogoutClick}
              className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
              title="ออกจากระบบ"
              aria-label="ออกจากระบบ"
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

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('admin:sidebarCollapsed') === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['activities']);
  const [logoutDialog, setLogoutDialog] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  // matchMedia แทน resize listener — ยิงเฉพาะตอนข้าม breakpoint ไม่ใช่ทุกพิกเซล
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => {
      setIsMobile(mq.matches);
      if (mq.matches) setMobileOpen(false);
    };
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('admin:sidebarCollapsed', sidebarCollapsed ? '1' : '0');
    } catch {}
  }, [sidebarCollapsed]);

  // ปิด drawer มือถือด้วยปุ่ม Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

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

  const canSeeTeamSettings =
    liveAdmin.role === 'super_admin' ||
    hasPerm('manage_admins') ||
    hasPerm('system_settings');

  const visibleMenuItems = useMemo(
    () =>
      MENU_ITEMS.filter((item) => {
        if (item.id === 'team-settings') return canSeeTeamSettings;
        if (item.id === 'activities') {
          return (
            liveAdmin.role === 'super_admin' ||
            hasPerm('manage_activities') ||
            hasPerm('view_reports')
          );
        }
        return hasPerm(item.permission);
      }),
    [canSeeTeamSettings, hasPerm, liveAdmin.role]
  );

  const handleNavigate = (id: string) => {
    if (id === 'team-settings' && !canSeeTeamSettings) return;
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
  const sectionTitle = SECTION_TITLES[activeSection] ?? { label: 'ระบบจัดการกิจกรรม' };

  const sidebarProps: SidebarContentProps = {
    liveAdmin,
    menuItems: visibleMenuItems,
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
    <div className="flex min-h-screen max-w-[100vw] overflow-x-hidden bg-slate-50 dark:bg-[hsl(var(--background))]">
      {!isMobile && (
        <aside
          className="fixed left-0 top-0 z-40 h-screen border-r border-white/[0.06] bg-[#060b17] transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ width: sidebarWidth }}
        >
          <SidebarContent {...sidebarProps} />
        </aside>
      )}

      {isMobile && mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 animate-fade-in bg-slate-950/60 backdrop-blur-[4px]"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="เมนูแอดมิน"
            className="fixed left-0 top-0 z-50 h-screen w-[min(100vw-2.5rem,17rem)] max-w-[272px] animate-slide-in-left border-r border-white/[0.06] bg-[#060b17]"
          >
            <SidebarContent {...sidebarProps} />
          </aside>
        </>
      )}

      <div
        className="flex min-h-screen min-w-0 max-w-full flex-1 flex-col transition-[margin] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ marginLeft: isMobile ? 0 : sidebarWidth }}
      >
        <header
          className="fixed right-0 top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200/70 bg-white/80 px-3 backdrop-blur-xl backdrop-saturate-150 transition-[left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] sm:h-16 sm:gap-3 sm:px-4 dark:border-white/[0.06] dark:bg-[hsl(var(--background)/0.8)]"
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
              aria-label={sidebarCollapsed ? 'ขยาย Sidebar' : 'ย่อ Sidebar'}
            >
              {sidebarCollapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </Button>
          )}

          {/* ชื่อหน้าปัจจุบัน — เล่นแอนิเมชันทุกครั้งที่เปลี่ยนเมนู */}
          <div key={activeSection} className="min-w-0 flex-1 animate-fade-down">
            <p className="hidden text-[11px] font-semibold text-muted-foreground sm:block">
              ระบบจัดการกิจกรรม
            </p>
            <h1 className="truncate text-sm font-bold leading-tight text-slate-800 sm:text-base dark:text-slate-100">
              {sectionTitle.label}
            </h1>
          </div>

          <ThemeToggle appearance="plain" />
          <NotificationBell currentAdmin={liveAdmin} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="เมนูบัญชี"
                className="flex items-center gap-2 rounded-xl p-1 transition-colors hover:bg-slate-100 dark:hover:bg-white/[0.06]"
              >
                <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                  <AvatarImage src={liveAdmin.profileImage} />
                  <AvatarFallback className="bg-brand-gradient text-xs font-bold text-white">
                    {liveAdmin.firstName?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
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
              {canSeeTeamSettings && (
                <DropdownMenuItem onClick={() => handleNavigate('team-settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  ทีมแอดมิน & ตั้งค่า
                </DropdownMenuItem>
              )}
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
        <main className="relative min-w-0 max-w-full flex-1 overflow-x-clip">
          {/* เส้นกริดจาง ๆ ด้านบนเนื้อหา */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-grid text-slate-900 opacity-[0.35] mask-fade-b dark:text-white dark:opacity-[0.25]"
          />
          <div className="relative">{children}</div>
        </main>
      </div>

      <Dialog open={logoutDialog} onOpenChange={setLogoutDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 animate-pop-in items-center justify-center rounded-2xl bg-amber-100">
              <LogOut className="h-6 w-6 text-amber-600" />
            </div>
            <DialogTitle className="text-lg">ยืนยันการออกจากระบบ</DialogTitle>
            <DialogDescription>คุณต้องการออกจากระบบแอดมินหรือไม่?</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-2 py-2">
            <Avatar className="h-14 w-14 ring-2 ring-primary/20">
              <AvatarImage src={liveAdmin.profileImage} />
              <AvatarFallback className="bg-brand-gradient font-bold text-white">
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
