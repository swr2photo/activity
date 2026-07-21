'use client';
import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { glassCardLargeClass, pageColors } from '../../lib/uiTheme';
import { cn } from '@/lib/utils';
import MicrosoftLogin from '../MicrosoftLogin';
import GoogleLoginButton from './GoogleLoginButton';
import {
  isUniversityEmail,
  signOutUser,
  consumeAuthRedirectResult,
  mapAuthError,
  AuthRedirectPendingError,
} from '../../lib/firebaseAuth';
import { SessionManager } from '../../lib/sessionManager';

interface MicrosoftAuthSectionProps {
  activityData: any;
  onLoginSuccess: (userProfile: any) => void;
  onLoginError: (error: string) => void;
  onPreLoginCheck: (email: string) => Promise<boolean>;
  disabled?: boolean;
  checkingIP?: boolean;
  allowedDomains?: string[];
  maxRetries?: number;
}

interface AuthState {
  isLoading: boolean;
  error: string | null;
  retryCount: number;
  lastAttempt: Date | null;
}

const MicrosoftAuthSection: React.FC<MicrosoftAuthSectionProps> = ({
  activityData,
  onLoginSuccess,
  onLoginError,
  onPreLoginCheck,
  disabled = false,
  checkingIP = false,
  allowedDomains = ['psu.ac.th'],
  maxRetries = 3,
}) => {
  const [authState, setAuthState] = useState<AuthState>({
    isLoading: false,
    error: null,
    retryCount: 0,
    lastAttempt: null,
  });

  useEffect(() => {
    if (authState.error) {
      const timer = setTimeout(() => {
        setAuthState((prev) => ({ ...prev, error: null }));
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [authState.error]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await consumeAuthRedirectResult();
        if (cancelled || !result) return;

        setAuthState((prev) => ({ ...prev, isLoading: true }));

        try {
          const ipRes = await fetch('https://api.ipify.org?format=json');
          const ipData = await ipRes.json();
          await SessionManager.createSession(
            result.user.uid,
            result.user.email || '',
            ipData.ip || 'unknown'
          );
        } catch {
          /* session optional */
        }

        await handleLoginSuccess(result.userData);
      } catch (err: any) {
        if (cancelled) return;
        if (err instanceof AuthRedirectPendingError) return;
        const msg = mapAuthError(err) || err?.message || 'เข้าสู่ระบบไม่สำเร็จ';
        if (msg) handleLoginError(msg);
      } finally {
        if (!cancelled) setAuthState((prev) => ({ ...prev, isLoading: false }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoginSuccess = async (userProfile: any) => {
    try {
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

      const email = String(userProfile?.email || '').toLowerCase();
      const requiresUni = Boolean(activityData?.requiresUniversityLogin);
      const isExternal = userProfile?.userType === 'external' || (email && !isUniversityEmail(email));

      if (requiresUni && isExternal) {
        await signOutUser();
        throw new Error(
          `กิจกรรมนี้ต้องใช้บัญชีมหาวิทยาลัย (${allowedDomains.map((d) => `@${d}`).join(', ')})`
        );
      }

      if (requiresUni && email) {
        const isValidDomain = allowedDomains.some((domain) => email.endsWith(`@${domain}`));
        if (!isValidDomain) {
          await signOutUser();
          throw new Error(
            `กรุณาใช้บัญชีมหาวิทยาลัยที่ลงท้ายด้วย: ${allowedDomains.map((d) => `@${d}`).join(', ')}`
          );
        }
      }

      if (onPreLoginCheck && userProfile?.email) {
        const canProceed = await onPreLoginCheck(userProfile.email);
        if (!canProceed) {
          throw new Error('ไม่สามารถเข้าสู่ระบบได้ กรุณาติดต่อผู้ดูแลระบบ');
        }
      }

      setAuthState((prev) => ({ ...prev, retryCount: 0, lastAttempt: new Date() }));
      onLoginSuccess(userProfile);
    } catch (error: any) {
      handleLoginError(error?.message || 'เกิดข้อผิดพลาดในการประมวลผลการเข้าสู่ระบบ');
    } finally {
      setAuthState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const handleLoginError = (error: string) => {
    setAuthState((prev) => ({
      ...prev,
      error,
      retryCount: prev.retryCount + 1,
      isLoading: false,
      lastAttempt: new Date(),
    }));
    onLoginError(error);
  };

  const canRetry = authState.retryCount < maxRetries;
  const loginDisabled = disabled || checkingIP || authState.isLoading || !canRetry;

  const getErrorVariant = (error: string): 'destructive' | 'warning' | 'info' => {
    if (error.includes('domain') || error.includes('โดเมน') || error.includes('มหาวิทยาลัย'))
      return 'warning';
    if (error.includes('network') || error.includes('เครือข่าย')) return 'info';
    return 'destructive';
  };

  const showOverlay = checkingIP || authState.isLoading;

  return (
    <Card className={cn(glassCardLargeClass, 'relative mb-4 overflow-visible border-0 shadow-none')}>
      {showOverlay && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/95 backdrop-blur-sm dark:bg-background/95">
          <div className="text-center">
            <Spinner size="lg" className="mb-2 text-primary" />
            <p className="font-medium">
              {checkingIP ? 'กำลังตรวจสอบ...' : 'กำลังเข้าสู่ระบบ...'}
            </p>
          </div>
        </div>
      )}

      <CardContent className="p-8">
        <div className="mb-6 text-center">
          <Shield
            className="mx-auto mb-4 h-12 w-12 text-primary drop-shadow-sm"
            strokeWidth={1.75}
          />
          <h2
            className="text-xl font-extrabold tracking-tight sm:text-2xl"
            style={{ color: pageColors.textPrimary }}
          >
            เข้าสู่ระบบ
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            เลือก Microsoft (บัญชี ม.อ.) หรือ Google
            {!activityData?.requiresUniversityLogin && ' — Google นอก @psu.ac.th = บุคคลภายนอก'}
          </p>

          {authState.retryCount > 0 && (
            <div className="mt-3">
              <Badge variant={authState.retryCount >= maxRetries ? 'destructive' : 'warning'}>
                ลองครั้งที่ {authState.retryCount}/{maxRetries}
              </Badge>
            </div>
          )}
        </div>

        {authState.error && (
          <Alert variant={getErrorVariant(authState.error)} className="mb-6">
            <AlertTitle>เกิดข้อผิดพลาด</AlertTitle>
            <AlertDescription className="flex items-start justify-between gap-2">
              <span>{authState.error}</span>
              {canRetry && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 h-7 px-2"
                  onClick={() => setAuthState((prev) => ({ ...prev, error: null }))}
                >
                  ปิด
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-4">
          <MicrosoftLogin
            onLoginSuccess={handleLoginSuccess}
            onLoginError={handleLoginError}
            onLogout={() => {}}
            onPreLoginCheck={onPreLoginCheck}
            disabled={loginDisabled}
          />

          <div className="relative flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs font-semibold text-muted-foreground">หรือ</span>
            <Separator className="flex-1" />
          </div>

          <GoogleLoginButton
            onLoginSuccess={handleLoginSuccess}
            onLoginError={handleLoginError}
            onPreLoginCheck={onPreLoginCheck}
            disabled={loginDisabled}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default MicrosoftAuthSection;
