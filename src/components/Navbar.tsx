// components/Navbar.tsx
'use client';

import React, { useEffect, useState, useCallback, startTransition } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import {
  FlaskConical,
  Home,
  Shield,
  LogIn,
  LogOut,
  Settings,
  History,
  X,
  GraduationCap,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Spinner } from '@/components/ui/spinner';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useAuth, updateUserProfile, isProfileComplete } from '../lib/firebaseAuth';
import ThemeToggle from './common/ThemeToggle';
import { pageColors } from '@/lib/uiTheme';
import { cn } from '@/lib/utils';
import { optimizeAvatarUrl } from '@/utils/avatar';

const ProfileEditDialog = dynamic(() => import('./profile/ProfileEditDialog'), {
  ssr: false,
  loading: () => null,
});

const MicrosoftLogo: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 23 23" aria-hidden>
    <path fill="#f35325" d="M1 1h10v10H1z" />
    <path fill="#81bc06" d="M12 1h10v10H12z" />
    <path fill="#05a6f0" d="M1 12h10v10H1z" />
    <path fill="#ffba08" d="M12 12h10v10H12z" />
  </svg>
);

const GoogleLogo: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

const glassNavBarClass = cn(
  'fixed left-0 right-0 z-50',
  'backdrop-blur-[20px] backdrop-saturate-180',
  'bg-[color-mix(in_srgb,var(--page-card-solid)_75%,transparent)]',
  'dark:bg-[color-mix(in_srgb,var(--page-card-solid)_75%,transparent)]',
  'border-[var(--page-border)]',
  'shadow-[var(--page-shadow)]'
);

