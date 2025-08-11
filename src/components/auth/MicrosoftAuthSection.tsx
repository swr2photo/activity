'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  CircularProgress,
  Divider,
  Button,
  Chip,
  Fade,
  Collapse
} from '@mui/material';
import {
  Security as SecurityIcon,
  School as SchoolIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import MicrosoftLogin from '../MicrosoftLogin';

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
  showAdvancedHelp: boolean;
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
  maxRetries = 3
}) => {
  const [authState, setAuthState] = useState<AuthState>({
    isLoading: false,
    error: null,
    retryCount: 0,
    showAdvancedHelp: false,
    lastAttempt: null
  });

  useEffect(() => {
    if (authState.error) {
      const timer = setTimeout(() => {
        setAuthState(prev => ({ ...prev, error: null }));
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [authState.error]);

  const handleLoginSuccess = async (userProfile: any) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      if (activityData?.requiresUniversityLogin && userProfile?.email) {
        const email = userProfile.email.toLowerCase();
        const isValidDomain = allowedDomains.some(domain => email.endsWith(`@${domain}`));
        if (!isValidDomain) {
          throw new Error(`กรุณาใช้บัญชีมหาวิทยาลัยที่ลงท้ายด้วย: ${allowedDomains.map(d => `@${d}`).join(', ')}`);
        }
      }

      if (onPreLoginCheck && userProfile?.email) {
        const canProceed = await onPreLoginCheck(userProfile.email);
        if (!canProceed) {
          throw new Error('ไม่สามารถเข้าสู่ระบบได้ กรุณาติดต่อผู้ดูแลระบบ');
        }
      }

      setAuthState(prev => ({ ...prev, retryCount: 0, lastAttempt: new Date() }));
      onLoginSuccess(userProfile);
    } catch (error: any) {
      handleLoginError(error.message || 'เกิดข้อผิดพลาดในการประมวลผลการเข้าสู่ระบบ');
    } finally {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleLoginError = (error: string) => {
    setAuthState(prev => ({
      ...prev,
      error,
      retryCount: prev.retryCount + 1,
      isLoading: false,
      lastAttempt: new Date()
    }));
    onLoginError(error);
  };

  const canRetry = authState.retryCount < maxRetries;
  const shouldShowHelp = authState.retryCount >= 2 || authState.showAdvancedHelp;

  const getErrorSeverity = (error: string): 'error' | 'warning' | 'info' => {
    if (error.includes('domain') || error.includes('โดเมน')) return 'warning';
    if (error.includes('network') || error.includes('เครือข่าย')) return 'info';
    return 'error';
  };

  return (
    <Card sx={{ mb: 4, background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.2)', position: 'relative', overflow: 'visible' }}>
      <Fade in={checkingIP || authState.isLoading}>
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, bgcolor: 'rgba(255,255,255,0.95)', display: checkingIP || authState.isLoading ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: 2, backdropFilter: 'blur(4px)' }}>
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress size={32} sx={{ mb: 2 }} />
            <Typography variant="body1" fontWeight="medium">
              {checkingIP ? 'ตรวจสอบสิทธิ์การเข้าใช้งาน...' : 'กำลังเข้าสู่ระบบ...'}
            </Typography>
            <Typography variant="body2" color="text.secondary">กรุณารอสักครู่</Typography>
          </Box>
        </Box>
      </Fade>

      <CardContent sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <SecurityIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))' }} />
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            เข้าสู่ระบบเพื่อลงทะเบียน
          </Typography>
          <Typography variant="body1" color="text.secondary">
            ใช้บัญชี Microsoft ของมหาวิทยาลัย (ล็อกการใช้งาน 1 บัญชีต่อ 1 IP ชั่วคราว 30 นาที)
          </Typography>

          {authState.retryCount > 0 && (
            <Box sx={{ mt: 2 }}>
              <Chip label={`ลองครั้งที่ ${authState.retryCount}/${maxRetries}`} color={authState.retryCount >= maxRetries ? 'error' : 'warning'} size="small" />
            </Box>
          )}
        </Box>

        <Collapse in={!!authState.error}>
          <Alert severity={getErrorSeverity(authState.error || '')} sx={{ mb: 3 }} action={canRetry && (<Button color="inherit" size="small" onClick={() => setAuthState(prev => ({ ...prev, error: null }))}>ปิด</Button>)}>
            <Typography variant="body2"><strong>เกิดข้อผิดพลาด:</strong> {authState.error}</Typography>
            {!canRetry && (<Typography variant="caption" display="block" sx={{ mt: 1 }}>หากยังคงมีปัญหา กรุณาติดต่อผู้ดูแลระบบ</Typography>)}
          </Alert>
        </Collapse>

        {activityData?.requiresUniversityLogin && (
          <>
            <Alert severity="info" sx={{ mb: 3, background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)', border: '1px solid #3b82f6' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <SchoolIcon fontSize="small" />
                <Typography variant="subtitle2" fontWeight="bold">กิจกรรมนี้สำหรับบุคลากรมหาวิทยาลัยเท่านั้น</Typography>
              </Box>
              <Typography variant="body2" sx={{ mb: 1 }}>จำเป็นต้องใช้บัญชี Microsoft ที่ลงท้ายด้วย:</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {allowedDomains.map(domain => (<Chip key={domain} label={`@${domain}`} size="small" color="info" variant="outlined" />))}
              </Box>
            </Alert>
            <Divider sx={{ my: 3 }} />
          </>
        )}

        <Alert severity="success" sx={{ mb: 3, background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)', border: '1px solid #10b981' }}>
          <Typography variant="body2"><strong>ความปลอดภัย:</strong> เซสชันหมดอายุอัตโนมัติเมื่อไม่มีการใช้งาน 30 นาที และมีการล็อก 1 บัญชีต่อ 1 IP ชั่วคราว 30 นาที</Typography>
        </Alert>

        <MicrosoftLogin onLoginSuccess={handleLoginSuccess} onLoginError={handleLoginError} onLogout={() => {}} disabled={disabled || checkingIP || authState.isLoading || !canRetry} />

        {/* Help */}
        {!(authState.retryCount >= 2) ? (
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Button variant="text" size="small" onClick={() => setAuthState(prev => ({ ...prev, showAdvancedHelp: true }))}>มีปัญหา? คลิกเพื่อดูวิธีแก้ไข</Button>
          </Box>
        ) : null}

        <Collapse in={authState.retryCount >= 2 || authState.showAdvancedHelp}>
          <Box sx={{ mt: 3, p: 2, bgcolor: 'warning.50', borderRadius: 1, border: '1px solid', borderColor: 'warning.200' }}>
            <Typography variant="subtitle2" color="warning.main" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <WarningIcon fontSize="small" />
              มีปัญหาในการเข้าสู่ระบบ?
            </Typography>
            <Typography variant="body2" color="text.secondary" component="div">
              <strong>วิธีแก้ไขปัญหา:</strong><br/>
              • ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต<br/>
              • ลองปิดและเปิดเบราว์เซอร์ใหม่<br/>
              • ตรวจสอบว่าใช้บัญชี Microsoft ที่ถูกต้อง (@psu.ac.th)<br/>
              • หากยังคงมีปัญหา ลองใช้เบราว์เซอร์อื่น
            </Typography>
          </Box>
        </Collapse>

        <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}><strong>หมายเหตุ:</strong></Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            • หากไม่มีบัญชี กรุณาติดต่อแผนกเทคโนโลยีสารสนเทศ<br/>
            • การลงทะเบียนจะเสร็จสิ้นหลังจากเข้าสู่ระบบและกรอกข้อมูลครบถ้วน
          </Typography>
          {authState.lastAttempt && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              ความพยายามล่าสุด: {authState.lastAttempt.toLocaleString('th-TH')}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default MicrosoftAuthSection;