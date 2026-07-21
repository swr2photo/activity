'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import {
  signInWithGoogle,
  mapAuthError,
  AuthRedirectPendingError,
  UniversityUserProfile,
} from '../../lib/firebaseAuth';
import { SessionManager } from '../../lib/sessionManager';

const GoogleLogo: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    viewBox="0 0 48 48"
    width={size}
    height={size}
    className="shrink-0"
    aria-hidden
  >
    <path
      fill="#FFC107"
      d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
    />
    <path
      fill="#FF3D00"
      d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
    />
    <path
      fill="#4CAF50"
      d="M24 44c5.2 0 10-2 13.6-5.3l-6.3-5.2C29.3 35.2 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
    />
    <path
      fill="#1976D2"
      d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.5l.1.1 6.3 5.2C39.5 36.8 44 31.5 44 24c0-1.2-.1-2.3-.4-3.5z"
    />
  </svg>
);

const getClientIP = async (): Promise<string> => {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip || 'unknown';
  } catch {
    return 'unknown';
  }
};

interface GoogleLoginButtonProps {
  onLoginSuccess?: (userData: UniversityUserProfile) => void;
  onLoginError?: (error: string) => void;
  onPreLoginCheck?: (email: string) => Promise<boolean>;
  disabled?: boolean;
  fullWidth?: boolean;
}

const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({
  onLoginSuccess,
  onLoginError,
  onPreLoginCheck,
  disabled = false,
  fullWidth = true,
}) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading || disabled) return;
    setLoading(true);
    try {
      const { user, userData } = await signInWithGoogle();

      if (onPreLoginCheck && user.email) {
        const ok = await onPreLoginCheck(user.email);
        if (!ok) {
          throw new Error('ไม่สามารถเข้าสู่ระบบได้ กรุณาติดต่อผู้ดูแลระบบ');
        }
      }

      const ip = await getClientIP();
      await SessionManager.createSession(user.uid, user.email || '', ip);

      onLoginSuccess?.(userData);
    } catch (err: any) {
      if (err instanceof AuthRedirectPendingError || err?.code === 'auth/redirect-pending') {
        return;
      }
      const msg = mapAuthError(err) || err?.message || 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ';
      if (msg) onLoginError?.(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      className={cn(
        'h-auto rounded-xl py-3.5 font-bold',
        fullWidth && 'w-full'
      )}
      disabled={disabled || loading}
      onClick={handleClick}
    >
      {loading ? <Spinner size="sm" className="text-current" /> : <GoogleLogo />}
      {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย Google'}
    </Button>
  );
};

export default GoogleLoginButton;