const Navbar: React.FC = () => {
  const pathname = usePathname();
  const [isTabletOrMobile, setIsTabletOrMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsTabletOrMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const { currentAdmin, refetch } = useAdminAuth();
  const { user, userData, loading: authLoading, login: userLogin, loginWithGoogle, logout: userLogout, refreshUserData } = useAuth();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginProvider, setLoginProvider] = useState<'microsoft' | 'google' | null>(null);

  const openProfileDialog = () => {
    setMenuOpen(false);
    requestAnimationFrame(() => {
      startTransition(() => setProfileDialogOpen(true));
    });
  };

  const preloadProfileDialog = () => {
    void import('./profile/ProfileEditDialog');
  };

  const handleMicrosoftLogin = async () => {
    setLoginBusy(true);
    setLoginProvider('microsoft');
    try {
      setLoginOpen(false);
      await userLogin();
    } finally {
      setLoginBusy(false);
      setLoginProvider(null);
    }
  };

  const handleGoogleLogin = async () => {
    setLoginBusy(true);
    setLoginProvider('google');
    try {
      setLoginOpen(false);
      await loginWithGoogle();
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (err?.code !== 'auth/redirect-pending' && msg) {
        console.error('Google login failed:', err);
      }
    } finally {
      setLoginBusy(false);
      setLoginProvider(null);
    }
  };

  useEffect(() => {
    if (pathname?.startsWith('/admin')) refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleSaveProfile = useCallback(async (updates: any) => {
    if (user?.uid) {
      const { isActive: _a, isVerified: _v, ...safe } = updates || {};
      await updateUserProfile(user.uid, safe);
      await refreshUserData();
    }
  }, [user?.uid, refreshUserData]);

  const navLinks = [
    { label: 'หน้าแรก', path: '/', icon: Home, activeIcon: Home },
    ...(user ? [{ label: 'ประวัติ', path: '/my-history', icon: History, activeIcon: History }] : []),
    ...(currentAdmin ? [{ label: 'Admin', path: '/admin', icon: Shield, activeIcon: Shield }] : []),
  ];

  const handleConfirmLogout = async () => {
    setLogoutDialogOpen(false);
    await userLogout();
  };

  const getDisplayName = () => {
    if (userData?.username?.trim()) return userData.username.trim();
    if (userData?.nameTitle && userData?.firstName && userData?.lastName) {
      return `${userData.nameTitle}${userData.firstName} ${userData.lastName}`;
    }
    if (userData?.displayName) return userData.displayName;
    if (userData?.firstName && userData?.lastName) return `${userData.firstName} ${userData.lastName}`;
    if (user?.displayName) return user.displayName.split(' ')[0];
    if (user?.email) return user.email.split('@')[0];
    return 'ผู้ใช้';
  };

  const getSubtitle = () => {
    if (userData?.userType === 'external') {
      if (userData.institutionName?.trim()) return userData.institutionName.trim();
      return 'บุคคลภายนอก — กรุณากรอกข้อมูล';
    }
    if (userData?.department && userData.department !== 'ไม่ระบุ') return userData.department;
    return 'กรุณากรอกข้อมูลส่วนตัว';
  };

  useEffect(() => {
    if (user && userData && !isProfileComplete(userData)) {
      setProfileDialogOpen(true);
    }
  }, [user, userData]);

  const getAvatarSrc = () =>
    optimizeAvatarUrl(user?.photoURL || userData?.photoURL, isTabletOrMobile ? 64 : 96);

  const getAvatarLetter = () =>
    userData?.firstName?.charAt(0).toUpperCase() ||
    getDisplayName().charAt(0).toUpperCase();

  const profileMenu = user ? (
    <DropdownMenu
      open={menuOpen}
      onOpenChange={(open) => {
        setMenuOpen(open);
        if (open) void import('./profile/ProfileEditDialog');
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-lg outline-none',
            isTabletOrMobile
              ? 'flex-col gap-1 text-muted-foreground'
              : 'py-1 pl-2 pr-0.5 hover:bg-accent/60'
          )}
          onMouseEnter={preloadProfileDialog}
          onFocus={preloadProfileDialog}
        >
          {isTabletOrMobile ? (
            <>
              <Avatar className="h-7 w-7">
                <AvatarImage src={getAvatarSrc()} alt="" referrerPolicy="no-referrer" />
                <AvatarFallback className="text-xs">{!getAvatarSrc() && getAvatarLetter()}</AvatarFallback>
              </Avatar>
              <span className="text-[0.65rem] font-extrabold opacity-70">โปรไฟล์</span>
            </>
          ) : (
            <>
              <div className="hidden min-w-0 max-w-[160px] flex-col items-end justify-center leading-tight sm:flex">
                <span className="w-full truncate text-right text-sm font-bold">{getDisplayName()}</span>
                <span className="w-full truncate text-right text-[0.7rem] font-medium text-muted-foreground">
                  {getSubtitle()}
                </span>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Avatar className="h-9 w-9 border-2 border-border/50 shadow-sm sm:h-10 sm:w-10">
                      <AvatarImage src={getAvatarSrc()} alt="" referrerPolicy="no-referrer" />
                      <AvatarFallback>{!getAvatarSrc() && getAvatarLetter()}</AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>จัดการบัญชี</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={isTabletOrMobile ? 'center' : 'end'}
        side={isTabletOrMobile ? 'top' : 'bottom'}
        className="min-w-[260px] sm:min-w-[300px] rounded-xl border-[var(--page-border)] bg-[var(--page-card)] shadow-[var(--page-shadow)] backdrop-blur-md"
      >
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 shadow-md">
              <AvatarImage src={getAvatarSrc()} alt="" referrerPolicy="no-referrer" />
              <AvatarFallback>{!getAvatarSrc() && getAvatarLetter()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-bold leading-tight">{getDisplayName()}</p>
              <p className="break-all text-xs leading-tight text-muted-foreground">{user.email}</p>
              {userData?.department && userData.department !== 'ไม่ระบุ' && (
                <p className="mt-1 block text-xs leading-tight text-muted-foreground">{userData.department}</p>
              )}
              {userData?.studentId && (
                <p className="mt-1 block font-mono text-xs font-bold text-primary">รหัส: {userData.studentId}</p>
              )}
            </div>
          </div>
        </div>

        <DropdownMenuItem asChild className="mt-1 cursor-pointer py-3">
          <Link href="/my-history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            <span className="font-medium">ประวัติการลงทะเบียน</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openProfileDialog} className="cursor-pointer py-3">
          <Settings className="h-4 w-4" />
          <span className="font-medium">ตั้งค่าโปรไฟล์</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setMenuOpen(false);
            setLogoutDialogOpen(true);
          }}
          className="cursor-pointer py-3 text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4 text-destructive" />
          <div className="flex flex-col">
            <span className="font-medium">ออกจากระบบ</span>
            <span className="text-xs text-muted-foreground">ออกจากบัญชีปัจจุบัน</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  return (
    <>
      <header
        className={cn(
          glassNavBarClass,
          isTabletOrMobile
            ? 'bottom-0 top-auto rounded-t-3xl border-t pb-[env(safe-area-inset-bottom)]'
            : 'top-0 border-b'
        )}
      >
        <div className="mx-auto max-w-5xl px-4">
          <div
            className={cn(
              'flex items-center justify-between',
              isTabletOrMobile ? 'h-[70px]' : 'h-16'
            )}
          >
            {!isTabletOrMobile && (
              <Link href="/" className="flex items-center gap-3 no-underline transition-opacity hover:opacity-80">
                <div className="flex rounded bg-primary p-1 shadow-[0_4px_12px_rgba(var(--primary),0.3)]">
                  <FlaskConical className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-black leading-tight tracking-tight">PSU REGISTER</span>
                  <span className="text-xs font-semibold text-muted-foreground">Faculty of Science</span>
                </div>
              </Link>
            )}

            {!isTabletOrMobile && (
              <div className="flex items-center gap-4">
                <nav className="flex items-center gap-1">
                  {navLinks.map((link) => {
                    const active = pathname === link.path;
                    return (
                      <Button
                        key={link.label}
                        asChild
                        variant="ghost"
                        className={cn(
                          'rounded-lg px-4 font-bold',
                          active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-primary'
                        )}
                      >
                        <Link href={link.path}>{link.label}</Link>
                      </Button>
                    );
                  })}
                </nav>

                <div className="h-6 w-px bg-border" />

                <ThemeToggle />

                {authLoading ? (
                  <div
                    className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-muted"
                    aria-hidden
                    title="กำลังตรวจสอบสถานะเข้าสู่ระบบ"
                  />
                ) : user ? (
                  profileMenu
                ) : (
                  <Button
                    onClick={() => setLoginOpen(true)}
                    disabled={loginBusy}
                    className="rounded-2xl px-6 font-bold"
                  >
                    <LogIn className="h-4 w-4" />
                    เข้าสู่ระบบ
                  </Button>
                )}
              </div>
            )}

            {isTabletOrMobile && (
              <div className="flex w-full items-center justify-around">
                {navLinks.map((link) => {
                  const isActive = pathname === link.path;
                  const Icon = isActive ? link.activeIcon : link.icon;
                  return (
                    <Link
                      key={link.label}
                      href={link.path}
                      className={cn(
                        'relative flex flex-col items-center gap-1 no-underline',
                        isActive ? 'text-primary' : 'text-muted-foreground'
                      )}
                    >
                      <span
                        className={cn(
                          'inline-flex transition-transform duration-200',
                          isActive && '-translate-y-1 scale-110'
                        )}
                      >
                        <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
                      </span>
                      <span className={cn('text-[0.65rem] font-extrabold', isActive ? 'opacity-100' : 'opacity-70')}>
                        {link.label}
                      </span>
                      {isActive && (
                        <span className="absolute -bottom-1 h-1 w-1 rounded-full bg-primary" />
                      )}
                    </Link>
                  );
                })}

                <div className="flex flex-col items-center gap-1">
                  <ThemeToggle />
                  <span className="text-[0.65rem] font-extrabold text-muted-foreground opacity-70">ธีม</span>
                </div>

                {authLoading ? (
                  <div className="flex flex-col items-center gap-1" aria-hidden>
                    <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                    <span className="text-[0.65rem] font-extrabold text-muted-foreground opacity-40">…</span>
                  </div>
                ) : user ? (
                  profileMenu
                ) : (
                  <button
                    type="button"
                    onClick={() => setLoginOpen(true)}
                    disabled={loginBusy}
                    className="flex cursor-pointer flex-col items-center gap-1 text-muted-foreground disabled:opacity-50"
                  >
                    <LogIn className="h-5 w-5" />
                    <span className="text-[0.65rem] font-extrabold opacity-70">เข้าสู่ระบบ</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Login Popup */}
        <Dialog open={loginOpen} onOpenChange={(o) => !loginBusy && setLoginOpen(o)}>
          <DialogContent
            className="max-w-sm overflow-hidden rounded-3xl border-[var(--page-border)] bg-[var(--page-card-solid)] p-0 shadow-[var(--page-shadow)] [&>button]:hidden"
            onInteractOutside={(e) => loginBusy && e.preventDefault()}
          >
            <div className="relative px-6 pb-2 pt-6">
              <button
                type="button"
                aria-label="ปิด"
                disabled={loginBusy}
                onClick={() => setLoginOpen(false)}
                className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex flex-col items-center gap-3 pb-2 pt-1">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl border"
                  style={{
                    borderColor: pageColors.border,
                    background: 'linear-gradient(145deg, rgba(10,107,207,0.16) 0%, rgba(26,163,90,0.16) 100%)',
                  }}
                >
                  <LogIn className="h-7 w-7 text-primary" />
                </div>
                <DialogHeader className="space-y-1 text-center sm:text-center">
                  <DialogTitle className="text-lg font-extrabold tracking-tight" style={{ color: pageColors.textPrimary }}>
                    เข้าสู่ระบบ
                  </DialogTitle>
                  <DialogDescription style={{ color: pageColors.textSecondary }}>
                    เลือกวิธีเข้าสู่ระบบที่เหมาะกับคุณ
                  </DialogDescription>
                </DialogHeader>
              </div>
            </div>

            <div className="space-y-3 px-6 pb-6 pt-2">
              <button
                type="button"
                disabled={loginBusy}
                onClick={handleMicrosoftLogin}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all',
                  'bg-[color-mix(in_srgb,var(--page-bg)_55%,transparent)]',
                  'hover:border-primary hover:-translate-y-px',
                  loginBusy && loginProvider !== 'microsoft' && 'opacity-55',
                  loginBusy && 'cursor-wait'
                )}
                style={{ borderColor: pageColors.border }}
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
                  style={{ borderColor: pageColors.border, background: pageColors.cardBgSolid }}
                >
                  {loginProvider === 'microsoft' ? <Spinner size="sm" /> : <MicrosoftLogo />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.95rem] font-extrabold leading-tight" style={{ color: pageColors.textPrimary }}>
                    Microsoft
                  </p>
                  <p className="block text-xs font-semibold" style={{ color: pageColors.textSecondary }}>
                    บัญชีมหาวิทยาลัย @psu.ac.th
                  </p>
                </div>
                <GraduationCap className="h-[18px] w-[18px] opacity-70" style={{ color: pageColors.textSecondary }} />
              </button>

              <button
                type="button"
                disabled={loginBusy}
                onClick={handleGoogleLogin}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all',
                  'bg-[color-mix(in_srgb,var(--page-bg)_55%,transparent)]',
                  'hover:border-primary hover:-translate-y-px',
                  loginBusy && loginProvider !== 'google' && 'opacity-55',
                  loginBusy && 'cursor-wait'
                )}
                style={{ borderColor: pageColors.border }}
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
                  style={{ borderColor: pageColors.border, background: pageColors.cardBgSolid }}
                >
                  {loginProvider === 'google' ? <Spinner size="sm" /> : <GoogleLogo />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.95rem] font-extrabold leading-tight" style={{ color: pageColors.textPrimary }}>
                    Google
                  </p>
                  <p className="block text-xs font-semibold" style={{ color: pageColors.textSecondary }}>
                    ม.อ. หรือบุคคลภายนอก
                  </p>
                </div>
                <UserRound className="h-[18px] w-[18px] opacity-70" style={{ color: pageColors.textSecondary }} />
              </button>

              <p className="mt-2 block text-center text-xs leading-relaxed" style={{ color: pageColors.textSecondary }}>
                นักศึกษา/บุคลากร ม.อ. แนะนำใช้ Microsoft · ผู้เข้าร่วมภายนอกใช้ Google
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Logout Confirmation */}
        <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
          <DialogContent className="rounded-[20px] sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-extrabold">ยืนยันการออกจากระบบ?</DialogTitle>
              <DialogDescription>
                คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบบัญชี {user?.email}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setLogoutDialogOpen(false)} className="font-semibold text-muted-foreground">
                ยกเลิก
              </Button>
              <Button variant="destructive" onClick={handleConfirmLogout} className="rounded-xl font-bold">
                ออกจากระบบ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ProfileEditDialog
          open={profileDialogOpen}
          isFirstTimeSetup={Boolean(user && userData && !isProfileComplete(userData))}
          onClose={() => {
            if (user && userData && !isProfileComplete(userData)) return;
            setProfileDialogOpen(false);
          }}
          user={user}
          userData={userData}
          onSave={handleSaveProfile}
        />
      </header>
      {!isTabletOrMobile && <div aria-hidden className="h-16 shrink-0" />}
    </>
  );
};

export default Navbar;
