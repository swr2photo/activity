'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  CircularProgress,
  Button,
  Chip,
  Fade,
  Collapse,
  Divider,
  Stack,
} from '@mui/material';
import { Security as SecurityIcon } from '@mui/icons-material';
import { glassCardLargeSx, pageColors } from '../../lib/uiTheme';
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

  // รับผลหลัง redirect จาก Google / Microsoft (ครั้งเดียวต่อหน้า)
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

  const getErrorSeverity = (error: string): 'error' | 'warning' | 'info' => {
    if (error.includes('domain') || error.includes('โดเมน') || error.includes('มหาวิทยาลัย'))
      return 'warning';
    if (error.includes('network') || error.includes('เครือข่าย')) return 'info';
    return 'error';
  };

  return (
    <Card
      elevation={0}
      sx={{
        ...glassCardLargeSx,
        mb: 4,
        position: 'relative',
        overflow: 'visible',
      }}
    >
      <Fade in={checkingIP || authState.isLoading}>
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(255,255,255,0.95)',
            display: checkingIP || authState.isLoading ? 'flex' : 'none',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            borderRadius: 2,
            backdropFilter: 'blur(4px)',
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress size={32} sx={{ mb: 2 }} />
            <Typography variant="body1" fontWeight="medium">
              {checkingIP ? 'กำลังตรวจสอบ...' : 'กำลังเข้าสู่ระบบ...'}
            </Typography>
          </Box>
        </Box>
      </Fade>

      <CardContent sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <SecurityIcon
            sx={{
              fontSize: 48,
              color: 'primary.main',
              mb: 2,
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))',
            }}
          />
          <Typography
            variant="h5"
            gutterBottom
            sx={{ fontWeight: 800, color: pageColors.textPrimary, letterSpacing: '-0.02em' }}
          >
            เข้าสู่ระบบ
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            เลือก Microsoft (บัญชี ม.อ.) หรือ Google
            {!activityData?.requiresUniversityLogin && ' — Google นอก @psu.ac.th = บุคคลภายนอก'}
          </Typography>

          {authState.retryCount > 0 && (
            <Box sx={{ mt: 2 }}>
              <Chip
                label={`ลองครั้งที่ ${authState.retryCount}/${maxRetries}`}
                color={authState.retryCount >= maxRetries ? 'error' : 'warning'}
                size="small"
              />
            </Box>
          )}
        </Box>

        <Collapse in={!!authState.error}>
          <Alert
            severity={getErrorSeverity(authState.error || '')}
            sx={{ mb: 3 }}
            action={
              canRetry ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => setAuthState((prev) => ({ ...prev, error: null }))}
                >
                  ปิด
                </Button>
              ) : undefined
            }
          >
            <Typography variant="body2">
              <strong>เกิดข้อผิดพลาด:</strong> {authState.error}
            </Typography>
          </Alert>
        </Collapse>

        <Stack spacing={2}>
          <MicrosoftLogin
            onLoginSuccess={handleLoginSuccess}
            onLoginError={handleLoginError}
            onLogout={() => {}}
            onPreLoginCheck={onPreLoginCheck}
            disabled={loginDisabled}
          />

          <Divider>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              หรือ
            </Typography>
          </Divider>

          <GoogleLoginButton
            onLoginSuccess={handleLoginSuccess}
            onLoginError={handleLoginError}
            onPreLoginCheck={onPreLoginCheck}
            disabled={loginDisabled}
          />
        </Stack>
      </CardContent>
    </Card>
  );
};

export default MicrosoftAuthSection;
